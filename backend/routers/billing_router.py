"""Billing — provider-aware (Paddle, Stripe, or Lemon Squeezy).

Same public checkout paths regardless of provider, so the frontend only needs the
capability flags + catalog from /api/config. PAYMENT_PROVIDER selects the provider.

- Paddle (Merchant of Record, works in Kosovo): multi-plan subscriptions +
  one-time credit packs. Fulfillment is webhook-driven:
    * transaction.completed (origin=web)              -> grant pack credits (idempotent)
    * transaction.completed (origin=subscription_charge) -> refill monthly allowance
    * transaction.updated   (status=refunded)         -> deduct pack credits (idempotent)
    * subscription.created/updated                    -> activate/update plan
    * subscription.canceled                           -> revoke plan + allowance
- Stripe: subscription + anonymous one-off pay-per-use (verify -> single-use token).
- Lemon Squeezy (Merchant of Record, works in Kosovo): multi-plan subscriptions +
  one-time credit packs. Fulfillment is webhook-driven:
    * order_created            -> grant pack credits (idempotent)
    * order_refunded           -> deduct pack credits (idempotent)
    * subscription_created     -> activate plan, set monthly credit allowance
    * subscription_updated     -> status / plan changes
    * subscription_payment_*   -> refill monthly allowance on renewal
    * subscription_expired     -> revoke plan + allowance
"""
import json
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from auth import create_pay_token, get_current_user
from config import settings
from db import get_session
from models import RedeemedSession, User
from plans import pack_credits, plan_monthly_credits
from services import lemonsqueezy as ls
from services import paddle as paddle_svc

router = APIRouter(prefix="/api", tags=["billing"])

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


class CheckoutResponse(BaseModel):
    url: str


class SubscriptionCheckoutRequest(BaseModel):
    plan: str = "pro"  # creator | pro | agency


class CreditsCheckoutRequest(BaseModel):
    pack: str = "small"  # small | large


class VerifyRequest(BaseModel):
    session_id: str


class PayTokenResponse(BaseModel):
    pay_token: str


# --------------------------------------------------------------------------- #
# Shared
# --------------------------------------------------------------------------- #
def _find_user_by(session: Session, *, user_id=None, email=None) -> Optional[User]:
    if user_id:
        try:
            u = session.get(User, int(user_id))
            if u:
                return u
        except (TypeError, ValueError):
            pass
    if email:
        return session.exec(select(User).where(User.email == email)).first()
    return None


def _variant_id_from_order(attrs: dict) -> str:
    return str((attrs.get("first_order_item") or {}).get("variant_id") or "")


