from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Feedback, Interaction


def get_stats(db: Session) -> dict:
    total = db.query(func.count(Interaction.id)).scalar() or 0
    answered = (
        db.query(func.count(Interaction.id))
        .filter(Interaction.is_refusal == False)  # noqa: E712
        .scalar() or 0
    )
    avg_conf = (
        db.query(func.avg(Interaction.confidence))
        .filter(Interaction.is_refusal == False)  # noqa: E712
        .scalar()
    )
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = (
        db.query(func.count(Interaction.id))
        .filter(Interaction.created_at >= today)
        .scalar() or 0
    )
    return {
        "total_questions": total,
        "answer_rate": round(answered / total, 3) if total else 0.0,
        "avg_confidence": round(float(avg_conf), 3) if avg_conf is not None else 0.0,
        "questions_today": today_count,
    }


def get_daily_counts(db: Session, days: int = 7) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            func.date(Interaction.created_at).label("date"),
            func.count(Interaction.id).label("count"),
        )
        .filter(Interaction.created_at >= since)
        .group_by(func.date(Interaction.created_at))
        .order_by(func.date(Interaction.created_at))
        .all()
    )
    return [{"date": str(r.date), "count": r.count} for r in rows]


def get_confidence_distribution(db: Session) -> dict:
    base = db.query(func.count(Interaction.id)).filter(Interaction.is_refusal == False)  # noqa: E712
    high = base.filter(Interaction.confidence >= 0.85).scalar() or 0
    mid = base.filter(
        Interaction.confidence >= 0.70, Interaction.confidence < 0.85
    ).scalar() or 0
    low = base.filter(Interaction.confidence < 0.70).scalar() or 0
    return {"high": high, "medium": mid, "low": low}


def get_gaps(db: Session, limit: int = 100) -> list[dict]:
    rows = (
        db.query(Interaction)
        .filter(
            (Interaction.is_refusal == True)  # noqa: E712
            | (Interaction.low_confidence_warning == True)  # noqa: E712
        )
        .order_by(Interaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "question": r.question,
            "confidence": r.confidence,
            "is_refusal": r.is_refusal,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def get_feedback_stats(db: Session) -> dict:
    up = db.query(func.count(Feedback.id)).filter(Feedback.rating == 1).scalar() or 0
    down = db.query(func.count(Feedback.id)).filter(Feedback.rating == -1).scalar() or 0
    return {"thumbs_up": up, "thumbs_down": down, "total": up + down}
