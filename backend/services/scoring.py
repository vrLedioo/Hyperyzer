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

# Strip a full <think>...</think> block, or a dangling closing half. We do NOT
# strip from a lone opening <think> to end-of-string — that would delete the JSON
# answer that thinking models emit after their (sometimes unclosed) reasoning.
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_THINK_CLOSE_RE = re.compile(r"^.*?</think>", re.DOTALL | re.IGNORECASE)
_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def _iter_json_objects(text: str):
    """Yield every parseable, balanced top-level {...} object in `text`
    (brace-aware and string-aware, so decoy braces in prose don't break it)."""
    i, n = 0, len(text)
    while i < n:
        if text[i] == "{":
            depth = 0
            in_str = False
            esc = False
            for j in range(i, n):
                c = text[j]
                if in_str:
                    if esc:
                        esc = False
                    elif c == "\\":
                        esc = True
                    elif c == '"':
                        in_str = False
                elif c == '"':
                    in_str = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            yield json.loads(text[i:j + 1])
                        except json.JSONDecodeError:
                            pass
                        i = j  # resume scanning after this object
                        break
        i += 1


def _best_json_object(text: str):
    """Pick the object that looks like our score payload (prefer one containing
    'hook_score'); fall back to the last parseable object, else None."""
    objs = [o for o in _iter_json_objects(text) if isinstance(o, dict)]
    if not objs:
        return None
    for o in reversed(objs):
        if "hook_score" in o:
            return o
    return objs[-1]


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
    # Remove a full <think> block, then any leading reasoning up to a stray
    # </think>, then unwrap a ```json code fence if present.
    cleaned = _THINK_BLOCK_RE.sub("", content)
    cleaned = _THINK_CLOSE_RE.sub("", cleaned)
    fence = _FENCE_RE.search(cleaned)
    if fence:
        cleaned = fence.group(1)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        obj = _best_json_object(cleaned)  # tolerate surrounding prose / extra braces
        if obj is not None:
            return obj
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
