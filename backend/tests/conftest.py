"""
Shared fixtures — mock OpenAI so tests never hit the real API.
"""
import os
import tempfile
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.constants import FAKE_EMBEDDING, FAKE_DIM  # noqa: F401  (re-exported for legacy imports)


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path):
    """
    Give each test its own fresh FAISS store and SQLite DB.
    Injects them directly into the app modules so module-level
    settings variables (set at import time) are bypassed.
    """
    db_url = f"sqlite:///{tmp_path}/test.db"

    # ── Fresh database ────────────────────────────────────────────────────
    import app.database as db_module
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models import Base

    from sqlalchemy import event as sa_event

    new_engine = create_engine(db_url, connect_args={"check_same_thread": False})

    @sa_event.listens_for(new_engine, "connect")
    def _fk_pragma(dbapi_conn, _rec):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=new_engine)
    new_session = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)
    old_engine = db_module.engine
    old_session = db_module.SessionLocal
    db_module.engine = new_engine
    db_module.SessionLocal = new_session

    # Also patch SessionLocal in modules that imported it at load time
    import app.ingest as ingest_module
    import app.main as main_module
    old_ingest_session = ingest_module.SessionLocal
    old_main_session = main_module.SessionLocal
    ingest_module.SessionLocal = new_session
    main_module.SessionLocal = new_session

    # ── Per-tenant FAISS stores under a fresh temp dir ────────────────────
    from app.config import get_settings

    app_settings = get_settings()
    old_vs_path = app_settings.vector_store_path
    app_settings.vector_store_path = str(tmp_path / "vs")
    main_module._stores.clear()  # registry rebuilt lazily per tenant

    # ── Reset process-wide caches + rate limiter (avoid cross-test bleed) ──
    from app.semantic_cache import semantic_cache
    import app.suggestions as suggestions_module
    import app.ratelimit as ratelimit_module

    semantic_cache.clear()
    suggestions_module.clear_cache()
    ratelimit_module._limiter = None  # rebuilt from current settings on demand

    yield

    # ── Restore originals ─────────────────────────────────────────────────
    main_module._stores.clear()
    app_settings.vector_store_path = old_vs_path
    db_module.engine = old_engine
    db_module.SessionLocal = old_session
    ingest_module.SessionLocal = old_ingest_session
    main_module.SessionLocal = old_main_session


@pytest.fixture()
def mock_openai():
    """
    Patch both OpenAIEmbeddings and ChatOpenAI so no real API calls are made.
    Returns a namespace with .embeddings and .chat mock objects.
    """
    fake_response = MagicMock()
    fake_response.content = (
        "According to the document, the answer is found in the provided context."
    )

    # Patch at point-of-use so from-imports in each module are covered.
    with (
        patch("app.ingest.get_embeddings") as _emb1,
        patch("app.retriever.get_embeddings") as _emb2,
        patch("app.main.get_embeddings") as _emb3,
        patch("app.chain.get_chat_model") as _chat,
        patch("app.suggestions.get_chat_model") as _chat2,
    ):
        embeddings = MagicMock()
        embeddings.embed_documents.side_effect = lambda texts: [FAKE_EMBEDDING] * len(texts)
        embeddings.embed_query.return_value = FAKE_EMBEDDING

        chat = MagicMock()
        chat.invoke.return_value = fake_response

        _emb1.return_value = embeddings
        _emb2.return_value = embeddings
        _emb3.return_value = embeddings
        _chat.return_value = chat
        _chat2.return_value = chat

        ns = MagicMock()
        ns.embeddings = embeddings
        ns.chat = chat
        yield ns


@pytest.fixture()
def client(mock_openai):
    """TestClient authenticated as a default-tenant user (Phase 7).

    A baked-in Authorization header keeps the pre-Phase-7 tests (which call
    /upload, /chat, etc. without a token) working. Per-request headers — e.g.
    an admin token from /auth/login — override this default in httpx.
    """
    from app.auth import create_access_token
    from app.main import app

    token = create_access_token({"sub": "user@default", "role": "user", "tenant_id": "default"})
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as c:
        yield c


@pytest.fixture()
def anon_client(mock_openai):
    """TestClient with no auth header — for testing 401 on protected routes."""
    from app.main import app
    with TestClient(app) as c:
        yield c


def make_token(tenant_id: str = "default", role: str = "user", sub: str = "u") -> str:
    """Helper for tests that need a token for a specific tenant/role."""
    from app.auth import create_access_token
    return create_access_token({"sub": sub, "role": role, "tenant_id": tenant_id})
