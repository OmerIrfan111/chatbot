import io
from dataclasses import dataclass

import pdfplumber
from fastapi import UploadFile
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.database import SessionLocal
from app.llm import get_embeddings
from app.models import Document
from app.vectorstore import Chunk, FAISSVectorStore

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBED_BATCH = 100  # keep memory bounded on large PDFs

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    length_function=len,
)

SUPPORTED_EXTENSIONS = {".pdf", ".txt"}
SUPPORTED_MIME_PREFIXES = ("application/pdf", "text/")


@dataclass
class ParsedPage:
    text: str
    page: int


# ── parsers ───────────────────────────────────────────────────────────────────


def _parse_pdf(data: bytes) -> list[ParsedPage]:
    pages: list[ParsedPage] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(ParsedPage(text=text, page=i + 1))
    return pages


def _parse_txt(data: bytes) -> list[ParsedPage]:
    return [ParsedPage(text=data.decode("utf-8", errors="replace"), page=1)]


def _detect_and_parse(filename: str, content_type: str, data: bytes) -> list[ParsedPage]:
    name = (filename or "").lower()
    mime = (content_type or "").lower()

    if name.endswith(".pdf") or "pdf" in mime:
        return _parse_pdf(data)
    if name.endswith(".txt") or mime.startswith("text/"):
        return _parse_txt(data)

    raise ValueError(
        f"Unsupported file type '{filename}'. "
        f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
    )


# ── public API ────────────────────────────────────────────────────────────────


async def ingest_file(file: UploadFile, store: FAISSVectorStore) -> int:
    """Parse → chunk → embed → store. Returns the new document_id."""
    data = await file.read()
    filename = file.filename or "upload"
    content_type = file.content_type or ""

    if not data:
        raise ValueError("Uploaded file is empty.")

    pages = _detect_and_parse(filename, content_type, data)
    if not pages:
        raise ValueError("No text could be extracted from the file.")

    # Persist document record
    with SessionLocal() as db:
        doc = Document(filename=filename, content_type=content_type)
        db.add(doc)
        db.commit()
        db.refresh(doc)
        document_id = doc.id

    # Build raw chunks with metadata
    raw: list[dict] = []
    for p in pages:
        for i, text in enumerate(_splitter.split_text(p.text)):
            raw.append({
                "text": text,
                "metadata": {
                    "document_id": document_id,
                    "filename": filename,
                    "page": p.page,
                    "chunk_index": i,
                },
            })

    if not raw:
        raise ValueError("Document produced no usable text chunks.")

    # Embed in batches (avoids OOM on 200-page PDFs)
    embedder = get_embeddings()
    chunks: list[Chunk] = []
    for start in range(0, len(raw), EMBED_BATCH):
        batch = raw[start : start + EMBED_BATCH]
        embeddings = embedder.embed_documents([r["text"] for r in batch])
        for r, emb in zip(batch, embeddings):
            chunks.append(Chunk(text=r["text"], metadata=r["metadata"], embedding=emb))

    store.add(chunks)

    # Update chunk count
    with SessionLocal() as db:
        doc = db.get(Document, document_id)
        if doc:
            doc.chunk_count = len(chunks)
            db.commit()

    return document_id
