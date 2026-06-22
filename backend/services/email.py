"""Transactional email via Resend (https://resend.com).

Set RESEND_API_KEY in the environment. If the key is absent the function
logs a warning and returns silently — emails are skipped in local dev.
"""
import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


def _send(*, to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping email to %s: %s", to, subject)
        return
    try:
        resp = httpx.post(
            _RESEND_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={"from": settings.email_from, "to": [to], "subject": subject, "html": html},
            timeout=10.0,
        )
        resp.raise_for_status()
    except Exception:
        logger.exception("Failed to send email to %s (%s)", to, subject)


def send_password_reset(to_email: str, reset_url: str) -> None:
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FDF2F8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;border:1px solid #fce7f3;padding:40px 36px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">Hyperyzer</p>
          <p style="margin:0 0 28px;font-size:13px;color:#ec4899;font-weight:700;">AI Video Scoring</p>
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#0f172a;">Reset your password</h1>
          <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
            Someone (hopefully you) requested a password reset for your Hyperyzer account.
            Click the button below — this link expires in <strong>1 hour</strong>.
          </p>
          <a href="{reset_url}"
             style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ec4899,#f97316);
                    color:#fff;font-weight:800;font-size:15px;text-decoration:none;border-radius:14px;
                    letter-spacing:-0.2px;">
            Reset password &rarr;
          </a>
          <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
            If you didn&rsquo;t request this, you can safely ignore this email — your password won&rsquo;t change.<br>
            Or paste this link directly: <a href="{reset_url}" style="color:#ec4899;word-break:break-all;">{reset_url}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    _send(to=to_email, subject="Reset your Hyperyzer password", html=html)


def send_verification_email(to_email: str, verify_url: str) -> None:
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FDF2F8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;border:1px solid #fce7f3;padding:40px 36px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">Hyperyzer</p>
          <p style="margin:0 0 28px;font-size:13px;color:#ec4899;font-weight:700;">AI Video Scoring</p>
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#0f172a;">Confirm your email</h1>
          <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
            Welcome to Hyperyzer! Confirm your email address to activate your account and
            start scoring your videos. This link expires in <strong>24 hours</strong>.
          </p>
          <a href="{verify_url}"
             style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ec4899,#f97316);
                    color:#fff;font-weight:800;font-size:15px;text-decoration:none;border-radius:14px;
                    letter-spacing:-0.2px;">
            Confirm email &rarr;
          </a>
          <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
            If you didn&rsquo;t create a Hyperyzer account, you can safely ignore this email.<br>
            Or paste this link directly: <a href="{verify_url}" style="color:#ec4899;word-break:break-all;">{verify_url}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    _send(to=to_email, subject="Confirm your Hyperyzer email", html=html)


def send_team_invite(to_email: str, accept_url: str, team_name: str, inviter_email: str) -> None:
    """Invite someone to join an Agency team. They join the team's shared credit
    pool and unlock the Studio. Link is single-use."""
    team_label = (team_name or "a Hyperyzer team").strip()
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FDF2F8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;border:1px solid #fce7f3;padding:40px 36px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">Hyperyzer</p>
          <p style="margin:0 0 28px;font-size:13px;color:#ec4899;font-weight:700;">AI Video Scoring</p>
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#0f172a;">You&rsquo;re invited to {team_label}</h1>
          <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
            <strong>{inviter_email}</strong> invited you to join their team on Hyperyzer. Accept to share the
            team&rsquo;s credits and unlock the full Studio — script writer, ad scripts, hooks and more.
          </p>
          <a href="{accept_url}"
             style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ec4899,#f97316);
                    color:#fff;font-weight:800;font-size:15px;text-decoration:none;border-radius:14px;
                    letter-spacing:-0.2px;">
            Join the team &rarr;
          </a>
          <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
            If you don&rsquo;t have a Hyperyzer account yet, sign up with this email address first, then open this link.<br>
            Or paste it directly: <a href="{accept_url}" style="color:#ec4899;word-break:break-all;">{accept_url}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    _send(to=to_email, subject=f"You're invited to {team_label} on Hyperyzer", html=html)


def send_account_exists(to_email: str, login_url: str, reset_url: str) -> None:
    """Sent when someone tries to sign up with an email that already has a
    verified account — keeps the signup HTTP response generic (no enumeration)
    while still giving a real returning user a helpful nudge."""
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FDF2F8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;border:1px solid #fce7f3;padding:40px 36px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">Hyperyzer</p>
          <p style="margin:0 0 28px;font-size:13px;color:#ec4899;font-weight:700;">AI Video Scoring</p>
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#0f172a;">You already have an account</h1>
          <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
            Someone just tried to sign up with this email, but it&rsquo;s already registered.
            If that was you, just log in — no need to sign up again.
          </p>
          <a href="{login_url}"
             style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ec4899,#f97316);
                    color:#fff;font-weight:800;font-size:15px;text-decoration:none;border-radius:14px;
                    letter-spacing:-0.2px;">
            Log in &rarr;
          </a>
          <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
            Forgot your password? <a href="{reset_url}" style="color:#ec4899;">Reset it here</a>.<br>
            If this wasn&rsquo;t you, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    _send(to=to_email, subject="You already have a Hyperyzer account", html=html)
