"""Studio generators — the creation side of Hyperyzer (Pro/Agency only).

Each generator builds a tightly-specified JSON prompt, calls the configured
Studio model (settings.studio_model, default gpt-4.1-mini — stronger at creative
writing than the gpt-4o-mini scorer), and parses the result with the shared
robust JSON parser. Output is returned as plain dicts (JSON-serializable) so the
router can persist them with json.dumps and return them directly.

Provider-agnostic, mirroring services/scoring.py: works against OpenAI cloud, a
BYOK key, or any OpenAI-compatible endpoint (incl. local Ollama).
"""
from typing import Optional

from config import settings
from llm import build_chat_client, is_ollama, ollama_chat_json
from services._jsonparse import parse_json_response
from services.scoring import ScoreResult, score_content


class StudioError(Exception):
    """Raised when a Studio generation call fails (bad key, endpoint down, or
    an unparseable response)."""


# --------------------------------------------------------------------------- #
# Shared model call
# --------------------------------------------------------------------------- #
def _chat_json(system: str, user: str, byok_key: Optional[str], *, prefer_key: Optional[str] = None,
               temperature: float = 0.7) -> dict:
    """Call the Studio model and parse a JSON object from the response."""
    chat = build_chat_client(byok_key, model=settings.studio_model)
    try:
        if not byok_key and is_ollama():
            content = ollama_chat_json(chat.model, system, user, temperature=temperature)
        else:
            response = chat.client.chat.completions.create(
                model=chat.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
            )
            content = response.choices[0].message.content
    except Exception as e:  # noqa: BLE001
        raise StudioError(str(e)) from e

    try:
        return parse_json_response(content, prefer_key=prefer_key)
    except ValueError as e:
        raise StudioError(str(e)) from e


# --------------------------------------------------------------------------- #
# Sanitizers (defensive — never trust model shape)
# --------------------------------------------------------------------------- #
def _s(v, cap: int = 2000) -> str:
    return str(v).strip()[:cap] if v is not None else ""


def _str_list(v, cap: int = 30, item_cap: int = 400) -> list[str]:
    out: list[str] = []
    if isinstance(v, list):
        for item in v:
            s = _s(item, item_cap)
            if s:
                out.append(s)
            if len(out) >= cap:
                break
    return out


def _targeting(platform: Optional[str], audience: Optional[str], tone: Optional[str]) -> str:
    return (
        f"PLATFORM: {(platform or '').strip() or 'short-form video (TikTok / Reels / YouTube Shorts)'}\n"
        f"AUDIENCE: {(audience or '').strip() or 'infer the most likely audience'}\n"
        f"TONE/VOICE: {(tone or '').strip() or 'energetic, authentic, native to the platform'}\n"
    )


# --------------------------------------------------------------------------- #
# 1. Script Writer — idea/topic -> full short-form script
# --------------------------------------------------------------------------- #
_SCRIPT_SYSTEM = """
You are an elite short-form video scriptwriter for TikTok, Reels and YouTube Shorts.
Write a complete, ready-to-film script from the user's idea. Return ONE JSON object
with EXACTLY this shape and nothing else:

{
  "title": "a scroll-stopping title for the video",
  "hook": "the exact words to say in the first 3 seconds (one punchy line)",
  "beats": [
    {"label": "e.g. Hook / Setup / Payoff / CTA", "say": "what to say (1-3 sentences)", "visual": "what's on screen / b-roll"}
  ],
  "cta": "the closing call to action",
  "caption": "a post caption with a hook and 1-2 emojis",
  "hashtags": ["5-10 relevant #hashtags, lowercase, no spaces"]
}

Rules:
- 5-8 beats, tight pacing, every line earns the next. The first beat IS the hook.
- Write words a real creator would actually say out loud — no stage directions in "say".
- Respond with ONLY the JSON object. No prose, no markdown fences, no <think>.
"""


