from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(nullable=False)
    content_type: Mapped[str] = mapped_column(nullable=False, default="")
    chunk_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))


class ChunkMetadata(Base):
    """Persists chunk text + metadata so citations survive FAISS rebuilds."""
    __tablename__ = "chunk_metadata"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    page: Mapped[int] = mapped_column(nullable=False, default=1)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(index=True, default="default")
    role: Mapped[str] = mapped_column(nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Mapped[float] + explicit nullable=True avoids SQLAlchemy's union-type
    # resolution (which crashes on Python 3.14); column still allows NULL.
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))


class Interaction(Base):
    """Persists every Q&A turn for analytics and the admin dashboard."""
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(index=True, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    low_confidence_warning: Mapped[bool] = mapped_column(default=False)
    is_refusal: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))


class Feedback(Base):
    """Thumbs up (+1) / thumbs down (-1) per interaction."""
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    interaction_id: Mapped[int] = mapped_column(
        ForeignKey("interactions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    rating: Mapped[int] = mapped_column(nullable=False)  # 1 = thumbs up, -1 = thumbs down
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))


class Ticket(Base):
    """Human-escalation ticket raised when the bot can't answer confidently."""
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(index=True, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional link back to the low-confidence interaction that triggered it.
    interaction_id: Mapped[int] = mapped_column(Integer, nullable=True)
    contact: Mapped[str] = mapped_column(default="")  # email / phone, optional
    reason: Mapped[str] = mapped_column(default="low_confidence")
    status: Mapped[str] = mapped_column(default="open")  # open | resolved
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
