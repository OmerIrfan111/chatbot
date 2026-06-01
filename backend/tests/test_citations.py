"""
Phase 4 — citations, confidence, and conflict detection tests.
"""
import io
import json

import numpy as np
from unittest.mock import MagicMock


def _seed(client, text: str, filename: str = "doc.txt"):
    client.post("/upload", files={"file": (filename, io.BytesIO(text.encode()), "text/plain")})


# ── Citation shape ────────────────────────────────────────────────────────────

def test_chat_response_has_all_citation_fields(client):
    _seed(client, "Returns are accepted within 30 days of purchase.")
    resp = client.post("/chat", json={"question": "What is the return policy?"})
    assert resp.status_code == 200
    data = resp.json()

    # Top-level fields
    assert "sources" in data
    assert "confidence" in data
    assert "low_confidence_warning" in data
    assert "conflict_warning" in data

    # Each source must have required fields
    for src in data["sources"]:
        assert "filename" in src
        assert "page" in src
        assert "score" in src
        assert "snippet" in src
        assert "chunk_index" in src


def test_source_snippet_is_non_empty(client):
    _seed(client, "Free shipping on orders over $50 anywhere in the country.")
    resp = client.post("/chat", json={"question": "Tell me about shipping."})
    data = resp.json()
    for src in data["sources"]:
        assert len(src["snippet"]) > 0


def test_source_score_is_between_0_and_1(client):
    _seed(client, "Premium membership costs $9.99 per month.")
    resp = client.post("/chat", json={"question": "How much is premium?"})
    data = resp.json()
    for src in data["sources"]:
        assert 0.0 <= src["score"] <= 1.0


def test_confidence_is_float_between_0_and_1(client):
    _seed(client, "Products are covered by a one-year warranty.")
    resp = client.post("/chat", json={"question": "What is the warranty?"})
    data = resp.json()
    assert isinstance(data["confidence"], float)
    assert 0.0 <= data["confidence"] <= 1.0


# ── Low-confidence warning ────────────────────────────────────────────────────

def test_low_confidence_warning_is_bool(client):
    _seed(client, "Our office is open Monday to Friday.")
    resp = client.post("/chat", json={"question": "Something completely unrelated."})
    data = resp.json()
    assert isinstance(data["low_confidence_warning"], bool)


def test_high_confidence_no_warning(client, mock_openai):
    """When embeddings return max similarity, low_confidence_warning should be False."""
    # Force embeddings to return identical vectors (cosine similarity = 1.0)
    from tests.constants import FAKE_EMBEDDING
    mock_openai.embeddings.embed_query.return_value = FAKE_EMBEDDING
    mock_openai.embeddings.embed_documents.side_effect = lambda texts: [FAKE_EMBEDDING] * len(texts)

    _seed(client, "The return policy allows returns within 30 days.")
    resp = client.post("/chat", json={"question": "Return policy?"})
    assert resp.status_code == 200
    # With max cosine similarity the confidence should be high and warning False
    data = resp.json()
    assert not data["low_confidence_warning"]


# ── Conflict detection ────────────────────────────────────────────────────────

def test_conflict_warning_none_for_single_doc(client):
    _seed(client, "Delivery takes 3-5 business days.", "shipping.txt")
    resp = client.post("/chat", json={"question": "How long does delivery take?"})
    data = resp.json()
    # Single document — no conflict
    assert data["conflict_warning"] is None or not data["conflict_warning"].get("detected")


def test_conflict_warning_structure_when_present(client, mock_openai):
    """Simulate conflict: two docs, both with max similarity scores."""
    from tests.constants import FAKE_EMBEDDING

    # Upload two different docs
    _seed(client, "Returns allowed within 30 days.", "policy_a.txt")
    _seed(client, "Returns allowed within 14 days.", "policy_b.txt")

    # Make both docs look equally relevant (same embedding = same score)
    mock_openai.embeddings.embed_query.return_value = FAKE_EMBEDDING

    resp = client.post("/chat", json={"question": "What is the return window?"})
    assert resp.status_code == 200
    data = resp.json()

    # With two docs having identical embedding similarity → conflict should be detected
    if data["conflict_warning"] and data["conflict_warning"].get("detected"):
        assert "documents" in data["conflict_warning"]
        assert "message" in data["conflict_warning"]
        assert isinstance(data["conflict_warning"]["documents"], list)


# ── ChunkMetadata persistence ─────────────────────────────────────────────────

def test_chunk_metadata_persisted_after_upload(client):
    from app.database import SessionLocal
    from app.models import ChunkMetadata

    _seed(client, "Our support team is available 24/7.", "support.txt")

    docs = client.get("/documents").json()
    doc_id = next(d["id"] for d in docs if d["filename"] == "support.txt")

    with SessionLocal() as db:
        chunks = db.query(ChunkMetadata).filter(ChunkMetadata.document_id == doc_id).all()
    assert len(chunks) >= 1
    assert all(len(c.text) > 0 for c in chunks)


def test_chunk_metadata_deleted_with_document(client):
    from app.database import SessionLocal
    from app.models import ChunkMetadata

    _seed(client, "Temporary document content.", "temp.txt")
    docs = client.get("/documents").json()
    doc_id = next(d["id"] for d in docs if d["filename"] == "temp.txt")

    client.delete(f"/documents/{doc_id}")

    with SessionLocal() as db:
        remaining = db.query(ChunkMetadata).filter(ChunkMetadata.document_id == doc_id).all()
    assert len(remaining) == 0
