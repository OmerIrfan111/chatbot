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

    # ── Fresh FAISS store — injected before TestClient starts ─────────────
    from app.vectorstore import FAISSVectorStore

    fresh_store = FAISSVectorStore(path=str(tmp_path / "faiss"))
    main_module._store = fresh_store  # get_store() returns this; no OldPath loading

    # ── Reset process-wide Phase 6 caches so tests don't cross-contaminate ─
    from app.semantic_cache import semantic_cache
    import app.suggestions as suggestions_module

    semantic_cache.clear()
    suggestions_module.clear_cache()

    yield

    # ── Restore originals ─────────────────────────────────────────────────
    main_module._store = None
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
    """TestClient with mocked OpenAI and a fresh store."""
    from app.main import app
    with TestClient(app) as c:
        yield c
