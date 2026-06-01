from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.chain import answer, answer_stream
from app.config import get_settings
from app.database import SessionLocal, init_db
from app.ingest import ingest_file
from app.memory import memory_store
from app.models import ChunkMetadata, Document
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    get_store()
    yield


app = FastAPI(title="AI Support Agent API (mutex)", version="0.3.0", lifespan=lifespan)

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
        # ChunkMetadata rows are CASCADE-deleted with the document
        doc = db.get(Document, document_id)
        if doc:
            db.delete(doc)
            db.commit()


# ── sessions / memory ──────────────────────────────────────────────────────────

@app.delete("/sessions/{session_id}", status_code=204)
async def clear_session(session_id: str):
    """Clear the conversation memory for a session."""
    memory_store.delete(session_id)


@app.get("/sessions")
async def list_sessions():
    return {"sessions": memory_store.list_sessions()}


# ── chat ───────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    session_id: str = "default"
    # If provided, used directly; otherwise server-side memory is used
    chat_history: list[dict] = []


def _get_history(req: ChatRequest) -> list[dict]:
    """Return client-provided history or fall back to server-side memory."""
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
    return result


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream a grounded answer token-by-token via Server-Sent Events."""
    store = get_store()
    _require_docs(store)
    history = _get_history(req)
    chunks = retrieve(req.question, store, k=5)

    # We need to capture the full answer to persist in memory after streaming.
    # Wrap the generator to intercept the "done" event.
    async def _stream_and_record():
        full_answer = []
        async for sse in answer_stream(req.question, chunks, history):
            yield sse
            # Parse token content to reconstruct the answer
            if sse.startswith("data: "):
                import json
                try:
                    evt = json.loads(sse[6:])
                    if evt.get("type") == "token":
                        full_answer.append(evt.get("content", ""))
                    elif evt.get("type") == "done":
                        _record_turn(req.session_id, req.question, "".join(full_answer))
                except Exception:
                    pass

    return StreamingResponse(
        _stream_and_record(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
