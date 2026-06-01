"""
Phase 6 — hybrid retrieval (dense + BM25 fusion) tests.

These exercise the pure retrieval functions directly with synthetic chunks so
the behaviour is deterministic and doesn't depend on the real embedding model.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import app.retriever as retriever
from app.retriever import (
    _bm25_order,
    _reciprocal_rank_fusion,
    hybrid_retrieve,
)
from app.vectorstore import Chunk


def _make_store():
    """Five chunks whose dense cosine order is C0>C1>C2>C3>C4.

    Only C3 carries the lexical keyword 'refundcode', so BM25 ranks it first.
    """
    embs = [
        [1.0, 0.0],   # C0  cos 1.0
        [0.9, 0.436], # C1  cos ~0.9
        [0.7, 0.714], # C2  cos ~0.7
        [0.3, 0.954], # C3  cos ~0.3  (keyword chunk)
        [0.1, 0.995], # C4  cos ~0.1
    ]
    texts = [
        "alpha beta general information",
        "gamma delta general information",
        "epsilon zeta general information",
        "refundcode policy details and steps",
        "eta theta general information",
    ]
    chunks = [
        Chunk(text=t, metadata={"document_id": 1, "filename": "d.txt", "page": 1, "chunk_index": i}, embedding=e)
        for i, (t, e) in enumerate(zip(texts, embs))
    ]
    return SimpleNamespace(chunks=chunks, index=None)


def _patched_embeddings():
    emb = MagicMock()
    emb.embed_query.return_value = [1.0, 0.0]  # query aligns with C0
    return emb


# ── RRF unit ────────────────────────────────────────────────────────────────

def test_rrf_fuses_two_rankings():
    dense = [0, 1, 2]
    bm25 = [2, 1, 0]
    fused = _reciprocal_rank_fusion([(dense, 1.0), (bm25, 1.0)], rrf_k=60)
    # Items 0 and 2 are rank-0 in one list each → they tie at the top; item 1
    # (never rank-0) ends up last.
    assert set(fused) == {0, 1, 2}
    assert fused[-1] == 1


def test_bm25_order_ranks_keyword_chunk_first():
    store = _make_store()
    order = _bm25_order("refundcode policy", store.chunks)
    assert order[0] == 3  # the only chunk containing 'refundcode'


# ── Hybrid beats dense-only on a keyword query ────────────────────────────────

def test_hybrid_surfaces_keyword_chunk_that_dense_misses():
    store = _make_store()

    with patch.object(retriever, "get_embeddings", _patched_embeddings):
        # Dense-only: hybrid disabled → BM25 ignored.
        original = retriever.settings.hybrid_enabled
        try:
            retriever.settings.hybrid_enabled = False
            dense_only = hybrid_retrieve("refundcode policy", store, k=2)
            dense_idx = {c.metadata["chunk_index"] for c, _ in dense_only}

            retriever.settings.hybrid_enabled = True
            hybrid = hybrid_retrieve("refundcode policy", store, k=2)
            hybrid_idx = {c.metadata["chunk_index"] for c, _ in hybrid}
        finally:
            retriever.settings.hybrid_enabled = original

    # The keyword chunk (index 3) is missed by dense-only but found by hybrid.
    assert 3 not in dense_idx
    assert 3 in hybrid_idx


def test_hybrid_returns_cosine_scores_in_unit_range():
    store = _make_store()
    with patch.object(retriever, "get_embeddings", _patched_embeddings):
        results = hybrid_retrieve("refundcode policy", store, k=5)
    assert results
    for _, score in results:
        assert -1.0001 <= score <= 1.0001


def test_hybrid_empty_store_returns_empty():
    empty = SimpleNamespace(chunks=[], index=None)
    with patch.object(retriever, "get_embeddings", _patched_embeddings):
        assert hybrid_retrieve("anything", empty, k=5) == []
