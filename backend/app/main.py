import csv
import io
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.analytics import (
    get_confidence_distribution,
    get_daily_counts,
    get_feedback_stats,
    get_gaps,
    get_stats,
    get_usage_stats,
)
from app.auth import (
    Principal,
    create_access_token,
    get_principal,
    issue_tenant_token,
    require_admin,
)
from app.chain import REFUSAL, answer, answer_stream
from app.config import get_settings
from app.database import SessionLocal, init_db
from app.guardrails import redact_pii
from app.ingest import ingest_file
from app.llm import get_embeddings
from app.memory import memory_store
from app.models import Document, Feedback, Interaction, Ticket
from app.ratelimit import get_limiter
from app.retriever import retrieve
from app.semantic_cache import semantic_cache
from app.suggestions import generate_suggestions
from app.usage import measure
from app.vectorstore import FAISSVectorStore

settings = get_settings()

# ── per-tenant vector stores ─────────────────────────────────────────────────────
_stores: dict[str, FAISSVectorStore] = {}


def get_store(tenant_id: str) -> FAISSVectorStore:
    """Return the tenant's isolated FAISS store (one index namespace per tenant)."""
    store = _stores.get(tenant_id)
    if store is None:
        path = str(Path(settings.vector_store_path) / tenant_id)
        store = FAISSVectorStore(path=path)
        _stores[tenant_id] = store
    return store


def _require_docs(store: FAISSVectorStore) -> None:
    if store.index is None or store.index.ntotal == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents ingested yet. Upload a document first.",
        )


def _skey(tenant_id: str, session_id: str) -> str:
    """Namespace memory/cache keys by tenant so sessions never collide."""
    return f"{tenant_id}:{session_id}"


# ── rate limiting ────────────────────────────────────────────────────────────────

def rate_limit(request: Request, principal: Principal = Depends(get_principal)) -> Principal:
    if not settings.rate_limit_enabled:
        return principal
    ip = request.client.host if request.client else "unknown"
    allowed, retry_after = get_limiter().check(f"{principal.tenant_id}:{ip}")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Slow down and try again.",
            headers={"Retry-After": str(retry_after)},
        )
    return principal


# ── interaction logging (PII-redacted + cost-tracked) ────────────────────────────

def _log_interaction(
    tenant_id: str,
    session_id: str,
    question: str,
    answer_text: str,
    confidence: Optional[float],
    low_confidence_warning: bool,
    prompt_text: Optional[str] = None,
) -> int:
    is_refusal = REFUSAL.lower() in answer_text.lower()
    usage = measure(prompt_text or question, answer_text)
    with SessionLocal() as db:
        row = Interaction(
            tenant_id=tenant_id,
            session_id=session_id,
            question=redact_pii(question),       # never persist raw PII
            answer=redact_pii(answer_text),
            confidence=confidence,
            low_confidence_warning=low_confidence_warning,
            is_refusal=is_refusal,
            prompt_tokens=usage["prompt_tokens"],
            completion_tokens=usage["completion_tokens"],
            cost_usd=usage["cost_usd"],
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AI Support Agent API", version="0.7.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── static files (widget bundle) ───────────────────────────────────────────────
_widget_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "widget"
if _widget_dir.exists():
    app.mount("/widget", StaticFiles(directory=str(_widget_dir), html=True), name="widget")


# ── health (public) ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    indexed = sum(
        s.index.ntotal for s in _stores.values() if s.index is not None
    )
    return {"status": "ok", "version": app.version, "indexed_chunks": indexed}


# ── auth (public) ────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/login")
async def login(req: LoginRequest):
    if req.email != settings.admin_email or req.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(
        {"sub": req.email, "role": "admin", "tenant_id": settings.default_tenant}
    )
    return {"access_token": token, "token_type": "bearer"}


class TokenRequest(BaseModel):
    tenant_id: str
    api_key: str


@app.post("/auth/token")
async def tenant_token(req: TokenRequest):
    """Exchange a tenant API key for a scoped end-user (widget) token."""
    token = issue_tenant_token(req.tenant_id, req.api_key)
    return {"access_token": token, "token_type": "bearer", "tenant_id": req.tenant_id}


# ── documents ────────────────────────────────────────────────────────────────────

@app.post("/upload", status_code=201)
async def upload(
    file: UploadFile = File(...),
    principal: Principal = Depends(rate_limit),
):
    """Ingest a PDF, TXT, DOCX, CSV, MD, or HTML file into the tenant's index."""
    store = get_store(principal.tenant_id)
    try:
        document_id = await ingest_file(file, store, tenant_id=principal.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"document_id": document_id, "filename": file.filename, "status": "ready"}


