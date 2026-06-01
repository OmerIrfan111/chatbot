import json
from collections.abc import AsyncGenerator

from langchain.schema import HumanMessage, SystemMessage

from app.llm import get_chat_model
from app.vectorstore import Chunk

REFUSAL = "I don't have enough information in the provided documents to answer that."

SYSTEM_PROMPT = (
    "You are a helpful customer support assistant. "
    "Answer the user's question using ONLY the context provided below. "
    f'If the context does not contain enough information, say exactly: "{REFUSAL}" '
    "Always cite sources by document name and page/section when you use them."
)

CONFIDENCE_THRESHOLD = 0.70  # below this → low-confidence warning


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
    if not chunks:
        return 0.0
    top_scores = [s for _, s in chunks[:3]]
    return round(min(1.0, max(0.0, sum(top_scores) / len(top_scores))), 3)


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
                "score": round(score, 4),
                "snippet": chunk.text[:200],
            })
    return sources


def answer(
    question: str,
    chunks: list[tuple[Chunk, float]],
    chat_history: list[dict] | None = None,
) -> dict:
    """
    Run the grounding chain and return:
      {"answer": str, "sources": list[dict], "confidence": float}
    """
    context = _build_context(chunks)

    history_text = ""
    if chat_history:
        lines = [
            f"{m['role'].capitalize()}: {m['content']}"
            for m in (chat_history or [])[-10:]
        ]
        history_text = "\nConversation history:\n" + "\n".join(lines)

    user_content = (
        f"Context:\n{context}"
        f"{history_text}"
        f"\n\nUser question: {question}"
    )

    model = get_chat_model()
    response = model.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ])

    return {
        "answer": response.content,
        "sources": _build_sources(chunks),
        "confidence": _compute_confidence(chunks),
    }


async def answer_stream(
    question: str,
    chunks: list[tuple[Chunk, float]],
    chat_history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Yields SSE-formatted data strings for token-by-token streaming."""
    context = _build_context(chunks)

    history_text = ""
    if chat_history:
        lines = [
            f"{m['role'].capitalize()}: {m['content']}"
            for m in (chat_history or [])[-10:]
        ]
        history_text = "\nConversation history:\n" + "\n".join(lines)

    user_content = (
        f"Context:\n{context}"
        f"{history_text}"
        f"\n\nUser question: {question}"
    )

    model = get_chat_model()
    async for chunk in model.astream([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]):
        if chunk.content:
            yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

    yield f"data: {json.dumps({'type': 'done', 'sources': _build_sources(chunks), 'confidence': _compute_confidence(chunks)})}\n\n"
