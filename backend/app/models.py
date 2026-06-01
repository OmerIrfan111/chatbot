from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import declarative_base
from datetime import datetime, timezone

Base = declarative_base()


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False, default="")
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, default="default")
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
