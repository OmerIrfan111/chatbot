"""
Optional cross-encoder reranker (Phase 6).

Re-scores retrieved (chunk, score) pairs with a cross-encoder that reads the
query and chunk *together*, which is far more precise than the bi-encoder
cosine used for first-stage retrieval.

Heavy by design (sentence-transformers pulls in torch), so it is **off by
default** and lazily imported. When disabled or unavailable, callers get the
original ordering back unchanged — retrieval never hard-fails on a missing
optional dependency.
"""
import logging
from typing import Optional

from app.config import get_settings
from app.vectorstore import Chunk

logger = logging.getLogger(__name__)
settings = get_settings()

_model = None  # cached CrossEncoder instance
_load_failed = False


def _get_cross_encoder():
    global _model, _load_failed
    if _model is not None or _load_failed:
        return _model
    try:
        from sentence_transformers import CrossEncoder  # type: ignore

        _model = CrossEncoder(settings.reranker_model)
        logger.info("Loaded cross-encoder reranker: %s", settings.reranker_model)
    except Exception as exc:  # ImportError or model download failure
        _load_failed = True
        logger.warning("Reranker unavailable (%s) — falling back to fusion order.", exc)
    return _model


def maybe_rerank(
    query: str,
    results: list[tuple[Chunk, float]],
    k: Optional[int] = None,
) -> list[tuple[Chunk, float]]:
    """Reorder results with the cross-encoder when enabled; otherwise pass through."""
    if not settings.reranker_enabled or len(results) < 2:
        return results[:k] if k else results

    model = _get_cross_encoder()
    if model is None:
        return results[:k] if k else results

    pairs = [(query, chunk.text) for chunk, _ in results]
    try:
        ce_scores = model.predict(pairs)
    except Exception as exc:
        logger.warning("Reranker prediction failed (%s) — keeping fusion order.", exc)
        return results[:k] if k else results

    # Keep the original first-stage score on each chunk (used for confidence);
    # only the ordering changes.
    order = sorted(range(len(results)), key=lambda i: ce_scores[i], reverse=True)
    reranked = [results[i] for i in order]
    return reranked[:k] if k else reranked
