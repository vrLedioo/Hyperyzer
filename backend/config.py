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

    # Studio generators use a stronger model than scoring — creative writing
    # quality matters more for scripts than for a JSON score. Still cheap.
    studio_model: str = "gpt-4.1-mini"

    # --- Transcription provider ---
    # "openai" = Whisper API (needs a key); "local" = faster-whisper (no key).
    transcription_provider: str = "openai"
    local_whisper_model: str = "base"  # tiny | base | small | medium | large-v3

    # --- Auth (JWT) ---
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    free_credits_on_signup: int = 10

    # Credit cost per analysis type. A video report costs more — it runs Whisper
    # transcription on top of the full report (scores + hashtags + best time).
    idea_credit_cost: int = 1
    video_credit_cost: int = 5

    # --- Studio (creation tools) credit costs ---
    # Plan-gated to Pro/Agency (see plans.py), but still spend credits. Priced for
    # perceived value, anchored to idea=1 / video=5. COGS is tiny (a script on
    # studio_model costs ~$0.003), so these are about fairness/upsell, not cost.
    script_credit_cost: int = 3       # idea/topic -> full short-form script
    ad_script_credit_cost: int = 3    # product -> UGC ad script
    hook_credit_cost: int = 2         # topic -> 10-15 hook variations
    optimize_credit_cost: int = 4     # rewrite + RE-SCORE (2 model calls), charged once
    calendar_credit_cost: int = 8     # niche -> week/month of ideas+hooks+slots (Agency)
    bulk_per_item_cost: int = 1       # bulk analyze: charged per item (== idea cost)

    # --- Payments ---
    # Active provider: "none" | "paddle" | "lemonsqueezy" | "stripe".
    # Paddle and Lemon Squeezy are Merchants of Record that work in Kosovo and
    # handle tax/VAT + payouts. Stripe is unavailable there.
    payment_provider: str = "none"

    # --- Stripe (used when payment_provider == "stripe") ---
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_subscription_price_id: str | None = None  # recurring price (monthly)
    pay_per_use_amount_cents: int = 99  # $0.99 single analysis (anonymous)

    # --- Paddle (used when payment_provider == "paddle") ---
    paddle_api_key: str | None = None
    paddle_webhook_secret: str | None = None
    paddle_sandbox: bool = False  # True -> sandbox-api.paddle.com
    # One Paddle *price id* per subscription plan (see plans.PLANS).
    paddle_price_creator: str | None = None
    paddle_price_pro: str | None = None
    paddle_price_agency: str | None = None
    # One price id per one-time credit pack (see plans.PACKS).
    paddle_price_pack_small: str | None = None
    paddle_price_pack_large: str | None = None

    # --- Lemon Squeezy (used when payment_provider == "lemonsqueezy") ---
    lemonsqueezy_api_key: str | None = None
    lemonsqueezy_store_id: str | None = None
    lemonsqueezy_webhook_secret: str | None = None
    # One Lemon Squeezy *variant id* per subscription plan (see plans.PLANS).
    ls_variant_creator: str | None = None
    ls_variant_pro: str | None = None
    ls_variant_agency: str | None = None
    # One variant id per one-time credit pack (see plans.PACKS).
    ls_variant_pack_small: str | None = None
    ls_variant_pack_large: str | None = None

    @property
    def studio_costs(self) -> dict[str, int]:
        """Per-feature Studio credit costs, exposed to the frontend via /api/config
        so the UI can show a cost before the call. Keys match plans.py feature keys
        (plus 'bulk_per_item', which is the per-item charge for the bulk feature)."""
        return {
            "script": self.script_credit_cost,
            "ad_script": self.ad_script_credit_cost,
            "hooks": self.hook_credit_cost,
            "optimize": self.optimize_credit_cost,
            "calendar": self.calendar_credit_cost,
            "bulk_per_item": self.bulk_per_item_cost,
        }

    # --- Plan / pack <-> Paddle price maps ---
    @property
    def paddle_plan_price_map(self) -> dict[str, str]:
        """plan_key -> price_id, for plans whose price is configured."""
        raw = {
            "creator": self.paddle_price_creator,
            "pro": self.paddle_price_pro,
            "agency": self.paddle_price_agency,
        }
        return {k: v for k, v in raw.items() if v}

    @property
    def paddle_pack_price_map(self) -> dict[str, str]:
        """pack_key -> price_id, for packs whose price is configured."""
        raw = {
            "small": self.paddle_price_pack_small,
            "large": self.paddle_price_pack_large,
        }
        return {k: v for k, v in raw.items() if v}

    @property
    def paddle_price_to_plan(self) -> dict[str, str]:
        return {v: k for k, v in self.paddle_plan_price_map.items()}

    # --- Plan / pack <-> Lemon Squeezy variant maps ---
    @property
    def plan_variant_map(self) -> dict[str, str]:
        """plan_key -> variant_id, for plans whose variant is configured."""
        raw = {
            "creator": self.ls_variant_creator,
            "pro": self.ls_variant_pro,
            "agency": self.ls_variant_agency,
        }
        return {k: v for k, v in raw.items() if v}

    @property
    def pack_variant_map(self) -> dict[str, str]:
        """pack_key -> variant_id, for packs whose variant is configured."""
        raw = {
            "small": self.ls_variant_pack_small,
            "large": self.ls_variant_pack_large,
        }
        return {k: v for k, v in raw.items() if v}

    @property
    def variant_to_plan(self) -> dict[str, str]:
        return {v: k for k, v in self.plan_variant_map.items()}

    @property
    def variant_to_pack(self) -> dict[str, str]:
        return {v: k for k, v in self.pack_variant_map.items()}

    # --- Provider-neutral availability maps (used by /api/config) ---
    @property
    def available_plan_keys(self) -> set:
        if self.payment_provider == "paddle":
            return set(self.paddle_plan_price_map.keys())
        if self.payment_provider == "lemonsqueezy":
            return set(self.plan_variant_map.keys())
        return set()

    @property
    def available_pack_keys(self) -> set:
        if self.payment_provider == "paddle":
            return set(self.paddle_pack_price_map.keys())
        if self.payment_provider == "lemonsqueezy":
            return set(self.pack_variant_map.keys())
        return set()

    # --- Email (Resend) — used for password-reset emails ---
    resend_api_key: str | None = None
    email_from: str = "Hyperyzer <support@hyperyzer.com>"

    # --- URLs ---
    # Canonical frontend origin (used for Stripe success/cancel redirects).
    frontend_url: str = "http://localhost:3000"
    # Allowed CORS origins (comma-separated). Defaults to frontend_url.
    cors_origins: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins or self.frontend_url
        return [o.strip() for o in raw.split(",") if o.strip()]

    # --- Uploads / jobs ---
    upload_dir: str = "./uploads"
    max_upload_mb: int = 200
    # Reject new video uploads when this many jobs are already in flight (DoS guard).
    max_active_video_jobs: int = 5
    # Cap on heavy transcriptions running at once.
    max_concurrent_transcriptions: int = 2

    # --- Billing capability flags (provider-neutral, used by /api/config + gate) ---
    @property
    def subscription_enabled(self) -> bool:
        if self.payment_provider == "stripe":
            return bool(self.stripe_secret_key and self.stripe_subscription_price_id)
        if self.payment_provider == "lemonsqueezy":
            return bool(self.lemonsqueezy_api_key and self.plan_variant_map)
        if self.payment_provider == "paddle":
            return bool(self.paddle_api_key and self.paddle_plan_price_map)
        return False

    @property
    def credits_purchase_enabled(self) -> bool:
        if self.payment_provider == "lemonsqueezy":
            return bool(self.lemonsqueezy_api_key and self.pack_variant_map)
        if self.payment_provider == "paddle":
            return bool(self.paddle_api_key and self.paddle_pack_price_map)
        return False

    @property
    def pay_per_use_enabled(self) -> bool:
        # Anonymous one-off purchase (Stripe only).
        if self.payment_provider == "stripe":
            return bool(self.stripe_secret_key)
        return False

    @property
    def billing_enabled(self) -> bool:
        return self.subscription_enabled or self.credits_purchase_enabled or self.pay_per_use_enabled

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
            if self.payment_provider == "stripe" and self.stripe_secret_key and not self.stripe_webhook_secret:
                raise ValueError(
                    "STRIPE_WEBHOOK_SECRET is required when Stripe is the active provider "
                    "(unsigned webhooks are never trusted)."
                )
            if self.payment_provider == "lemonsqueezy" and self.lemonsqueezy_api_key and not self.lemonsqueezy_webhook_secret:
                raise ValueError(
                    "LEMONSQUEEZY_WEBHOOK_SECRET is required when Lemon Squeezy is the active "
                    "provider (unsigned webhooks are never trusted)."
                )
            if self.payment_provider == "paddle" and self.paddle_api_key and not self.paddle_webhook_secret:
                raise ValueError(
                    "PADDLE_WEBHOOK_SECRET is required when Paddle is the active "
                    "provider (unsigned webhooks are never trusted)."
                )
        return self


settings = Settings()
