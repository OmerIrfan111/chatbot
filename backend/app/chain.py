import json
from collections.abc import AsyncGenerator

from langchain.schema import HumanMessage, SystemMessage

from app.llm import get_chat_model
from app.vectorstore import Chunk

REFUSAL = "I don't have enough information in the provided documents to answer that."
CONFIDENCE_THRESHOLD = 0.70  # below this → low-confidence warning
CONFLICT_SCORE_FLOOR = 0.55  # min score for a document to be considered conflicting

SYSTEM_PROMPT = (
    "You are a helpful customer support assistant. "
    "Answer the user's question using ONLY the context provided below. "
    f'If the context does not contain enough information, say exactly: "{REFUSAL}" '
    "Always cite sources by document name and page/section when you use them."
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _build_history_text(chat_history: list[dict] | None) -> str:
    if not chat_history:
        return ""
    lines = [
        f"{m['role'].capitalize()}: {m['content']}"
        for m in chat_history[-10:]
    ]
    return "\nConversation history:\n" + "\n".join(lines)


def _build_context(chunks: list[tuple[Chunk, float]]) -> str:
    parts = []
    for chunk, _ in chunks:
        m = chunk.metadata
        parts.append(
            f"[Source: {m.get('filename', 'unknown')}, "
            f"Page {m.get('page', '?')}]\n{chunk.text}"
        )
    return "\n\n---\n\n".join(parts)


def _compute_confidence(chunks: list[tuple[Chunk, float]]) -> float:
    """
    Weighted average of top-3 scores (weight = score²), capped to [0, 1].
    Scores are cosine similarities from IndexFlatIP over normalised vectors.
    """
    if not chunks:
        return 0.0
    top = chunks[:3]
    weights = [s ** 2 for _, s in top]
    total_w = sum(weights)
    if total_w == 0:
        return 0.0
    weighted_avg = sum(s * w for (_, s), w in zip(top, weights)) / total_w
    return round(min(1.0, max(0.0, weighted_avg)), 3)


def _build_sources(chunks: list[tuple[Chunk, float]]) -> list[dict]:
    seen: set[tuple] = set()
    sources = []
    for chunk, score in chunks:
        m = chunk.metadata
        key = (m.get("filename"), m.get("page"))
        if key not in seen:
            seen.add(key)
            sources.append({
                "filename": m.get("filename"),
                "page": m.get("page"),
                "chunk_index": m.get("chunk_index"),
                "document_id": m.get("document_id"),
                "score": round(score, 4),
                "snippet": chunk.text[:300],  # expanded snippet for Phase 4
            })
    return sources


def _detect_conflict(chunks: list[tuple[Chunk, float]]) -> dict | None:
    """
    Flag potential conflict when top-5 chunks span ≥ 2 different documents
    AND each qualifying document has at least one chunk above CONFLICT_SCORE_FLOOR.
    Returns a conflict descriptor or None.
    """
    # Group high-scoring chunks by document
    doc_scores: dict[int, list[float]] = {}
    doc_names: dict[int, str] = {}
    for chunk, score in chunks[:5]:
        if score < CONFLICT_SCORE_FLOOR:
            continue
        doc_id = chunk.metadata.get("document_id", -1)
        doc_scores.setdefault(doc_id, []).append(score)
        doc_names[doc_id] = chunk.metadata.get("filename", "unknown")

    # Conflict requires ≥ 2 qualifying documents
    qualifying = {d: s for d, s in doc_scores.items() if max(s) >= CONFLICT_SCORE_FLOOR}
    if len(qualifying) < 2:
        return None

    names = [doc_names[d] for d in qualifying]
    return {
        "detected": True,
        "documents": names,
        "message": (
            f"This answer draws from {len(names)} different documents "
            f"({', '.join(names)}). Review each source to confirm consistency."
        ),
    }


def _build_response(answer_text: str, chunks: list[tuple[Chunk, float]]) -> dict:
    confidence = _compute_confidence(chunks)
    conflict = _detect_conflict(chunks)
    return {
        "answer": answer_text,
        "sources": _build_sources(chunks),
        "confidence": confidence,
        "low_confidence_warning": confidence < CONFIDENCE_THRESHOLD,
        "conflict_warning": conflict,
    }


# ── public API ────────────────────────────────────────────────────────────────

def answer(
    question: str,
    chunks: list[tuple[Chunk, float]],
    chat_history: list[dict] | None = None,
) -> dict:
    """Run the grounding chain and return {answer, sources, confidence, warnings}."""
    user_content = (
        f"Context:\n{_build_context(chunks)}"
        f"{_build_history_text(chat_history)}"
        f"\n\nUser question: {question}"
    )
    model = get_chat_model()
    response = model.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ])
    return _build_response(response.content, chunks)


async def answer_stream(
    question: str,
    chunks: list[tuple[Chunk, float]],
    chat_history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Yields SSE-formatted data strings for token-by-token streaming."""
    user_content = (
        f"Context:\n{_build_context(chunks)}"
        f"{_build_history_text(chat_history)}"
        f"\n\nUser question: {question}"
    )
    model = get_chat_model()
    async for chunk in model.astream([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]):
        if chunk.content:
            yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

    # Done event carries all metadata including warnings
    confidence = _compute_confidence(chunks)
    conflict = _detect_conflict(chunks)
    yield f"data: {json.dumps({'type': 'done', 'sources': _build_sources(chunks), 'confidence': confidence, 'low_confidence_warning': confidence < CONFIDENCE_THRESHOLD, 'conflict_warning': conflict})}\n\n"
