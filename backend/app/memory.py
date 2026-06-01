"""
Server-side conversation memory — keeps the last WINDOW turns per session.
Each turn is {"role": "user"|"assistant", "content": str}.
"""
from collections import deque
from threading import Lock

WINDOW = 5  # keep last N (user + assistant) pairs = 2*N messages max


class SessionMemory:
    def __init__(self, window: int = WINDOW):
        self._window = window
        self._history: deque[dict] = deque(maxlen=window * 2)

    def add(self, role: str, content: str) -> None:
        self._history.append({"role": role, "content": content})

    def get(self) -> list[dict]:
        return list(self._history)

    def clear(self) -> None:
        self._history.clear()


class MemoryStore:
    """Thread-safe store of per-session memories."""

    def __init__(self):
        self._store: dict[str, SessionMemory] = {}
        self._lock = Lock()

    def get(self, session_id: str) -> SessionMemory:
        with self._lock:
            if session_id not in self._store:
                self._store[session_id] = SessionMemory()
            return self._store[session_id]

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._store.pop(session_id, None)

    def list_sessions(self) -> list[str]:
        with self._lock:
            return list(self._store.keys())


# Singleton
memory_store = MemoryStore()
