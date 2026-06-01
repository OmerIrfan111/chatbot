"""
Phase 6 — suggestions, multilingual answers, and human-escalation handoff.
"""
import io
from unittest.mock import MagicMock

from app.chain import detect_language
from app.suggestions import _parse_questions


def _seed(client, text: str, filename: str = "doc.txt"):
    client.post("/upload", files={"file": (filename, io.BytesIO(text.encode()), "text/plain")})


def _admin_token(client):
    resp = client.post("/auth/login", json={"email": "admin@example.com", "password": "change-me"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


# ── Suggested starter questions ───────────────────────────────────────────────

def test_parse_questions_from_json_array():
    raw = '["How do I return an item?", "What is the warranty?"]'
    qs = _parse_questions(raw, n=4)
    assert qs == ["How do I return an item?", "What is the warranty?"]


def test_parse_questions_from_prose_with_embedded_array():
    raw = 'Sure! Here you go:\n["Can I cancel?", "Where is my order?"] — enjoy.'
    qs = _parse_questions(raw, n=4)
    assert qs == ["Can I cancel?", "Where is my order?"]


def test_suggestions_endpoint_returns_questions(client, mock_openai):
    _seed(client, "Returns are accepted within 30 days. Shipping is free over $50.")

    json_response = MagicMock()
    json_response.content = '["What is the return window?", "Is shipping free?"]'
    mock_openai.chat.invoke.return_value = json_response

    resp = client.get("/suggestions")
    assert resp.status_code == 200
    suggestions = resp.json()["suggestions"]
    assert "What is the return window?" in suggestions


def test_suggestions_empty_when_no_docs(client):
    resp = client.get("/suggestions")
    assert resp.status_code == 200
    assert resp.json()["suggestions"] == []


# ── Language detection / multilingual ─────────────────────────────────────────

def test_detect_language_english():
    assert detect_language("What is the return policy for my order?") == "en"


def test_detect_language_spanish():
    assert detect_language("¿Cuál es la política de devoluciones de mi pedido?") == "es"


def test_chat_response_includes_language_field(client):
    _seed(client, "Returns are accepted within 30 days of purchase.")
    resp = client.post("/chat", json={"question": "What is the return policy?"})
    assert resp.status_code == 200
    assert "language" in resp.json()


# ── Escalation / human handoff ────────────────────────────────────────────────

def test_chat_response_includes_escalation_offer(client):
    _seed(client, "Our office is open Monday to Friday.")
    resp = client.post("/chat", json={"question": "Tell me about something unrelated."})
    assert resp.status_code == 200
    assert "escalation_offered" in resp.json()
    assert isinstance(resp.json()["escalation_offered"], bool)


def test_escalate_creates_ticket(client):
    resp = client.post(
        "/escalate",
        json={
            "session_id": "s1",
            "question": "I need a refund for a damaged item",
            "contact": "user@example.com",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["ticket_id"] >= 1
    assert body["status"] == "open"


def test_ticket_persists_and_listed_for_admin(client):
    client.post("/escalate", json={"session_id": "s1", "question": "Help me please"})
    token = _admin_token(client)
    resp = client.get("/tickets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    tickets = resp.json()["tickets"]
    assert len(tickets) == 1
    assert tickets[0]["question"] == "Help me please"


def test_tickets_rejects_non_admin(client):
    resp = client.get("/tickets")
    assert resp.status_code in (401, 403)
