"""
Auto-suggested starter questions (Phase 6).

Samples the ingested chunks and asks the LLM for a few FAQ-style questions a
customer might plausibly ask. Cached by an index signature (chunk count) so we
don't pay for an LLM call on every page load; the cache invalidates whenever
documents are added or removed.
"""
import json
import logging
import re

from langchain.schema import HumanMessage, SystemMessage

from app.llm import get_chat_model
from app.vectorstore import FAISSVectorStore

logger = logging.getLogger(__name__)

_SUGGEST_SYSTEM = (
    "You generate short FAQ-style starter questions for a customer-support chatbot. "
    "Given excerpts from a company's documentation, produce questions a real customer "
    "would ask that the docs can answer. Return ONLY a JSON array of strings."
)

# signature -> list[str]
_cache: dict[str, list[str]] = {}


def _signature(store: FAISSVectorStore) -> str:
    n = store.index.ntotal if store.index is not None else 0
    return f"{n}:{len(store.chunks)}"


def _sample_context(store: FAISSVectorStore, max_chunks: int = 12, max_chars: int = 4000) -> str:
    # Spread the sample across the corpus rather than taking the first N chunks.
    chunks = store.chunks
    if not chunks:
        return ""
    step = max(1, len(chunks) // max_chunks)
    picked = chunks[::step][:max_chunks]
    text = "\n\n".join(c.text for c in picked)
    return text[:max_chars]


def _parse_questions(raw: str, n: int) -> list[str]:
    raw = raw.strip()
    # Prefer a clean JSON array.
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            qs = [str(q).strip() for q in data if str(q).strip()]
            if qs:
                return qs[:n]
    except (json.JSONDecodeError, TypeError):
        pass
    # Fallback: pull the first JSON array embedded in prose.
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, list):
                qs = [str(q).strip() for q in data if str(q).strip()]
                if qs:
                    return qs[:n]
        except json.JSONDecodeError:
            pass
    # Last resort: split lines that look like questions.
    lines = [
        re.sub(r"^[\s\-\d.)]+", "", ln).strip()
        for ln in raw.splitlines()
        if ln.strip()
    ]
    return [ln for ln in lines if ln.endswith("?")][:n]


def generate_suggestions(store: FAISSVectorStore, n: int = 4) -> list[str]:
    if not store.chunks:
        return []

    sig = _signature(store)
    if sig in _cache:
        return _cache[sig][:n]

    context = _sample_context(store)
    if not context:
        return []

    user = (
        f"Documentation excerpts:\n{context}\n\n"
        f"Generate exactly {n} starter questions as a JSON array of strings."
    )
    try:
        model = get_chat_model()
        resp = model.invoke([
            SystemMessage(content=_SUGGEST_SYSTEM),
            HumanMessage(content=user),
        ])
        raw = resp.content if isinstance(resp.content, str) else str(resp.content)
        questions = _parse_questions(raw, n)
    except Exception as exc:
        logger.warning("Suggestion generation failed: %s", exc)
        return []

    if questions:
        _cache[sig] = questions
    return questions


def clear_cache() -> None:
    _cache.clear()
