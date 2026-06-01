"""
In-memory sliding-window rate limiter (Phase 7).

Keyed by (tenant_id, client_ip). Thread-safe. Returns a Retry-After hint when
the limit is exceeded. Process-local — fine for a single-node demo; a
distributed deployment would back this with Redis.
"""
import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float = 60.0):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            cutoff = now - self.window
            while q and q[0] <= cutoff:
                q.popleft()
            if len(q) >= self.limit:
                retry_after = max(1, int(self.window - (now - q[0])) + 1)
                return False, retry_after
            q.append(now)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


_limiter: RateLimiter | None = None


def get_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        from app.config import get_settings

        _limiter = RateLimiter(limit=get_settings().rate_limit_per_minute)
    return _limiter