def write_script(idea: str, *, platform=None, audience=None, tone=None,
                 byok_key: Optional[str] = None) -> dict:
    user = _targeting(platform, audience, tone) + f"\nVIDEO IDEA:\n{idea}"
    data = _chat_json(_SCRIPT_SYSTEM, user, byok_key, prefer_key="hook")
    beats = []
    raw = data.get("beats")
    if isinstance(raw, list):
        for b in raw[:8]:
            if isinstance(b, dict):
                beats.append({"label": _s(b.get("label"), 60), "say": _s(b.get("say"), 1200),
                              "visual": _s(b.get("visual"), 600)})
    return {
        "title": _s(data.get("title"), 200),
        "hook": _s(data.get("hook"), 600),
        "beats": beats,
        "cta": _s(data.get("cta"), 400),
        "caption": _s(data.get("caption"), 600),
        "hashtags": [h if h.startswith("#") else f"#{h}" for h in _str_list(data.get("hashtags"), 12, 60)],
    }


# --------------------------------------------------------------------------- #
# 2. Ad / Product Script Writer -> UGC direct-response ad script
# --------------------------------------------------------------------------- #
_AD_SYSTEM = """
You are a direct-response UGC ad scriptwriter who writes short-form video ads that
convert. Using the product details, write a native-feeling ad script. Return ONE
JSON object with EXACTLY this shape and nothing else:

{
  "title": "internal name for this ad angle",
  "angle": "the persuasion angle in one line (e.g. problem-solution, before/after)",
  "hook": "the first 3 seconds — a pattern interrupt that stops the scroll",
  "beats": [
    {"label": "Hook / Problem / Agitate / Solution / Proof / Offer / CTA", "say": "spoken line", "visual": "what's shown"}
  ],
  "cta": "the closing call to action with urgency",
  "caption": "ad caption",
  "hashtags": ["3-6 #hashtags"]
}

Rules:
- Follow a hook -> problem -> agitate -> solution -> proof -> offer -> CTA flow (6-8 beats).
- Sound like a real person talking to camera, not a corporate ad. Be specific about the benefit.
- Respond with ONLY the JSON object. No prose, no markdown fences, no <think>.
"""


def write_ad_script(product: str, *, benefit=None, offer=None, platform=None, audience=None,
                    tone=None, byok_key: Optional[str] = None) -> dict:
    details = (
        f"PRODUCT: {_s(product, 600)}\n"
        f"KEY BENEFIT: {(benefit or '').strip() or 'infer the strongest benefit'}\n"
        f"OFFER/PRICE: {(offer or '').strip() or 'none specified'}\n"
    )
    user = _targeting(platform, audience, tone) + "\n" + details
    data = _chat_json(_AD_SYSTEM, user, byok_key, prefer_key="hook")
    beats = []
    raw = data.get("beats")
    if isinstance(raw, list):
        for b in raw[:8]:
            if isinstance(b, dict):
                beats.append({"label": _s(b.get("label"), 60), "say": _s(b.get("say"), 1200),
                              "visual": _s(b.get("visual"), 600)})
    return {
        "title": _s(data.get("title"), 200),
        "angle": _s(data.get("angle"), 300),
        "hook": _s(data.get("hook"), 600),
        "beats": beats,
        "cta": _s(data.get("cta"), 400),
        "caption": _s(data.get("caption"), 600),
        "hashtags": [h if h.startswith("#") else f"#{h}" for h in _str_list(data.get("hashtags"), 8, 60)],
    }


# --------------------------------------------------------------------------- #
# 3. Hook Generator -> many scroll-stopping hook variations
# --------------------------------------------------------------------------- #
_HOOKS_SYSTEM = """
You are a viral hook specialist. Generate scroll-stopping opening hooks (the first
3 seconds) for the user's topic. Return ONE JSON object with EXACTLY this shape:

{
  "hooks": [
    {"text": "the exact hook line a creator would say/show", "why": "one short line on why it works"}
  ]
}

Rules:
- Give 12-15 DISTINCT hooks using varied patterns (curiosity gap, bold claim, negativity,
  question, listicle, "POV", stat/number, controversy). No duplicates or near-duplicates.
- Each hook is one punchy line. Respond with ONLY the JSON object. No prose, no fences, no <think>.
"""


def generate_hooks(topic: str, *, platform=None, audience=None, tone=None,
                   byok_key: Optional[str] = None) -> dict:
    user = _targeting(platform, audience, tone) + f"\nTOPIC:\n{topic}"
    data = _chat_json(_HOOKS_SYSTEM, user, byok_key, prefer_key="hooks")
    hooks = []
    raw = data.get("hooks")
    if isinstance(raw, list):
        for h in raw[:15]:
            if isinstance(h, dict):
                text = _s(h.get("text"), 400)
                if text:
                    hooks.append({"text": text, "why": _s(h.get("why"), 300)})
            elif isinstance(h, str):
                text = _s(h, 400)
                if text:
                    hooks.append({"text": text, "why": ""})
    return {"hooks": hooks}