@app.get("/documents")
async def list_documents(principal: Principal = Depends(get_principal)):
    with SessionLocal() as db:
        docs = (
            db.query(Document)
            .filter(Document.tenant_id == principal.tenant_id)
            .order_by(Document.created_at.desc())
            .all()
        )
        return [
            {
                "id": d.id,
                "filename": d.filename,
                "chunk_count": d.chunk_count,
                "version": d.version,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]


@app.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: int, principal: Principal = Depends(get_principal)):
    with SessionLocal() as db:
        doc = db.get(Document, document_id)
        if not doc or doc.tenant_id != principal.tenant_id:
            raise HTTPException(status_code=404, detail="Document not found")
        get_store(principal.tenant_id).delete_by_document(document_id)
        db.delete(doc)
        db.commit()


# ── sessions / memory ────────────────────────────────────────────────────────────

@app.delete("/sessions/{session_id}", status_code=204)
async def clear_session(session_id: str, principal: Principal = Depends(get_principal)):
    memory_store.delete(_skey(principal.tenant_id, session_id))


@app.get("/sessions")
async def list_sessions(principal: Principal = Depends(get_principal)):
    prefix = f"{principal.tenant_id}:"
    sessions = [
        s[len(prefix):] for s in memory_store.list_sessions() if s.startswith(prefix)
    ]
    return {"sessions": sessions}


# ── feedback ─────────────────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    rating: int  # 1 = thumbs up, -1 = thumbs down


@app.post("/feedback/{interaction_id}", status_code=201)
async def submit_feedback(
    interaction_id: int,
    req: FeedbackRequest,
    principal: Principal = Depends(get_principal),
):
    if req.rating not in (1, -1):
        raise HTTPException(status_code=422, detail="Rating must be 1 or -1")
    with SessionLocal() as db:
        interaction = db.get(Interaction, interaction_id)
        if not interaction or interaction.tenant_id != principal.tenant_id:
            raise HTTPException(status_code=404, detail="Interaction not found")
        existing = (
            db.query(Feedback)
            .filter(Feedback.interaction_id == interaction_id)
            .first()
        )
        if existing:
            existing.rating = req.rating
        else:
            db.add(Feedback(
                tenant_id=principal.tenant_id,
                interaction_id=interaction_id,
                rating=req.rating,
            ))
        db.commit()
    return {"interaction_id": interaction_id, "rating": req.rating}


# ── analytics (admin-only, tenant-scoped) ────────────────────────────────────────

@app.get("/analytics/stats")
async def analytics_stats(admin: Principal = Depends(require_admin)):
    with SessionLocal() as db:
        stats = get_stats(db, admin.tenant_id)
        stats["daily_counts"] = get_daily_counts(db, admin.tenant_id)
        stats["confidence_distribution"] = get_confidence_distribution(db, admin.tenant_id)
        stats["feedback"] = get_feedback_stats(db, admin.tenant_id)
        return stats


@app.get("/analytics/usage")
async def analytics_usage(admin: Principal = Depends(require_admin)):
    """Token + USD cost dashboard for the tenant."""
    with SessionLocal() as db:
        return get_usage_stats(db, admin.tenant_id)


@app.get("/analytics/gaps")
async def analytics_gaps(admin: Principal = Depends(require_admin)):
    with SessionLocal() as db:
        return {"gaps": get_gaps(db, admin.tenant_id)}


@app.get("/analytics/gaps/export")
async def analytics_gaps_export(admin: Principal = Depends(require_admin)):
    with SessionLocal() as db:
        gaps = get_gaps(db, admin.tenant_id, limit=10_000)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["id", "question", "confidence", "is_refusal", "created_at"],
    )
    writer.writeheader()
    writer.writerows(gaps)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gaps.csv"},
    )


# ── suggestions (auto starter questions) ─────────────────────────────────────────

@app.get("/suggestions")
async def suggestions(n: int = 4, principal: Principal = Depends(get_principal)):
    store = get_store(principal.tenant_id)
    if store.index is None or store.index.ntotal == 0:
        return {"suggestions": []}
    return {"suggestions": generate_suggestions(store, n=n)}


# ── escalation (human handoff) ───────────────────────────────────────────────────

class EscalateRequest(BaseModel):
    session_id: str = "default"
    question: str
    contact: str = ""
    reason: str = "low_confidence"
    interaction_id: Optional[int] = None


