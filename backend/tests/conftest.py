"""
Shared fixtures — mock OpenAI so tests never hit the real API.
"""
import os
import tempfile
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

# Fake 1536-dim embedding (text-embedding-3-small dimension)
FAKE_DIM = 1536
FAKE_EMBEDDING = (np.random.default_rng(42).random(FAKE_DIM)).tolist()


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

    new_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=new_engine)
    old_engine = db_module.engine
    old_session = db_module.SessionLocal
    db_module.engine = new_engine
    db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)

    # ── Fresh FAISS store — injected before TestClient starts ─────────────
    from app.vectorstore import FAISSVectorStore
    import app.main as main_module

    fresh_store = FAISSVectorStore(path=str(tmp_path / "faiss"))
    main_module._store = fresh_store  # get_store() returns this; no OldPath loading

    yield

    # ── Restore originals ─────────────────────────────────────────────────
    main_module._store = None
    db_module.engine = old_engine
    db_module.SessionLocal = old_session


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

    # Patch at point-of-use so from-imports in chain/ingest/retriever are covered
    with (
        patch("app.ingest.get_embeddings") as _emb1,
        patch("app.retriever.get_embeddings") as _emb2,
        patch("app.chain.get_chat_model") as _chat,
    ):
        embeddings = MagicMock()
        embeddings.embed_documents.side_effect = lambda texts: [FAKE_EMBEDDING] * len(texts)
        embeddings.embed_query.return_value = FAKE_EMBEDDING

        chat = MagicMock()
        chat.invoke.return_value = fake_response

        _emb1.return_value = embeddings
        _emb2.return_value = embeddings
        _chat.return_value = chat

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
