"""
Retrieval (Phase 6): hybrid dense + BM25 with reciprocal-rank fusion,
followed by an optional cross-encoder rerank.

The public `retrieve()` signature is unchanged — it still returns
`list[tuple[Chunk, cosine_score]]` so confidence/conflict logic downstream
keeps working. Cosine scores are computed directly from the stored chunk
embeddings, so every returned chunk carries a meaningful similarity even when
BM25 surfaced it.
"""
import re

import numpy as np

from app.config import get_settings
from app.llm import get_embeddings
from app.reranker import maybe_rerank
from app.vectorstore import Chunk, FAISSVectorStore

settings = get_settings()

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def _dense_scores(query_embedding: list[float], chunks: list[Chunk]) -> np.ndarray:
    """Cosine similarity of the query against every chunk embedding."""
    mat = np.array([c.embedding for c in chunks], dtype=np.float32)
    if mat.ndim != 2 or mat.shape[0] == 0:
        return np.zeros(len(chunks), dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1)
    norms[norms == 0] = 1.0
    mat_n = mat / norms[:, None]

    q = np.asarray(query_embedding, dtype=np.float32)
    qn = np.linalg.norm(q)
    if qn == 0:
        return np.zeros(len(chunks), dtype=np.float32)
    q = q / qn
    return mat_n @ q


def _bm25_order(query: str, chunks: list[Chunk]) -> list[int]:
    """Indices of chunks ranked best→worst by BM25 lexical relevance."""
    from rank_bm25 import BM25Okapi

    corpus = [_tokenize(c.text) for c in chunks]
    bm25 = BM25Okapi(corpus)
    scores = bm25.get_scores(_tokenize(query))
    return sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)


def _reciprocal_rank_fusion(
    ranked_lists: list[tuple[list[int], float]],
    rrf_k: int,
) -> list[int]:
    """Fuse several ranked index-lists into one order via weighted RRF."""
    fused: dict[int, float] = {}
    for order, weight in ranked_lists:
        for rank, idx in enumerate(order):
            fused[idx] = fused.get(idx, 0.0) + weight / (rrf_k + rank + 1)
    return sorted(fused, key=lambda i: fused[i], reverse=True)


def hybrid_retrieve(
    question: str,
    store: FAISSVectorStore,
    k: int = 5,
) -> list[tuple[Chunk, float]]:
    """Dense + BM25 fusion, then optional rerank. Returns (chunk, cosine_score)."""
    chunks = store.chunks
    if not chunks:
        return []

    query_embedding = get_embeddings().embed_query(question)
    dense = _dense_scores(query_embedding, chunks)
    dense_order = list(np.argsort(-dense))

    if settings.hybrid_enabled and len(chunks) > 1:
        bm25_order = _bm25_order(question, chunks)
        fused = _reciprocal_rank_fusion(
            [
                (dense_order, settings.dense_weight),
                (bm25_order, settings.bm25_weight),
            ],
            rrf_k=settings.rrf_k,
        )
    else:
        fused = dense_order

    # Take a candidate pool a bit wider than k so the reranker has room to work.
    pool = fused[: max(k * 2, k)]
    candidates = [(chunks[i], float(dense[i])) for i in pool]

    reranked = maybe_rerank(question, candidates, k=k)
    return reranked[:k]


def retrieve(
    question: str,
    store: FAISSVectorStore,
    k: int = 5,
) -> list[tuple[Chunk, float]]:
    """Embed question and return top-k (chunk, cosine_score) pairs (hybrid)."""
    return hybrid_retrieve(question, store, k=k)
