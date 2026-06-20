"""Paddle Billing payment provider (Merchant of Record).

Used when PAYMENT_PROVIDER=paddle. Works in Kosovo and handles tax/VAT.
We create hosted checkouts via the REST API and fulfill via signed webhooks.

Webhook signature format (Paddle-Signature header):
  ts=<unix-timestamp>;h1=<hmac-sha256-hex>
  HMAC input: "<ts>:<raw-body>"
"""
import hashlib
import hmac
from typing import Optional

import httpx

from config import settings

_PROD_BASE = "https://api.paddle.com"
_SANDBOX_BASE = "https://sandbox-api.paddle.com"


class PaddleError(Exception):
    pass


def _api_base() -> str:
    return _SANDBOX_BASE if settings.paddle_sandbox else _PROD_BASE


def configured() -> bool:
    return bool(settings.paddle_api_key)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.paddle_api_key}",
        "Content-Type": "application/json",
    }


def create_checkout(
    *,
    price_id: str,
    success_url: str,
    customer_email: Optional[str] = None,
    custom_data: Optional[dict] = None,
) -> str:
    """Create a Paddle hosted-checkout transaction and return its checkout URL."""
    if not configured():
        raise PaddleError("Paddle is not configured.")

    payload: dict = {
        "items": [{"price_id": price_id, "quantity": 1}],
        "checkout": {"url": success_url},
    }
    if customer_email:
        payload["customer"] = {"email": customer_email}
    if custom_data:
        payload["custom_data"] = {k: str(v) for k, v in custom_data.items()}

    try:
        resp = httpx.post(
            f"{_api_base()}/transactions",
            json=payload,
            headers=_headers(),
            timeout=httpx.Timeout(30.0, connect=5.0),
        )
        resp.raise_for_status()
        return resp.json()["data"]["checkout"]["url"]
    except Exception as e:  # noqa: BLE001
        raise PaddleError(str(e)) from e


def verify_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """Verify the Paddle-Signature header.

    Header format: ts=<unix-timestamp>;h1=<hex-hmac-sha256>
    HMAC input:   "<timestamp>:<raw-body-bytes-decoded-as-utf8>"
    """
    secret = settings.paddle_webhook_secret
    if not secret or not signature_header:
        return False

    parts: dict[str, str] = {}
    for segment in signature_header.split(";"):
        if "=" in segment:
            k, v = segment.split("=", 1)
            parts[k.strip()] = v.strip()

    ts = parts.get("ts")
    h1 = parts.get("h1")
    if not ts or not h1:
        return False

    signed = f"{ts}:{raw_body.decode('utf-8', errors='replace')}"
    digest = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, h1)


# Subscription statuses Paddle considers "paying / entitled".
ACTIVE_STATUSES = {"active", "trialing", "past_due"}
