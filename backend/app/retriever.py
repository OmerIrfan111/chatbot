from app.llm import get_embeddings
from app.vectorstore import Chunk, FAISSVectorStore


def retrieve(
    question: str,
    store: FAISSVectorStore,
    k: int = 5,
) -> list[tuple[Chunk, float]]:
    """Embed question and return top-k (chunk, cosine_score) pairs."""
    embedder = get_embeddings()
    query_embedding = embedder.embed_query(question)
    return store.search(query_embedding, k=k)
