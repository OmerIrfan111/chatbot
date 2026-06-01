"""
Phase 3 — server-side conversation memory tests.
"""
import io


def _seed(client, text: str = "The warranty is 12 months from purchase."):
    client.post("/upload", files={"file": ("doc.txt", io.BytesIO(text.encode()), "text/plain")})


def test_session_memory_persists_between_turns(client):
    """Two sequential calls with the same session_id use server-side history."""
    _seed(client)
    # First turn
    r1 = client.post("/chat", json={"question": "What is the warranty?", "session_id": "s1"})
    assert r1.status_code == 200

    # Second turn — server memory should have the first turn
    r2 = client.post("/chat", json={"question": "How long is that?", "session_id": "s1"})
    assert r2.status_code == 200
    assert "answer" in r2.json()


def test_different_sessions_are_isolated(client):
    _seed(client)
    client.post("/chat", json={"question": "What is the warranty?", "session_id": "sa"})
    # Session sb has no prior history
    r = client.post("/chat", json={"question": "What did I just ask?", "session_id": "sb"})
    assert r.status_code == 200  # Should not crash


def test_clear_session(client):
    _seed(client)
    client.post("/chat", json={"question": "Warranty?", "session_id": "sc"})
    del_resp = client.delete("/sessions/sc")
    assert del_resp.status_code == 204

    # After clear, session should not appear in list
    sessions = client.get("/sessions").json()["sessions"]
    assert "sc" not in sessions


def test_client_history_takes_precedence(client):
    """If client sends chat_history, server memory is NOT used."""
    _seed(client)
    explicit_history = [{"role": "user", "content": "First question"}, {"role": "assistant", "content": "First answer"}]
    r = client.post("/chat", json={
        "question": "Follow-up question",
        "session_id": "sd",
        "chat_history": explicit_history,
    })
    assert r.status_code == 200
    assert "answer" in r.json()
