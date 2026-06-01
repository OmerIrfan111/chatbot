from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OpenAI
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"

    # Database
    database_url: str = "sqlite:///./data/app.db"

    # Vector store
    vector_store_path: str = "./data/faiss_index"
    vector_store_type: str = "faiss"  # "faiss" | "chroma"

    # Retrieval (Phase 6)
    hybrid_enabled: bool = True            # dense (FAISS) + BM25 fusion
    bm25_weight: float = 1.0               # RRF weight for the BM25 ranking
    dense_weight: float = 1.0              # RRF weight for the dense ranking
    rrf_k: int = 60                        # reciprocal-rank-fusion constant
    reranker_enabled: bool = False         # cross-encoder rerank (needs sentence-transformers)
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # Semantic cache (Phase 6)
    semantic_cache_enabled: bool = True
    semantic_cache_threshold: float = 0.97  # cosine sim to count as a near-duplicate
    semantic_cache_size: int = 256

    # Escalation (Phase 6)
    escalation_threshold: float = 0.70     # offer human handoff below this confidence

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    # Admin
    admin_email: str = "admin@example.com"
    admin_password: str = "change-me"

    # App
    app_env: str = "development"
    allowed_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
