import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import faiss
import numpy as np

from app.config import get_settings

settings = get_settings()


@dataclass
class Chunk:
    text: str
    metadata: dict
    embedding: list[float] = field(default_factory=list)


class FAISSVectorStore:
    """
    Inner-product (cosine) index over L2-normalised OpenAI embeddings.
    Persists to two files: index.faiss + chunks.pkl.
    """

    def __init__(self, path: Optional[str] = None):
        self.path = Path(path or settings.vector_store_path)
        self.path.mkdir(parents=True, exist_ok=True)
        self._index_file = self.path / "index.faiss"
        self._chunks_file = self.path / "chunks.pkl"
        self.index: Optional[faiss.Index] = None
        self.chunks: list[Chunk] = []
        self._load()

    # ── persistence ─────────────────────────────────────────────────────────

    def _load(self):
        if self._index_file.exists() and self._chunks_file.exists():
            self.index = faiss.read_index(str(self._index_file))
            with open(self._chunks_file, "rb") as f:
                self.chunks = pickle.load(f)

    def _save(self):
        if self.index is not None:
            faiss.write_index(self.index, str(self._index_file))
        with open(self._chunks_file, "wb") as f:
            pickle.dump(self.chunks, f)

    # ── write ────────────────────────────────────────────────────────────────

    def add(self, chunks: list[Chunk]) -> None:
        if not chunks:
            return
        vectors = np.array([c.embedding for c in chunks], dtype=np.float32)
        faiss.normalize_L2(vectors)

        if self.index is None:
            dim = vectors.shape[1]
            self.index = faiss.IndexFlatIP(dim)

        self.index.add(vectors)
        self.chunks.extend(chunks)
        self._save()

    def delete_by_document(self, document_id: int) -> None:
        """Rebuild the index without chunks belonging to document_id."""
        remaining = [c for c in self.chunks if c.metadata.get("document_id") != document_id]
        if len(remaining) == len(self.chunks):
            return

        self.chunks = remaining
        self.index = None
        if remaining:
            vectors = np.array([c.embedding for c in remaining], dtype=np.float32)
            faiss.normalize_L2(vectors)
            self.index = faiss.IndexFlatIP(vectors.shape[1])
            self.index.add(vectors)
        self._save()

    # ── read ─────────────────────────────────────────────────────────────────

    def search(self, query_embedding: list[float], k: int = 5) -> list[tuple[Chunk, float]]:
        if self.index is None or self.index.ntotal == 0:
            return []
        vec = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(vec)
        scores, indices = self.index.search(vec, min(k, self.index.ntotal))
        return [
            (self.chunks[idx], float(score))
            for score, idx in zip(scores[0], indices[0])
            if idx >= 0
        ]
