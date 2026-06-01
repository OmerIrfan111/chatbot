from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Text
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


class ChunkMetadata(Base):
    """Persists chunk text + metadata so citations survive FAISS rebuilds."""
    __tablename__ = "chunk_metadata"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page = Column(Integer, nullable=False, default=1)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, default="default")
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Interaction(Base):
    """Persists every Q&A turn for analytics and the admin dashboard."""
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    low_confidence_warning = Column(Boolean, default=False)
    is_refusal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Feedback(Base):
    """Thumbs up (+1) / thumbs down (-1) per interaction."""
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    interaction_id = Column(
        Integer,
        ForeignKey("interactions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    rating = Column(Integer, nullable=False)  # 1 = thumbs up, -1 = thumbs down
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
