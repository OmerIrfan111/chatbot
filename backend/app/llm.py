"""
Provider-agnostic LLM + embeddings wrappers.

Switch providers with the LLM_PROVIDER setting ("openai" | "bedrock").
Provider SDKs are imported lazily so the unused one is never required.
"""
import os
from functools import lru_cache

from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel

from app.config import get_settings

settings = get_settings()


def _ensure_bedrock_env() -> None:
    """Bridge the Bedrock API key + region from settings into os.environ so boto3 finds them."""
    if settings.aws_bearer_token_bedrock:
        os.environ.setdefault("AWS_BEARER_TOKEN_BEDROCK", settings.aws_bearer_token_bedrock)
    if settings.aws_region:
        os.environ.setdefault("AWS_REGION", settings.aws_region)
        os.environ.setdefault("AWS_DEFAULT_REGION", settings.aws_region)


# ── chat model ───────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_chat_model() -> BaseChatModel:
    if settings.llm_provider == "bedrock":
        _ensure_bedrock_env()
        from langchain_aws import ChatBedrockConverse

        return ChatBedrockConverse(
            model=settings.bedrock_chat_model,
            region_name=settings.aws_region,
            temperature=0,
        )

    from langchain_openai import ChatOpenAI
    from pydantic import SecretStr

    return ChatOpenAI(
        model=settings.openai_chat_model,
        api_key=SecretStr(settings.openai_api_key),
        temperature=0,
        streaming=True,
    )


# ── embeddings ───────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_embeddings() -> Embeddings:
    if settings.llm_provider == "bedrock":
        _ensure_bedrock_env()
        from langchain_aws import BedrockEmbeddings

        return BedrockEmbeddings(
            model_id=settings.bedrock_embed_model,
            region_name=settings.aws_region,
        )

    from langchain_openai import OpenAIEmbeddings
    from pydantic import SecretStr

    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=SecretStr(settings.openai_api_key),
    )
