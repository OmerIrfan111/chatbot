from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.chain import answer
from app.config import get_settings
from app.database import SessionLocal, init_db
from app.ingest import ingest_file
from app.models import Document
from app.retriever import retrieve
from app.vectorstore import FAISSVectorStore

settings = get_settings()

# Singleton — loaded once at startup, shared across requests
_store: Optional[FAISSVectorStore] = None


def get_store() -> FAISSVectorStore:
    global _store
    if _store is None:
        _store = FAISSVectorStore()
    return _store


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    get_store()  # warm up FAISS index
    yield


app = FastAPI(
    title="AI Support Agent API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── health ────────────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict:
    store = get_store()
    return {
        "status": "ok",
        "version": app.version,
        "indexed_chunks": store.index.ntotal if store.index else 0,
    }


# ── documents ─────────────────────────────────────────────────────────────────


@app.post("/upload", status_code=201)
async def upload(file: UploadFile = File(...)):
    """Ingest a PDF or TXT file into the vector store."""
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


# ── chat ──────────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    question: str
    session_id: str = "default"
    chat_history: list[dict] = []


@app.post("/chat")
async def chat(req: ChatRequest):
    """Answer a question grounded in the ingested documents."""
    store = get_store()
    if store.index is None or store.index.ntotal == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents ingested yet. Upload a document first.",
        )
    chunks = retrieve(req.question, store, k=5)
    return answer(req.question, chunks, req.chat_history)
