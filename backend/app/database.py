from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base
from app.config import get_settings
import os

settings = get_settings()


def _make_engine():
    url = settings.database_url
    kwargs = {}
    if url.startswith("sqlite"):
        # ensure the data dir exists
        db_path = url.replace("sqlite:///", "")
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


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
