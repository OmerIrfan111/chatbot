"""
Phase 6 — semantic cache tests.

Unit tests for the cache itself, plus an end-to-end check that a near-duplicate
question is served from cache without a second LLM call.
"""
import io

from app.semantic_cache import SemanticCache


def _seed(client, text: str, filename: str = "doc.txt"):
    client.post("/upload", files={"file": (filename, io.BytesIO(text.encode()), "text/plain")})


# ── Unit: cache class ─────────────────────────────────────────────────────────

def test_cache_hit_on_near_duplicate():
    cache = SemanticCache(threshold=0.95, max_size=10)
    cache.put("s1", [1.0, 0.0, 0.0], {"answer": "cached answer"})
    hit = cache.get("s1", [0.99, 0.01, 0.0])  # nearly identical direction
    assert hit is not None
    assert hit["answer"] == "cached answer"
    assert hit["cached"] is True


def test_cache_miss_on_distinct_vector():
    cache = SemanticCache(threshold=0.95, max_size=10)
    cache.put("s1", [1.0, 0.0, 0.0], {"answer": "cached answer"})
    assert cache.get("s1", [0.0, 1.0, 0.0]) is None


def test_cache_is_session_scoped():
    cache = SemanticCache(threshold=0.95, max_size=10)
    cache.put("s1", [1.0, 0.0], {"answer": "for s1"})
    assert cache.get("s2", [1.0, 0.0]) is None  # different session, no leak


def test_cache_clear():
    cache = SemanticCache(threshold=0.95)
    cache.put("s1", [1.0, 0.0], {"answer": "x"})
    cache.clear()
    assert cache.get("s1", [1.0, 0.0]) is None


# ── End-to-end: /chat serves repeats from cache (no extra LLM call) ───────────

def test_repeated_question_served_from_cache(client, mock_openai):
    _seed(client, "Returns are accepted within 30 days of purchase.")

    first = client.post("/chat", json={"question": "What is the return policy?"})
    assert first.status_code == 200
    assert not first.json().get("cached", False)
    calls_after_first = mock_openai.chat.invoke.call_count
    assert calls_after_first >= 1

    # Identical question → identical embedding (mock) → cache hit, no new LLM call.
    second = client.post("/chat", json={"question": "What is the return policy?"})
    assert second.status_code == 200
    assert second.json().get("cached") is True
    assert mock_openai.chat.invoke.call_count == calls_after_first
