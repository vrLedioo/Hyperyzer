"""Robust JSON-from-LLM parsing, shared by scoring + Studio generators.

Models (especially smaller/local "thinking" ones) wrap their JSON answer in
``<think>`` blocks, ```` ```json ```` fences, or surrounding prose. These helpers
recover the intended object: strip the reasoning/fences, then fall back to a
brace-and-string-aware scan that ignores decoy braces inside prose.
"""
import json
import re

# Strip a full <think>...</think> block, or a dangling closing half. We do NOT
# strip from a lone opening <think> to end-of-string — that would delete the JSON
# answer that thinking models emit after their (sometimes unclosed) reasoning.
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_THINK_CLOSE_RE = re.compile(r"^.*?</think>", re.DOTALL | re.IGNORECASE)
_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def iter_json_objects(text: str):
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


def best_json_object(text: str, prefer_key: str | None = None):
    """Pick the object that looks like our payload (prefer one containing
    `prefer_key`); fall back to the last parseable object, else None."""
    objs = [o for o in iter_json_objects(text) if isinstance(o, dict)]
    if not objs:
        return None
    if prefer_key:
        for o in reversed(objs):
            if prefer_key in o:
                return o
    return objs[-1]


def parse_json_response(content: str, prefer_key: str | None = None) -> dict:
    """Parse a JSON object out of a raw model response, tolerating <think>
    blocks, ```json fences, and surrounding prose. Raises ValueError if no
    JSON object can be recovered."""
    if not content:
        raise ValueError("Model returned an empty response.")
    cleaned = _THINK_BLOCK_RE.sub("", content)
    cleaned = _THINK_CLOSE_RE.sub("", cleaned)
    fence = _FENCE_RE.search(cleaned)
    if fence:
        cleaned = fence.group(1)
    cleaned = cleaned.strip()

    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    obj = best_json_object(cleaned, prefer_key=prefer_key)
    if isinstance(obj, dict):
        return obj
    raise ValueError("Could not parse a valid JSON response from the model.")
