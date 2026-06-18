"""LLM provider abstraction.

The scoring model is provider-agnostic: it talks to any OpenAI-compatible
endpoint (OpenAI cloud, Ollama, Groq, OpenRouter, ...). This is what lets the
app run with no OpenAI key — point `LLM_BASE_URL` at a local Ollama server.
"""
from dataclasses import dataclass
from typing import Optional

import httpx
from openai import OpenAI

from config import settings


@dataclass
class ChatClient:
    client: OpenAI
    model: str
    is_local: bool  # custom/local endpoint → enable Ollama-style options


def server_llm_configured() -> bool:
    """True if the server can run analyses without a caller-supplied key."""
    if settings.llm_base_url:
        return True  # local/custom endpoint needs no real key
    return bool(settings.llm_api_key or settings.openai_api_key)


def build_chat_client(byok_key: Optional[str] = None) -> ChatClient:
    """Build the chat client. BYOK uses OpenAI cloud with the user's key;
    otherwise the server's configured provider (possibly keyless/local)."""
    if byok_key:
        return ChatClient(client=OpenAI(api_key=byok_key), model=settings.byok_model, is_local=False)

    key = settings.llm_api_key or settings.openai_api_key or "not-needed"
    if settings.llm_base_url:
        return ChatClient(
            client=OpenAI(api_key=key, base_url=settings.llm_base_url),
            model=settings.llm_model,
            is_local=True,
        )
    return ChatClient(client=OpenAI(api_key=key), model=settings.llm_model, is_local=False)


def is_ollama() -> bool:
    """True when the configured endpoint is a local Ollama server."""
    return bool(settings.llm_base_url and "11434" in settings.llm_base_url)


def ollama_chat_json(model: str, system: str, user: str, temperature: float = 0.6) -> str:
    """Call Ollama's NATIVE chat API with thinking disabled + JSON output.

    The OpenAI-compat endpoint ignores the `think` flag, so "thinking" models
    (qwen3, deepseek-r1) waste minutes reasoning. The native API honors it.
    """
    base = settings.llm_base_url.rsplit("/v1", 1)[0].rstrip("/")
    payload = {
        "model": model,
        "stream": False,
        "format": "json",
        "options": {"temperature": temperature},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if settings.llm_disable_thinking:
        payload["think"] = False
    resp = httpx.post(f"{base}/api/chat", json=payload, timeout=600.0)
    resp.raise_for_status()
    return resp.json()["message"]["content"]
