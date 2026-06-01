from functools import lru_cache

from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def get_chat_model() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_chat_model,
        api_key=settings.openai_api_key,
        temperature=0,
        streaming=True,
    )


@lru_cache(maxsize=1)
def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=settings.openai_api_key,
    )
