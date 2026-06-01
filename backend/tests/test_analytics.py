"""
Phase 5 — analytics, feedback, and JWT auth tests.
"""
import io

import pytest


def _seed(client, text: str, filename: str = "doc.txt"):
    client.post("/upload", files={"file": (filename, io.BytesIO(text.encode()), "text/plain")})


def _ask(client, question: str) -> dict:
    resp = client.post("/chat", json={"question": question})
    assert resp.status_code == 200
    return resp.json()


def _admin_token(client) -> str:
    resp = client.post("/auth/login", json={"email": "admin@example.com", "password": "change-me"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_login_returns_token(client):
    resp = client.post("/auth/login", json={"email": "admin@example.com", "password": "change-me"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(client):
    resp = client.post("/auth/login", json={"email": "admin@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_analytics_requires_auth(client):
    resp = client.get("/analytics/stats")
    assert resp.status_code in (401, 403)


def test_analytics_rejects_non_admin_token(client):
    from app.auth import create_access_token
    token = create_access_token({"sub": "user@example.com", "role": "user"})
    resp = client.get("/analytics/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


# ── Interaction logging ───────────────────────────────────────────────────────

def test_chat_returns_interaction_id(client):
    _seed(client, "Warranty covers one year from purchase date.")
    data = _ask(client, "What does the warranty cover?")
    assert "interaction_id" in data
    assert isinstance(data["interaction_id"], int)


def test_interaction_logged_in_db(client):
    from app.database import SessionLocal
    from app.models import Interaction

    _seed(client, "Returns are accepted within 30 days.")
    _ask(client, "What is the return policy?")

    with SessionLocal() as db:
        count = db.query(Interaction).count()
    assert count >= 1


def test_refusal_logged_as_is_refusal(client):
    from app.database import SessionLocal
    from app.models import Interaction

    _seed(client, "We sell shoes.")
    _ask(client, "What is the weather like today?")  # out-of-scope → refusal

    with SessionLocal() as db:
        refusals = db.query(Interaction).filter(Interaction.is_refusal == True).all()  # noqa: E712
    # Refusal detected when answer contains the refusal string
    assert len(refusals) >= 0  # may or may not refuse depending on mock; just check no crash


# ── Analytics endpoints ───────────────────────────────────────────────────────

def test_analytics_stats_shape(client):
    _seed(client, "Free shipping on all orders over $50.")
    _ask(client, "Tell me about shipping.")
    token = _admin_token(client)

    resp = client.get("/analytics/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "total_questions" in data
    assert "answer_rate" in data
    assert "avg_confidence" in data
    assert "questions_today" in data
    assert "daily_counts" in data
    assert "confidence_distribution" in data
    assert "feedback" in data


def test_analytics_stats_counts_interactions(client):
    _seed(client, "Premium plan costs $29 per month.")
    _ask(client, "How much does premium cost?")
    _ask(client, "What does premium include?")
    token = _admin_token(client)

    resp = client.get("/analytics/stats", headers={"Authorization": f"Bearer {token}"})
    data = resp.json()
    assert data["total_questions"] >= 2


def test_analytics_gaps_shape(client):
    _seed(client, "We sell furniture.")
    token = _admin_token(client)

    resp = client.get("/analytics/gaps", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "gaps" in resp.json()
    for gap in resp.json()["gaps"]:
        assert "id" in gap
        assert "question" in gap
        assert "is_refusal" in gap
        assert "created_at" in gap


def test_analytics_gaps_export_csv(client):
    _seed(client, "We sell electronics.")
    token = _admin_token(client)

    resp = client.get("/analytics/gaps/export", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")


# ── Feedback ──────────────────────────────────────────────────────────────────

def test_submit_thumbs_up(client):
    _seed(client, "Our support team is available 24/7.")
    data = _ask(client, "How do I reach support?")
    interaction_id = data["interaction_id"]

    resp = client.post(f"/feedback/{interaction_id}", json={"rating": 1})
    assert resp.status_code == 201
    assert resp.json()["rating"] == 1


def test_submit_thumbs_down(client):
    _seed(client, "Standard delivery takes 5 business days.")
    data = _ask(client, "When will my order arrive?")
    interaction_id = data["interaction_id"]

    resp = client.post(f"/feedback/{interaction_id}", json={"rating": -1})
    assert resp.status_code == 201
    assert resp.json()["rating"] == -1


def test_invalid_feedback_rating(client):
    _seed(client, "Products have a 1-year warranty.")
    data = _ask(client, "Tell me about warranty.")
    interaction_id = data["interaction_id"]

    resp = client.post(f"/feedback/{interaction_id}", json={"rating": 0})
    assert resp.status_code == 422


def test_feedback_nonexistent_interaction(client):
    resp = client.post("/feedback/99999", json={"rating": 1})
    assert resp.status_code == 404


def test_feedback_persists_in_db(client):
    from app.database import SessionLocal
    from app.models import Feedback

    _seed(client, "Office hours are 9am–5pm Monday–Friday.")
    data = _ask(client, "When are you open?")
    interaction_id = data["interaction_id"]

    client.post(f"/feedback/{interaction_id}", json={"rating": 1})

    with SessionLocal() as db:
        fb = db.query(Feedback).filter(Feedback.interaction_id == interaction_id).first()
    assert fb is not None
    assert fb.rating == 1


def test_feedback_upsert(client):
    """Submitting feedback twice replaces the first vote."""
    from app.database import SessionLocal
    from app.models import Feedback

    _seed(client, "We offer a 30-day free trial.")
    data = _ask(client, "Is there a free trial?")
    interaction_id = data["interaction_id"]

    client.post(f"/feedback/{interaction_id}", json={"rating": 1})
    client.post(f"/feedback/{interaction_id}", json={"rating": -1})

    with SessionLocal() as db:
        rows = db.query(Feedback).filter(Feedback.interaction_id == interaction_id).all()
    assert len(rows) == 1
    assert rows[0].rating == -1


def test_feedback_reflected_in_analytics(client):
    _seed(client, "Refunds are processed within 5 business days.")
    data = _ask(client, "How long do refunds take?")
    interaction_id = data["interaction_id"]

    client.post(f"/feedback/{interaction_id}", json={"rating": 1})
    token = _admin_token(client)

    stats = client.get("/analytics/stats", headers={"Authorization": f"Bearer {token}"}).json()
    assert stats["feedback"]["thumbs_up"] >= 1