@app.post("/escalate", status_code=201)
async def escalate(req: EscalateRequest, principal: Principal = Depends(get_principal)):
    with SessionLocal() as db:
        ticket = Ticket(
            tenant_id=principal.tenant_id,
            session_id=req.session_id,
            question=redact_pii(req.question),
            contact=req.contact,
            reason=req.reason,
            interaction_id=req.interaction_id,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        return {
            "ticket_id": ticket.id,
            "status": ticket.status,
            "message": "A support specialist will follow up shortly.",
        }


@app.get("/tickets")
async def list_tickets(admin: Principal = Depends(require_admin)):
    with SessionLocal() as db:
        rows = (
            db.query(Ticket)
            .filter(Ticket.tenant_id == admin.tenant_id)
            .order_by(Ticket.created_at.desc())
            .all()
        )
        return {
            "tickets": [
                {
                    "id": t.id,
                    "session_id": t.session_id,
                    "question": t.question,
                    "contact": t.contact,
                    "reason": t.reason,
                    "status": t.status,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in rows
            ]
        }


# ── chat ─────────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    session_id: str = "default"
    chat_history: list[dict] = []


def _get_history(skey: str, req: ChatRequest) -> list[dict]:
    if req.chat_history:
        return req.chat_history
    return memory_store.get(skey).get()


def _record_turn(skey: str, question: str, response_text: str) -> None:
    mem = memory_store.get(skey)
    mem.add("user", question)
    mem.add("assistant", response_text)


@app.post("/chat")
async def chat(req: ChatRequest, principal: Principal = Depends(rate_limit)):
    tenant_id = principal.tenant_id
    skey = _skey(tenant_id, req.session_id)
    store = get_store(tenant_id)
    _require_docs(store)
    history = _get_history(skey, req)

    # Semantic cache, scoped per (tenant, session).
    cache_eligible = settings.semantic_cache_enabled
    q_emb = None
    if cache_eligible:
        q_emb = get_embeddings().embed_query(req.question)
        cached = semantic_cache.get(skey, q_emb)
        if cached is not None:
            _record_turn(skey, req.question, cached["answer"])
            interaction_id = _log_interaction(
                tenant_id, req.session_id, req.question, cached["answer"],
                confidence=cached.get("confidence"),
                low_confidence_warning=cached.get("low_confidence_warning", False),
            )
            return {**cached, "interaction_id": interaction_id}

    chunks = retrieve(req.question, store, k=5)
    result = answer(req.question, chunks, history)
    prompt_text = req.question + " " + " ".join(c.text for c, _ in chunks)
    _record_turn(skey, req.question, result["answer"])
    interaction_id = _log_interaction(
        tenant_id, req.session_id, req.question, result["answer"],
        confidence=result.get("confidence"),
        low_confidence_warning=result.get("low_confidence_warning", False),
        prompt_text=prompt_text,
    )
    if cache_eligible and q_emb is not None:
        semantic_cache.put(skey, q_emb, result)
    return {**result, "interaction_id": interaction_id}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, principal: Principal = Depends(rate_limit)):
    """Stream a grounded answer token-by-token via Server-Sent Events."""
    tenant_id = principal.tenant_id
    skey = _skey(tenant_id, req.session_id)
    store = get_store(tenant_id)
    _require_docs(store)
    history = _get_history(skey, req)
    chunks = retrieve(req.question, store, k=5)
    prompt_text = req.question + " " + " ".join(c.text for c, _ in chunks)

    async def _stream_and_record():
        full_answer: list[str] = []
        async for sse in answer_stream(req.question, chunks, history):
            if not sse.startswith("data: "):
                yield sse
                continue
            try:
                evt = json.loads(sse[6:])
            except Exception:
                yield sse
                continue

            if evt.get("type") == "token":
                full_answer.append(evt.get("content", ""))
                yield sse
            elif evt.get("type") == "done":
                answer_text = "".join(full_answer)
                _record_turn(skey, req.question, answer_text)
                try:
                    interaction_id = _log_interaction(
                        tenant_id, req.session_id, req.question, answer_text,
                        confidence=evt.get("confidence"),
                        low_confidence_warning=evt.get("low_confidence_warning", False),
                        prompt_text=prompt_text,
                    )
                    evt["interaction_id"] = interaction_id
                except Exception:
                    evt["interaction_id"] = None
                yield f"data: {json.dumps(evt)}\n\n"
            else:
                yield sse

    return StreamingResponse(
        _stream_and_record(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
