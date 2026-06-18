"""Shared scoring logic used by both idea and video analysis.

Provider-agnostic: works with OpenAI cloud or any OpenAI-compatible endpoint
(e.g. a local Ollama server), so it can run with no OpenAI key.
"""
import json
import re
from dataclasses import dataclass
from typing import Optional

from llm import build_chat_client, is_ollama, ollama_chat_json

SYSTEM_PROMPT = """
You are an expert YouTube and TikTok retention strategist.
Analyze the provided video title and the first 30-60 seconds of the script (the hook).

Evaluate it strictly on three metrics. Each score MUST be an integer from 0 to 100
(use the full 0-100 scale, NOT 0-10):
1. hook_score: How strong is the curiosity gap in the first 5 seconds?
2. retention_score: How well does the pacing prevent viewer drop-off?
3. viral_score: How broad and shareable is the premise?

Provide exactly 2-3 sentences of harsh but actionable feedback to improve the hook.

You MUST respond with ONLY valid JSON matching this schema (no extra text):
{
    "hook_score": int,
    "retention_score": int,
    "viral_score": int,
    "feedback": "string"
}
"""

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


@dataclass
class ScoreResult:
    hook_score: int
    retention_score: int
    viral_score: int
    feedback: str


class ScoringError(Exception):
    """Raised when the model call fails (e.g. bad key, endpoint down)."""


def _clamp(v) -> int:
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return 50
    return max(0, min(100, n))


def _parse(content: str) -> dict:
    if not content:
        raise ScoringError("Model returned an empty response.")
    cleaned = _THINK_RE.sub("", content).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = _JSON_RE.search(cleaned)  # extract the first {...} block
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    raise ScoringError("Could not parse a valid JSON response from the model.")


def score_content(title: str, script: str, *, byok_key: Optional[str] = None) -> ScoreResult:
    """Score a title + script/transcript. Raises ScoringError on failure."""
    chat = build_chat_client(byok_key)
    user_content = f"Title: {title}\n\nScript/Hook: {script}"

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
    )
