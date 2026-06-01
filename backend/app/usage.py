"""
Token counting + cost estimation (Phase 7).

Uses tiktoken for an accurate token count and a per-model price table to
estimate USD spend. Deterministic (no network), so it works in tests and lets
the admin cost dashboard reconcile closely with the OpenAI usage page.
"""
from functools import lru_cache

from app.config import get_settings


@lru_cache(maxsize=4)
def _encoding(model: str):
    import tiktoken

    try:
        return tiktoken.encoding_for_model(model)
    except Exception:
        return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str, model: str | None = None) -> int:
    if not text:
        return 0
    model = model or get_settings().openai_chat_model
    try:
        return len(_encoding(model).encode(text))
    except Exception:
        # Fallback heuristic: ~4 chars per token.
        return max(1, len(text) // 4)


def estimate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    settings = get_settings()
    cost = (
        prompt_tokens / 1_000_000 * settings.price_input_per_1m
        + completion_tokens / 1_000_000 * settings.price_output_per_1m
    )
    return round(cost, 8)


def measure(prompt_text: str, completion_text: str) -> dict:
    """Return {prompt_tokens, completion_tokens, cost_usd} for a single turn."""
    p = count_tokens(prompt_text)
    c = count_tokens(completion_text)
    return {
        "prompt_tokens": p,
        "completion_tokens": c,
        "cost_usd": estimate_cost(p, c),
    }
