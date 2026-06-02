import sys
from pathlib import Path
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Load .env regardless of the working directory the server is started from.
# Order matters: the repo-root .env loads first, then backend/.env overrides it
# if present. This way `cd backend && uvicorn ...` still finds the root .env.
# Under pytest we ignore .env files so tests run against deterministic defaults
# (never the developer's real secrets/admin password).
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_REPO_ROOT = _BACKEND_DIR.parent
_UNDER_PYTEST = "pytest" in sys.modules
_ENV_FILES = None if _UNDER_PYTEST else (_REPO_ROOT / ".env", _BACKEND_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILES, extra="ignore")

    # LLM provider: "openai" | "bedrock"
    llm_provider: str = "openai"

    # OpenAI
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"

    # AWS Bedrock (used when llm_provider == "bedrock")
    # The Bedrock API key maps to the standard AWS_BEARER_TOKEN_BEDROCK env var.
    aws_bearer_token_bedrock: str = ""
    aws_region: str = "us-east-1"
    bedrock_chat_model: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    bedrock_embed_model: str = "amazon.titan-embed-text-v2:0"

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

    # Multi-tenancy (Phase 7)
    default_tenant: str = "default"
    # tenant_id -> api_key; widgets exchange the key for a scoped user token.
    tenant_api_keys: dict[str, str] = {"default": "demo-key", "acme": "acme-key"}

    # Rate limiting (Phase 7)
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 60   # per (tenant, ip) sliding window

    # Cost tracking (Phase 7) — USD per 1M tokens
    price_input_per_1m: float = 0.15   # gpt-4o-mini input
    price_output_per_1m: float = 0.60  # gpt-4o-mini output

    # Guardrails (Phase 7)
    guardrails_enabled: bool = True

    # App
    app_env: str = "development"
    # NoDecode: skip the source's JSON decode so a plain CSV string reaches the validator.
    allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000", "*"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_csv(cls, v):
        # Accept a comma-separated string (the natural .env format) or JSON list.
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                return v  # let pydantic parse it as JSON
            return [o.strip() for o in s.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
