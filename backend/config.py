"""Application configuration, loaded from environment / .env file."""
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known weak/placeholder secrets that must never be used outside local dev.
_WEAK_JWT_SECRETS = {
    "dev-secret-change-me",
    "change-me-to-a-long-random-secret-string",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" relaxes the production safety guards below.
    app_env: str = "development"

    # --- Core ---
    openai_api_key: str | None = None
    database_url: str = "sqlite:///./video_analyzer.db"

    # --- LLM provider (scoring) ---
    # Leave llm_base_url empty to use OpenAI's cloud. Point it at ANY
    # OpenAI-compatible endpoint to avoid an OpenAI key entirely:
    #   Ollama (local, free):  http://localhost:11434/v1   (key "ollama")
    #   Groq (free tier):      https://api.groq.com/openai/v1
    #   OpenRouter:            https://openrouter.ai/api/v1
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    # qwen3 / deepseek-r1 etc. are "thinking" models — disable it for speed.
    llm_disable_thinking: bool = True

    # BYOK always targets OpenAI's cloud with the user's own key.
    byok_model: str = "gpt-4o-mini"

    # --- Transcription provider ---
    # "openai" = Whisper API (needs a key); "local" = faster-whisper (no key).
    transcription_provider: str = "openai"
    local_whisper_model: str = "base"  # tiny | base | small | medium | large-v3

    # --- Auth (JWT) ---
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    free_credits_on_signup: int = 3

    # --- Stripe ---
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_subscription_price_id: str | None = None  # recurring price (monthly)
    pay_per_use_amount_cents: int = 99  # $0.99 single analysis

    # --- URLs (local dev) ---
    frontend_url: str = "http://localhost:3000"

    # --- Uploads / jobs ---
    upload_dir: str = "./uploads"
    max_upload_mb: int = 200
    # Reject new video uploads when this many jobs are already in flight (DoS guard).
    max_active_video_jobs: int = 5
    # Cap on heavy transcriptions running at once.
    max_concurrent_transcriptions: int = 2

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() not in ("development", "dev", "local", "test")

    def _jwt_secret_is_weak(self) -> bool:
        s = self.jwt_secret or ""
        return (
            not s
            or s in _WEAK_JWT_SECRETS
            or s.startswith(("dev-", "local-dev-", "change-me"))
            or len(s) < 32
        )

    @model_validator(mode="after")
    def _guard_production(self):
        """Fail fast on insecure config in production (no-op in local dev)."""
        if self.is_production:
            if self._jwt_secret_is_weak():
                raise ValueError(
                    "JWT_SECRET must be a strong, non-default secret (>= 32 chars) when "
                    "APP_ENV is production. Generate one: python -c \"import secrets; "
                    "print(secrets.token_urlsafe(32))\""
                )
            if self.stripe_secret_key and not self.stripe_webhook_secret:
                raise ValueError(
                    "STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set "
                    "(unsigned webhooks are never trusted)."
                )
        return self


settings = Settings()
