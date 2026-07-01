"""Shared report logic used by both idea and video analysis.

Produces a full "Hyperyzer report" in a single model call:
  - hook / retention / viral scores (0-100) + actionable feedback
  - fix-it improvements: verdict, rewritten hooks, better titles, a ready
    caption, and the specific moments where retention is at risk
  - best hashtags to use (primary / niche / broad), platform-tuned
  - best times to post (ranked slots + why), platform- and audience-tuned

Provider-agnostic: works with OpenAI cloud or any OpenAI-compatible endpoint
(e.g. a local Ollama server), so it can run with no OpenAI key.

The scores + feedback are the core deliverable and MUST parse or the call fails.
The improvements + hashtags + timing are high-value extras: if a (small/local)
model omits or mangles them, we degrade gracefully to empty structures instead
of failing.
"""
import re
from dataclasses import dataclass, field
from typing import Optional

from llm import build_chat_client, is_ollama, ollama_chat_json
from services._jsonparse import parse_json_response

SYSTEM_PROMPT = """
You are an elite short-form video strategist and growth consultant for YouTube,
TikTok, and Instagram Reels.

You receive a video's TITLE, its HOOK/SCRIPT (or transcript), the target PLATFORM,
and the target AUDIENCE. Return ONE JSON object with EXACTLY this shape and nothing else:

{
  "hook_score": int,        // 0-100: curiosity gap in the first 5 seconds
  "retention_score": int,   // 0-100: how well pacing prevents drop-off
  "viral_score": int,       // 0-100: how broad and shareable the premise is
  "feedback": "2-3 sentences of harsh, specific, actionable feedback on the hook",
  "verdict": "ONE short line: the single most important thing to do before posting",
  "hook_rewrites": [
    "2-3 rewritten versions of the opening hook, each stronger than the original,
     ready to be said on camera word-for-word (keep the creator's voice and topic)"
  ],
  "title_suggestions": ["2-3 better titles, optimized to stop the scroll"],
  "caption": "a ready-to-post caption for the platform (1-2 punchy sentences; emoji only where natural)",
  "retention_risks": [
    {"moment": "where viewers drop (e.g. 'seconds 8-12' or 'the mid-section')",
     "risk": "why they swipe away here", "fix": "the specific change that keeps them"}
  ],
  "hashtags": {
    "primary": ["3-5 high-intent hashtags closest to THIS exact video"],
    "niche": ["5-8 niche/community hashtags for the target audience"],
    "broad": ["3-5 broad high-reach hashtags for the platform"]
  },
  "best_times": {
    "timezone_note": "which timezone the times assume and how to adjust",
    "summary": "1-2 sentences on why these windows, tuned to platform + audience",
    "slots": [
      {"day": "e.g. Tue", "time": "e.g. 6-9 PM", "why": "short reason"}
    ]
  }
}

Rules:
- Scores MUST use the full 0-100 scale (NOT 0-10).
- hook_rewrites must be concrete lines the creator can say, NOT advice about the hook.
- Give 1-3 retention_risks, most damaging first; each fix must be specific to THIS script.
- Every hashtag MUST start with '#', be lowercase, contain no spaces, and be
  realistic and currently relevant to the platform.
- Give 3-5 posting slots, best first, tuned to the platform's algorithm and the
  audience's likely active hours/timezone.
- Respond with ONLY the JSON object. No prose, no markdown fences, no <think>.
"""

@dataclass
class ScoreResult:
    hook_score: int
    retention_score: int
    viral_score: int
    feedback: str
    # Optimization extras (always present, possibly empty on model failure).
    hashtags: dict = field(default_factory=dict)
    best_times: dict = field(default_factory=dict)
    # "Fix it" extras: verdict, hook_rewrites, title_suggestions, caption,
    # retention_risks. Same degradation contract as hashtags/best_times.
    improvements: dict = field(default_factory=dict)


class ScoringError(Exception):
    """Raised when the model call fails (e.g. bad key, endpoint down)."""


def _clamp(v) -> int:
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return 50
    return max(0, min(100, n))


def _clean_tag(t) -> Optional[str]:
    if not isinstance(t, str):
        return None
    s = re.sub(r"\s+", "", t.strip().lstrip("#"))
    return ("#" + s.lower()) if s else None


def _clean_tag_list(v, cap: int, seen: set) -> list[str]:
    out: list[str] = []
    if isinstance(v, list):
        for t in v:
            tag = _clean_tag(t)
            if tag and tag not in seen:
                seen.add(tag)
                out.append(tag)
            if len(out) >= cap:
                break
    return out


def _clean_hashtags(v) -> dict:
    """Normalize to {primary, niche, broad} of clean, de-duplicated #tags."""
    v = v if isinstance(v, dict) else {}
    seen: set = set()
    return {
        "primary": _clean_tag_list(v.get("primary"), 5, seen),
        "niche": _clean_tag_list(v.get("niche"), 8, seen),
        "broad": _clean_tag_list(v.get("broad"), 5, seen),
    }