# --------------------------------------------------------------------------- #
# Checkout (provider-dispatched)
# --------------------------------------------------------------------------- #
@router.post("/checkout/subscription", response_model=CheckoutResponse)
def checkout_subscription(
    req: SubscriptionCheckoutRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Recurring subscription checkout for a chosen plan. Requires an account."""
    if not settings.subscription_enabled:
        raise HTTPException(status_code=503, detail="Subscriptions are not configured.")

    if settings.payment_provider == "paddle":
        price_id = settings.paddle_plan_price_map.get(req.plan)
        if not price_id:
            raise HTTPException(status_code=400, detail="Unknown or unavailable plan.")
        try:
            url = paddle_svc.create_checkout(
                price_id=price_id,
                success_url=f"{settings.frontend_url}/?subscribed=success",
                customer_email=user.email,
                custom_data={"user_id": user.id, "kind": "subscription", "plan": req.plan},
            )
        except paddle_svc.PaddleError as e:
            raise HTTPException(status_code=502, detail=f"Paddle error: {e}")
        return CheckoutResponse(url=url)

    if settings.payment_provider == "stripe":
        # Stripe path keeps a single configured price (plan is ignored here).
        try:
            checkout = stripe.checkout.Session.create(
                mode="subscription",
                payment_method_types=["card"],
                line_items=[{"price": settings.stripe_subscription_price_id, "quantity": 1}],
                customer_email=user.email,
                client_reference_id=str(user.id),
                success_url=f"{settings.frontend_url}/?subscribed=success",
                cancel_url=f"{settings.frontend_url}/?subscribed=cancelled",
            )
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Stripe error: {e}")
        return CheckoutResponse(url=checkout.url)

    # Lemon Squeezy: resolve the plan -> variant.
    variant_id = settings.plan_variant_map.get(req.plan)
    if not variant_id:
        raise HTTPException(status_code=400, detail="Unknown or unavailable plan.")
    try:
        url = ls.create_checkout(
            variant_id=variant_id,
            redirect_url=f"{settings.frontend_url}/?subscribed=success",
            email=user.email,
            custom={"user_id": user.id, "kind": "subscription", "plan": req.plan},
        )
    except ls.LemonSqueezyError as e:
        raise HTTPException(status_code=502, detail=f"Lemon Squeezy error: {e}")
    return CheckoutResponse(url=url)


@router.post("/checkout/credits", response_model=CheckoutResponse)
def checkout_credits(
    req: CreditsCheckoutRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Buy a one-time credit pack. Requires a logged-in account."""
    if not settings.credits_purchase_enabled:
        raise HTTPException(status_code=503, detail="Credit purchases are not configured.")

    if settings.payment_provider == "paddle":
        price_id = settings.paddle_pack_price_map.get(req.pack)
        if not price_id:
            raise HTTPException(status_code=400, detail="Unknown or unavailable credit pack.")
        try:
            url = paddle_svc.create_checkout(
                price_id=price_id,
                success_url=f"{settings.frontend_url}/?credits=success",
                customer_email=user.email,
                custom_data={"user_id": user.id, "kind": "credits", "pack": req.pack},
            )
        except paddle_svc.PaddleError as e:
            raise HTTPException(status_code=502, detail=f"Paddle error: {e}")
        return CheckoutResponse(url=url)

    # Lemon Squeezy
    variant_id = settings.pack_variant_map.get(req.pack)
    if not variant_id:
        raise HTTPException(status_code=400, detail="Unknown or unavailable credit pack.")
    try:
        url = ls.create_checkout(
            variant_id=variant_id,
            redirect_url=f"{settings.frontend_url}/?credits=success",
            email=user.email,
            custom={"user_id": user.id, "kind": "credits", "pack": req.pack},
        )
    except ls.LemonSqueezyError as e:
        raise HTTPException(status_code=502, detail=f"Lemon Squeezy error: {e}")
    return CheckoutResponse(url=url)


# --------------------------------------------------------------------------- #
# Stripe-only: anonymous one-off pay-per-use
# --------------------------------------------------------------------------- #
@router.post("/checkout/pay-per-use", response_model=CheckoutResponse)
def checkout_pay_per_use():
    """One-time checkout, no account (Stripe only)."""
    if not settings.pay_per_use_enabled:
        raise HTTPException(status_code=503, detail="Pay-per-use is not available.")
    try:
        sess = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "1 Video Analysis",
                        "description": "AI hook, retention & viral scoring + hashtags + best time to post",
                    },
                    "unit_amount": settings.pay_per_use_amount_cents,
                },
                "quantity": 1,
            }],
            success_url=f"{settings.frontend_url}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.frontend_url}/?payment=cancelled",
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")
    return CheckoutResponse(url=sess.url)


