import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.config import get_settings

settings = get_settings()


def _make_engine():
    url = settings.database_url
    kwargs: dict = {}
    if url.startswith("sqlite"):
        db_path = url.replace("sqlite:///", "")
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        kwargs["connect_args"] = {"check_same_thread": False}

    eng = create_engine(url, **kwargs)

    # Enable foreign-key enforcement for SQLite (required for CASCADE deletes)
    if url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def _set_fk_pragma(dbapi_conn, _rec):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return eng


engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
