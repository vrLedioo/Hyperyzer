"""Video → audio (ffmpeg) → transcript.

Two providers:
  - "local"  : faster-whisper, runs on CPU, needs NO API key.
  - "openai" : OpenAI Whisper API (uses the BYOK key or the server key).
"""
import os
import subprocess
import tempfile
import threading
from typing import Optional

# hf_xet's transfer backend is unreliable on Windows (socket errors mid-download).
# Force the classic HTTPS downloader for the faster-whisper model fetch.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

from config import settings

FFMPEG_TIMEOUT_SECONDS = 300


class TranscriptionError(Exception):
    pass


def transcription_satisfiable(byok_key: Optional[str]) -> bool:
    """Whether transcription can actually run for this request.

    Local provider always works (no key). The OpenAI provider needs a key —
    either the caller's (BYOK) or a server key.
    """
    if byok_key or settings.transcription_provider == "local":
        return True
    return bool(settings.llm_api_key or settings.openai_api_key)


# Cache the local model across requests (loading it is expensive). The model and
# its load are guarded by a lock so concurrent jobs don't race or oversubscribe.
_local_model = None
_model_lock = threading.Lock()


def _get_local_model():
    global _local_model
    with _model_lock:
        if _local_model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as e:
                raise TranscriptionError(
                    "Local transcription needs faster-whisper. Install it: pip install faster-whisper"
                ) from e
            # int8 on CPU keeps memory/CPU reasonable for a local setup.
            _local_model = WhisperModel(settings.local_whisper_model, device="cpu", compute_type="int8")
    return _local_model


def extract_audio(video_path: str) -> str:
    """Extract a small mono 16kHz wav from the video. Requires ffmpeg on PATH."""
    fd, audio_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-ac", "1", "-ar", "16000",
        audio_path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as e:
        try:
            os.remove(audio_path)
        except OSError:
            pass
        raise TranscriptionError("ffmpeg timed out processing the video.") from e
    if proc.returncode != 0:
        try:
            os.remove(audio_path)
        except OSError:
            pass
        raise TranscriptionError(
            f"ffmpeg failed (is ffmpeg installed and on PATH?): {proc.stderr[-500:]}"
        )
    return audio_path


def _transcribe_local(audio_path: str) -> str:
    model = _get_local_model()
    # faster-whisper's inference is not guaranteed re-entrant; serialize it.
    with _model_lock:
        segments, _info = model.transcribe(audio_path, beam_size=1)
        return " ".join(seg.text.strip() for seg in segments).strip()


def _transcribe_openai(audio_path: str, byok_key: Optional[str]) -> str:
    key = byok_key or settings.llm_api_key or settings.openai_api_key
    if not key:
        raise TranscriptionError(
            "OpenAI transcription needs a key. Provide your own key (BYOK), set a server key, "
            "or switch TRANSCRIPTION_PROVIDER=local for keyless transcription."
        )
    from openai import OpenAI
    client = OpenAI(api_key=key)
    with open(audio_path, "rb") as f:
        result = client.audio.transcriptions.create(model="whisper-1", file=f)
    return (result.text or "").strip()


def transcribe(video_path: str, byok_key: Optional[str] = None) -> str:
    """Transcribe a video to text using the configured provider.

    A BYOK caller is transcribed on their own OpenAI key (so the whole analysis
    runs on their key, matching the 'Use own OpenAI Key' promise), regardless of
    the server's default transcription provider.
    """
    audio_path = extract_audio(video_path)
    try:
        use_openai = bool(byok_key) or settings.transcription_provider != "local"
        if use_openai:
            text = _transcribe_openai(audio_path, byok_key)
        else:
            text = _transcribe_local(audio_path)
        if not text:
            raise TranscriptionError("Transcription returned no speech/text.")
        return text
    except TranscriptionError:
        raise
    except Exception as e:  # noqa: BLE001
        raise TranscriptionError(str(e)) from e
    finally:
        try:
            os.remove(audio_path)
        except OSError:
            pass