@router.post("/checkout/verify", response_model=PayTokenResponse)
def verify_pay_per_use(req: VerifyRequest):
    """Confirm a paid pay-per-use session and mint a single-use token (Stripe)."""
    if not settings.pay_per_use_enabled:
        raise HTTPException(status_code=503, detail="Pay-per-use is not available.")
    try:
        sess = stripe.checkout.Session.retrieve(req.session_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")
    if (
        getattr(sess, "mode", None) != "payment"
        or getattr(sess, "payment_status", None) != "paid"
        or getattr(sess, "currency", None) != "usd"
        or getattr(sess, "amount_total", None) != settings.pay_per_use_amount_cents
    ):
        raise HTTPException(status_code=402, detail="Payment not valid for an analysis.")
    return PayTokenResponse(pay_token=create_pay_token(req.session_id))


# --------------------------------------------------------------------------- #
# Webhooks
# --------------------------------------------------------------------------- #

# -- Paddle helpers --------------------------------------------------------- #
def _paddle_email(data: dict) -> str | None:
    return (data.get("customer") or {}).get("email")


def _plan_from_paddle_items(items: list) -> str | None:
    for item in items:
        price_id = str((item.get("price") or {}).get("id") or item.get("price_id") or "")
        plan_key = settings.paddle_price_to_plan.get(price_id)
        if plan_key:
            return plan_key
    return None


@router.post("/paddle/webhook")
async def paddle_webhook(request: Request, session: Session = Depends(get_session)):
    """Fulfill Paddle transactions and subscription events."""
    if settings.payment_provider != "paddle":
        raise HTTPException(status_code=404, detail="Not found.")
    if not settings.paddle_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook signing secret not configured.")

    payload = await request.body()
    sig = request.headers.get("paddle-signature")
    if not paddle_svc.verify_signature(payload, sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event = json.loads(payload)
    event_type = str(event.get("event_type") or "")
    data = event.get("data") or {}
    custom = data.get("custom_data") or {}
    data_id = str(data.get("id") or "")

    # --- One-time credit pack purchase -------------------------------------- #
    if event_type == "transaction.completed":
        origin = str(data.get("origin") or "")

        if origin == "subscription_charge":
            # Renewal invoice — refill the monthly allowance.
            sub_id = str(data.get("subscription_id") or "")
            user = _find_user_by(session, user_id=custom.get("user_id"), email=_paddle_email(data))
            if not user and sub_id:
                user = session.exec(select(User).where(User.subscription_id == sub_id)).first()
            if user:
                user.subscription_status = "active"
                user.subscription_credits = plan_monthly_credits(user.plan)
                session.add(user)
                session.commit()

        elif custom.get("kind") == "credits":
            pack_key = custom.get("pack")
            credits = pack_credits(pack_key)
            key = f"paddle_txn_{data_id}"
            if credits and not session.get(RedeemedSession, key):
                user = _find_user_by(session, user_id=custom.get("user_id"), email=_paddle_email(data))
                if user:
                    user.credits += credits
                    session.add(user)
                    session.add(RedeemedSession(session_id=key))
                    session.commit()

    # --- Credit pack refund ------------------------------------------------- #
    elif event_type == "transaction.updated":
        status = str(data.get("status") or "")
        if status in ("refunded", "partially_refunded") and custom.get("kind") == "credits":
            pack_key = custom.get("pack")
            credits = pack_credits(pack_key)
            key = f"paddle_refund_{data_id}"
            if credits and not session.get(RedeemedSession, key):
                user = _find_user_by(session, user_id=custom.get("user_id"), email=_paddle_email(data))
                if user:
                    user.credits = max(0, user.credits - credits)
                    session.add(user)
                    session.add(RedeemedSession(session_id=key))
                    session.commit()

    # --- Subscriptions ------------------------------------------------------ #
    elif event_type in ("subscription.created", "subscription.updated"):
        status = str(data.get("status") or "")
        plan_key = custom.get("plan") or _plan_from_paddle_items(data.get("items") or [])
        user = _find_user_by(session, user_id=custom.get("user_id"), email=_paddle_email(data))
        if not user and data_id:
            user = session.exec(select(User).where(User.subscription_id == data_id)).first()
        if user:
            if status in paddle_svc.ACTIVE_STATUSES:
                user.subscription_status = "active"
                if data_id:
                    user.subscription_id = data_id
                if plan_key:
                    plan_changed = plan_key != user.plan
                    user.plan = plan_key
                    if event_type == "subscription.created" or plan_changed:
                        user.subscription_credits = plan_monthly_credits(plan_key)
            elif status == "canceled":
                user.subscription_status = "canceled"
                user.plan = "free"
                user.subscription_credits = 0
            session.add(user)
            session.commit()

    elif event_type == "subscription.canceled":
        user = _find_user_by(session, user_id=custom.get("user_id"), email=_paddle_email(data))
        if not user and data_id:
            user = session.exec(select(User).where(User.subscription_id == data_id)).first()
        if user:
            user.subscription_status = "canceled"
            user.plan = "free"
            user.subscription_credits = 0
            session.add(user)
            session.commit()

    return {"received": True}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, session: Session = Depends(get_session)):
    if settings.payment_provider != "stripe":
        raise HTTPException(status_code=404, detail="Not found.")
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook signing secret not configured.")
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    event = json.loads(payload)  # plain dict (StripeObject lacks .get())
    etype = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    if etype == "checkout.session.completed" and obj.get("mode") == "subscription":
        email = (obj.get("customer_details") or {}).get("email") or obj.get("customer_email")
        user = _find_user_by(session, user_id=obj.get("client_reference_id"), email=email)
        if user:
            user.subscription_status = "active"
            # Stripe path uses a single plan tier (Pro) with its monthly allowance.
            user.plan = "pro"
            user.subscription_credits = plan_monthly_credits("pro")
            if obj.get("customer"):
                user.stripe_customer_id = obj["customer"]
            session.add(user)
            session.commit()
    elif etype == "customer.subscription.deleted":
        customer_id = obj.get("customer")
        if customer_id:
            user = session.exec(select(User).where(User.stripe_customer_id == customer_id)).first()
            if user:
                user.subscription_status = "canceled"
                user.plan = "free"
                user.subscription_credits = 0
                session.add(user)
                session.commit()

    return {"received": True}


@router.post("/lemonsqueezy/webhook")
async def lemonsqueezy_webhook(request: Request, session: Session = Depends(get_session)):
    """Fulfill Lemon Squeezy orders (credit packs) and subscriptions."""
    if settings.payment_provider != "lemonsqueezy":
        raise HTTPException(status_code=404, detail="Not found.")
    if not settings.lemonsqueezy_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook signing secret not configured.")
    payload = await request.body()
    sig = request.headers.get("x-signature")
    if not ls.verify_signature(payload, sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event = json.loads(payload)
    meta = event.get("meta") or {}
    event_name = meta.get("event_name") or request.headers.get("x-event-name")
    custom = meta.get("custom_data") or {}
    data = event.get("data") or {}
    attrs = data.get("attributes") or {}
    data_id = str(data.get("id") or "")

    # --- One-time credit packs ---------------------------------------------- #
    if event_name == "order_created":
        if custom.get("kind") == "credits" and attrs.get("status") == "paid":
            pack_key = custom.get("pack") or settings.variant_to_pack.get(_variant_id_from_order(attrs))
            credits = pack_credits(pack_key)
            key = f"ls_order_{data_id}"  # idempotent: credit once per order
            if credits and not session.get(RedeemedSession, key):
                user = _find_user_by(session, user_id=custom.get("user_id"), email=attrs.get("user_email"))
                if user:
                    user.credits += credits
                    session.add(user)
                    session.add(RedeemedSession(session_id=key))
                    session.commit()

    elif event_name == "order_refunded":
        pack_key = custom.get("pack") or settings.variant_to_pack.get(_variant_id_from_order(attrs))
        credits = pack_credits(pack_key)
        key = f"ls_refund_{data_id}"  # idempotent: deduct once per refund
        if credits and not session.get(RedeemedSession, key):
            user = _find_user_by(session, user_id=custom.get("user_id"), email=attrs.get("user_email"))
            if user:
                user.credits = max(0, user.credits - credits)
                session.add(user)
                session.add(RedeemedSession(session_id=key))
                session.commit()

    # --- Subscriptions ------------------------------------------------------ #
    elif event_name == "subscription_payment_success":
        # Renewal invoice — refill the monthly allowance for the user's plan.
        sub_id = str(attrs.get("subscription_id") or "")
        user = _find_user_by(session, user_id=custom.get("user_id"), email=attrs.get("user_email"))
        if not user and sub_id:
            user = session.exec(select(User).where(User.subscription_id == sub_id)).first()
        if user:
            user.subscription_status = "active"
            user.subscription_credits = plan_monthly_credits(user.plan)
            session.add(user)
            session.commit()

    elif event_name and event_name.startswith("subscription_"):
        status = attrs.get("status")
        plan_key = settings.variant_to_plan.get(str(attrs.get("variant_id") or ""))
        user = _find_user_by(session, user_id=custom.get("user_id"), email=attrs.get("user_email"))
        if not user and data_id:
            user = session.exec(select(User).where(User.subscription_id == data_id)).first()
        if user:
            if event_name in ("subscription_expired", "subscription_unpaid") or status in ("expired", "unpaid"):
                # Period ended / payment failed — revoke access.
                user.subscription_status = "canceled"
                user.plan = "free"
                user.subscription_credits = 0
            elif status in ls.ACTIVE_STATUSES:  # active | on_trial
                user.subscription_status = "active"
                if data_id:
                    user.subscription_id = data_id
                if plan_key:
                    plan_changed = plan_key != user.plan
                    user.plan = plan_key
                    if event_name == "subscription_created" or plan_changed:
                        user.subscription_credits = plan_monthly_credits(plan_key)
            # "cancelled" (set to not-renew but still within the paid period) is
            # intentionally left active until the subscription_expired event.
            session.add(user)
            session.commit()

    return {"received": True}
