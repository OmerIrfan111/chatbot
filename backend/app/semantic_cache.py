"""
Semantic answer cache (Phase 6).

Skips the LLM (and retrieval) when a new question is semantically near-identical
to one we have already answered. Keyed by the question embedding; a cosine
similarity above the configured threshold counts as a hit.

In-memory, bounded (FIFO eviction), thread-safe. Scoped per `session_id` so one
user's phrasing never leaks another user's answer.
"""
import threading
from collections import OrderedDict, deque
from typing import Any, Optional

import numpy as np

from app.config import get_settings

settings = get_settings()


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


class SemanticCache:
    def __init__(self, threshold: Optional[float] = None, max_size: Optional[int] = None):
        self.threshold = threshold if threshold is not None else settings.semantic_cache_threshold
        self.max_size = max_size if max_size is not None else settings.semantic_cache_size
        self._lock = threading.Lock()
        # session_id -> deque[(embedding, response_dict)]
        self._store: OrderedDict[str, deque] = OrderedDict()

    def get(self, session_id: str, embedding: list[float]) -> Optional[dict[str, Any]]:
        vec = np.asarray(embedding, dtype=np.float32)
        with self._lock:
            entries = self._store.get(session_id)
            if not entries:
                return None
            best, best_sim = None, 0.0
            for emb, response in entries:
                sim = _cosine(vec, emb)
                if sim > best_sim:
                    best, best_sim = response, sim
            if best is not None and best_sim >= self.threshold:
                # Return a copy flagged as a cache hit; never mutate the stored dict.
                return {**best, "cached": True}
        return None

    def put(self, session_id: str, embedding: list[float], response: dict[str, Any]) -> None:
        vec = np.asarray(embedding, dtype=np.float32)
        with self._lock:
            entries = self._store.get(session_id)
            if entries is None:
                entries = deque(maxlen=self.max_size)
                self._store[session_id] = entries
            entries.append((vec, {k: v for k, v in response.items() if k != "cached"}))
            # Bound the number of sessions we track, too.
            while len(self._store) > self.max_size:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


# Process-wide singleton used by the API layer.
semantic_cache = SemanticCache()