def _clean_best_times(v) -> dict:
    v = v if isinstance(v, dict) else {}
    slots: list[dict] = []
    raw = v.get("slots")
    if isinstance(raw, list):
        for s in raw[:5]:
            if isinstance(s, dict):
                day = str(s.get("day", "")).strip()[:24]
                time = str(s.get("time", "")).strip()[:40]
                if day or time:
                    slots.append({
                        "day": day,
                        "time": time,
                        "why": str(s.get("why", "")).strip()[:200],
                    })
    return {
        "timezone_note": str(v.get("timezone_note", "")).strip()[:240],
        "summary": str(v.get("summary", "")).strip()[:400],
        "slots": slots,
    }


def _clean_str_list(v, cap: int, max_len: int) -> list[str]:
    out: list[str] = []
    if isinstance(v, list):
        for item in v:
            if isinstance(item, str):
                s = item.strip()
                if s:
                    out.append(s[:max_len])
            if len(out) >= cap:
                break
    return out


def _clean_retention_risks(v) -> list[dict]:
    risks: list[dict] = []
    if isinstance(v, list):
        for r in v[:3]:
            if isinstance(r, dict):
                moment = str(r.get("moment", "")).strip()[:120]
                risk = str(r.get("risk", "")).strip()[:300]
                fix = str(r.get("fix", "")).strip()[:300]
                if risk or fix:
                    risks.append({"moment": moment, "risk": risk, "fix": fix})
    return risks


def _clean_improvements(data: dict) -> dict:
    """Normalize the fix-it extras; every field degrades to empty independently."""
    return {
        "verdict": str(data.get("verdict", "") or "").strip()[:300],
        "hook_rewrites": _clean_str_list(data.get("hook_rewrites"), 3, 600),
        "title_suggestions": _clean_str_list(data.get("title_suggestions"), 3, 200),
        "caption": str(data.get("caption", "") or "").strip()[:600],
        "retention_risks": _clean_retention_risks(data.get("retention_risks")),
    }


def _parse(content: str) -> dict:
    try:
        return parse_json_response(content, prefer_key="hook_score")
    except ValueError as e:
        raise ScoringError(str(e)) from e


def _language_directive(language: Optional[str]) -> str:
    """Instruct the model which language to write VALUES in, without ever
    translating the JSON keys (that would break parsing)."""
    lang = (language or "").strip()
    if lang:
        return (
            f"\n\nIMPORTANT: Write the feedback, verdict, hook_rewrites, title_suggestions, "
            f"caption, retention_risks, hashtags, and all best_times text in {lang}. "
            "Keep every JSON key exactly as written above (in English); do NOT translate the keys."
        )
    return (
        "\n\nIMPORTANT: Write the feedback, verdict, hook_rewrites, title_suggestions, caption, "
        "retention_risks, hashtags, and all best_times text in the SAME language as the "
        "TITLE/SCRIPT above. Keep every JSON key exactly as written above (in English); do NOT "
        "translate the keys."
    )


def score_content(
    title: str,
    script: str,
    *,
    platform: Optional[str] = None,
    audience: Optional[str] = None,
    language: Optional[str] = None,
    byok_key: Optional[str] = None,
) -> ScoreResult:
    """Generate a full report for a title + script/transcript.

    Raises ScoringError on a model/transport failure. Hashtags and best-times
    degrade to empty structures if the model omits them (scores are required).
    """
    chat = build_chat_client(byok_key)
    platform_line = platform.strip() if platform and platform.strip() else "short-form video (TikTok / Reels / YouTube Shorts)"
    audience_line = audience.strip() if audience and audience.strip() else "infer the most likely audience from the content"
    user_content = (
        f"PLATFORM: {platform_line}\n"
        f"AUDIENCE: {audience_line}\n\n"
        f"TITLE: {title}\n\n"
        f"HOOK/SCRIPT:\n{script}"
        f"{_language_directive(language)}"
    )

    try:
        if not byok_key and is_ollama():
            # Local Ollama: native API so we can truly disable "thinking".
            content = ollama_chat_json(chat.model, SYSTEM_PROMPT, user_content, temperature=0.6)
        else:
            response = chat.client.chat.completions.create(
                model=chat.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.6,
            )
            content = response.choices[0].message.content
    except Exception as e:  # noqa: BLE001
        raise ScoringError(str(e)) from e

    data = _parse(content)
    return ScoreResult(
        hook_score=_clamp(data.get("hook_score", 50)),
        retention_score=_clamp(data.get("retention_score", 50)),
        viral_score=_clamp(data.get("viral_score", 50)),
        feedback=str(data.get("feedback", "Could not generate detailed feedback.")),
        hashtags=_clean_hashtags(data.get("hashtags")),
        best_times=_clean_best_times(data.get("best_times")),
        improvements=_clean_improvements(data),
    )