# --------------------------------------------------------------------------- #
# 4. One-Click Optimize -> rewrite to maximize scores + before/after
# --------------------------------------------------------------------------- #
_OPTIMIZE_SYSTEM = """
You are a short-form video editor who rewrites scripts to maximize hook strength,
retention and viral potential WITHOUT changing the core idea. Return ONE JSON object:

{
  "rewritten_title": "an improved, higher-CTR title",
  "rewritten_script": "the full improved hook/script as plain spoken text",
  "changes": ["3-5 short bullet points explaining what you improved and why"]
}

Rules:
- Strengthen the first 3 seconds most of all. Tighten pacing, cut filler, add a curiosity gap.
- Keep it the same length class (it's a short-form script). Same topic, better execution.
- Respond with ONLY the JSON object. No prose, no markdown fences, no <think>.
"""


def optimize_script(title: str, script: str, *, platform=None, audience=None,
                    byok_key: Optional[str] = None) -> dict:
    """Score the original, rewrite it, then re-score the rewrite. Before/after
    scores use the same scorer (score_content) so the lift is comparable."""
    before: ScoreResult = score_content(title, script, platform=platform, audience=audience, byok_key=byok_key)

    user = _targeting(platform, audience, None) + f"\nTITLE: {title}\n\nSCRIPT TO IMPROVE:\n{script}"
    data = _chat_json(_OPTIMIZE_SYSTEM, user, byok_key, prefer_key="rewritten_script")
    rewritten_title = _s(data.get("rewritten_title"), 200) or title
    rewritten_script = _s(data.get("rewritten_script"), 4000) or script
    changes = _str_list(data.get("changes"), 8, 300)

    after: ScoreResult = score_content(
        rewritten_title, rewritten_script, platform=platform, audience=audience, byok_key=byok_key
    )

    def _scores(r: ScoreResult) -> dict:
        return {"hook_score": r.hook_score, "retention_score": r.retention_score, "viral_score": r.viral_score}

    return {
        "before": {**_scores(before), "title": title, "script": script, "feedback": before.feedback},
        "after": {**_scores(after), "title": rewritten_title, "script": rewritten_script, "feedback": after.feedback},
        "rewritten_title": rewritten_title,
        "rewritten_script": rewritten_script,
        "changes": changes,
    }


# --------------------------------------------------------------------------- #
# 5. Content Calendar (Agency) -> a week/month of ideas + hooks + slots
# --------------------------------------------------------------------------- #
_CALENDAR_SYSTEM = """
You are a short-form content strategist. Build a posting calendar for the user's
niche — a different, postable video idea for each day. Return ONE JSON object:

{
  "summary": "1-2 sentences on the strategy/theme across the calendar",
  "posts": [
    {"day": "Day 1", "idea": "the video concept in one line",
     "hook": "the opening line to say", "format": "e.g. talking head / skit / tutorial / listicle",
     "best_time": "suggested posting window, e.g. 6-9 PM"}
  ]
}

Rules:
- Produce EXACTLY the requested number of posts, each distinct, varied in format and angle.
- Make ideas specific and timely for the niche, not generic. Respond with ONLY the JSON object.
"""


def generate_calendar(niche: str, *, days: int = 7, platform=None, audience=None,
                      tone=None, byok_key: Optional[str] = None) -> dict:
    days = max(1, min(int(days or 7), 30))
    user = _targeting(platform, audience, tone) + f"\nNICHE: {niche}\nNUMBER OF POSTS: {days}"
    data = _chat_json(_CALENDAR_SYSTEM, user, byok_key, prefer_key="posts")
    posts = []
    raw = data.get("posts")
    if isinstance(raw, list):
        for i, p in enumerate(raw[:days], start=1):
            if isinstance(p, dict):
                posts.append({
                    "day": _s(p.get("day"), 40) or f"Day {i}",
                    "idea": _s(p.get("idea"), 600),
                    "hook": _s(p.get("hook"), 400),
                    "format": _s(p.get("format"), 80),
                    "best_time": _s(p.get("best_time"), 80),
                })
    return {"summary": _s(data.get("summary"), 600), "posts": posts}
