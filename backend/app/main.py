import csv
import io
import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.analytics import (
    get_confidence_distribution,
    get_daily_counts,
    get_feedback_stats,
    get_gaps,
    get_stats,
)
from app.auth import create_access_token, get_current_admin
from app.chain import REFUSAL, answer, answer_stream
from app.config import get_settings
from app.database import SessionLocal, init_db
from app.ingest import ingest_file
from app.memory import memory_store
from app.models import ChunkMetadata, Document, Feedback, Interaction
from app.retriever import retrieve
from app.vectorstore import FAISSVectorStore

settings = get_settings()

_store: Optional[FAISSVectorStore] = None


def get_store() -> FAISSVectorStore:
    global _store
    if _store is None:
        _store = FAISSVectorStore()
    return _store


def _require_docs(store: FAISSVectorStore) -> None:
    if store.index is None or store.index.ntotal == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents ingested yet. Upload a document first.",
        )


def _log_interaction(
    session_id: str,
    question: str,
    answer_text: str,
    confidence: Optional[float],
    low_confidence_warning: bool,
) -> int:
    """Persist an interaction and return its ID."""
    is_refusal = REFUSAL.lower() in answer_text.lower()
    with SessionLocal() as db:
        row = Interaction(
            session_id=session_id,
            question=question,
            answer=answer_text,
            confidence=confidence,
            low_confidence_warning=low_confidence_warning,
            is_refusal=is_refusal,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    get_store()
    yield


app = FastAPI(title="AI Support Agent API (mutex)", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    store = get_store()
    return {
        "status": "ok",
        "version": app.version,
        "indexed_chunks": store.index.ntotal if store.index else 0,
    }


# ── documents ──────────────────────────────────────────────────────────────────

@app.post("/upload", status_code=201)
async def upload(file: UploadFile = File(...)):
    """Ingest a PDF, TXT, DOCX, CSV, MD, or HTML file."""
    store = get_store()
    try:
        document_id = await ingest_file(file, store)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"document_id": document_id, "filename": file.filename, "status": "ready"}


@app.get("/documents")
async def list_documents():
    with SessionLocal() as db:
        docs = db.query(Document).order_by(Document.created_at.desc()).all()
        return [
            {
                "id": d.id,
                "filename": d.filename,
                "chunk_count": d.chunk_count,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]


@app.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: int):
    store = get_store()
    store.delete_by_document(document_id)
    with SessionLocal() as db:
        doc = db.get(Document, document_id)
        if doc:
            db.delete(doc)
            db.commit()


# ── sessions / memory ──────────────────────────────────────────────────────────

@app.delete("/sessions/{session_id}", status_code=204)
async def clear_session(session_id: str):
    memory_store.delete(session_id)


@app.get("/sessions")
async def list_sessions():
    return {"sessions": memory_store.list_sessions()}


# ── auth ───────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/login")
async def login(req: LoginRequest):
    if req.email != settings.admin_email or req.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": req.email, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


# ── feedback ───────────────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    rating: int  # 1 = thumbs up, -1 = thumbs down


@app.post("/feedback/{interaction_id}", status_code=201)
async def submit_feedback(interaction_id: int, req: FeedbackRequest):
    if req.rating not in (1, -1):
        raise HTTPException(status_code=422, detail="Rating must be 1 or -1")
    with SessionLocal() as db:
        interaction = db.get(Interaction, interaction_id)
        if not interaction:
            raise HTTPException(status_code=404, detail="Interaction not found")
        # Upsert: replace existing feedback for this interaction
        existing = (
            db.query(Feedback)
            .filter(Feedback.interaction_id == interaction_id)
            .first()
        )
        if existing:
            existing.rating = req.rating
        else:
            db.add(Feedback(interaction_id=interaction_id, rating=req.rating))
        db.commit()
    return {"interaction_id": interaction_id, "rating": req.rating}


# ── analytics (admin-only) ─────────────────────────────────────────────────────

@app.get("/analytics/stats")
async def analytics_stats(_admin=Depends(get_current_admin)):
    with SessionLocal() as db:
        stats = get_stats(db)
        stats["daily_counts"] = get_daily_counts(db)
        stats["confidence_distribution"] = get_confidence_distribution(db)
        stats["feedback"] = get_feedback_stats(db)
        return stats


@app.get("/analytics/gaps")
async def analytics_gaps(_admin=Depends(get_current_admin)):
    with SessionLocal() as db:
        return {"gaps": get_gaps(db)}


@app.get("/analytics/gaps/export")
async def analytics_gaps_export(_admin=Depends(get_current_admin)):
    with SessionLocal() as db:
        gaps = get_gaps(db, limit=10_000)

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


# ── chat ───────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    session_id: str = "default"
    chat_history: list[dict] = []


def _get_history(req: ChatRequest) -> list[dict]:
    if req.chat_history:
        return req.chat_history
    return memory_store.get(req.session_id).get()


def _record_turn(session_id: str, question: str, response_text: str) -> None:
    mem = memory_store.get(session_id)
    mem.add("user", question)
    mem.add("assistant", response_text)


@app.post("/chat")
async def chat(req: ChatRequest):
    store = get_store()
    _require_docs(store)
    history = _get_history(req)
    chunks = retrieve(req.question, store, k=5)
    result = answer(req.question, chunks, history)
    _record_turn(req.session_id, req.question, result["answer"])
    interaction_id = _log_interaction(
        req.session_id,
        req.question,
        result["answer"],
        confidence=result.get("confidence"),
        low_confidence_warning=result.get("low_confidence_warning", False),
    )
    return {**result, "interaction_id": interaction_id}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream a grounded answer token-by-token via Server-Sent Events."""
    store = get_store()
    _require_docs(store)
    history = _get_history(req)
    chunks = retrieve(req.question, store, k=5)

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
                _record_turn(req.session_id, req.question, answer_text)
                try:
                    interaction_id = _log_interaction(
                        req.session_id,
                        req.question,
                        answer_text,
                        confidence=evt.get("confidence"),
                        low_confidence_warning=evt.get("low_confidence_warning", False),
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
