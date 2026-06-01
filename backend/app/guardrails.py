"""
Guardrails (Phase 7): PII redaction, profanity filtering, and prompt-injection
defense.

- PII redaction runs before anything is persisted to the analytics log, so raw
  emails / SSNs / cards never hit the database or app logs.
- Prompt-injection defense is structural: retrieved document text is untrusted,
  so we strip obvious override directives and the system prompt instructs the
  model to treat context as data only.
"""
import re

# ── PII redaction ─────────────────────────────────────────────────────────────

_PII_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("[REDACTED_EMAIL]", re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")),
    ("[REDACTED_SSN]", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("[REDACTED_CARD]", re.compile(r"\b(?:\d[ -]?){13,16}\b")),
    # International-ish phone numbers (kept after card so long digit runs match card first).
    ("[REDACTED_PHONE]", re.compile(r"\b(?:\+?\d{1,3}[ -]?)?(?:\(?\d{3}\)?[ -]?)\d{3}[ -]?\d{4}\b")),
]


def redact_pii(text: str) -> str:
    """Replace emails, SSNs, credit cards, and phone numbers with tokens."""
    if not text:
        return text
    out = text
    for token, pattern in _PII_PATTERNS:
        out = pattern.sub(token, out)
    return out


def contains_pii(text: str) -> bool:
    return any(p.search(text or "") for _, p in _PII_PATTERNS)


# ── Profanity ─────────────────────────────────────────────────────────────────

_PROFANITY = {"fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt"}
_WORD_RE = re.compile(r"[a-zA-Z']+")


def contains_profanity(text: str) -> bool:
    return any(w.lower() in _PROFANITY for w in _WORD_RE.findall(text or ""))


def clean_profanity(text: str) -> str:
    def _mask(m: re.Match) -> str:
        w = m.group(0)
        return (w[0] + "*" * (len(w) - 1)) if w.lower() in _PROFANITY else w

    return _WORD_RE.sub(_mask, text or "")


# ── Prompt-injection defense ──────────────────────────────────────────────────

_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions", re.I),
    re.compile(r"disregard\s+(all\s+)?(the\s+)?(previous|prior|above)", re.I),
    re.compile(r"forget\s+(everything|all|your)\s", re.I),
    re.compile(r"you\s+are\s+now\s+(a|an|the)\s", re.I),
    re.compile(r"system\s+prompt", re.I),
    re.compile(r"reveal\s+(your|the)\s+(system|instructions|prompt)", re.I),
    re.compile(r"new\s+instructions?\s*:", re.I),
]


def detect_injection(text: str) -> bool:
    return any(p.search(text or "") for p in _INJECTION_PATTERNS)


def sanitize_context(text: str) -> str:
    """Neutralize override directives embedded in untrusted document text."""
    out = text or ""
    for pattern in _INJECTION_PATTERNS:
        out = pattern.sub("[removed potential instruction]", out)
    return out
