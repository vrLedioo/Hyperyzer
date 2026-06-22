"""Pytest fixtures for the Hyperyzer backend.

Sets a throwaway SQLite DB + a dummy OpenAI key BEFORE importing app modules
(config/db read the environment at import time). Each test gets a fresh schema.
"""
import os
import tempfile

# Must be set before importing config/db/main.
_DB_PATH = os.path.join(tempfile.gettempdir(), "hyperyzer_pytest.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_PATH}")
os.environ.setdefault("APP_ENV", "development")
# A server LLM key so resolve_access's "server provider configured" check passes
# (no real calls are made — generators are monkeypatched in tests that need them).
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-real")

import pytest  # noqa: E402
from sqlmodel import Session, SQLModel  # noqa: E402

import main  # noqa: E402,F401  -- registers routers / app
from auth import create_access_token, hash_password  # noqa: E402
from db import engine  # noqa: E402
from models import User  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_schema():
    """Reset to a clean schema before every test."""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(main.app)


@pytest.fixture
def make_user():
    def _make(email, password="password123", verified=True, **kw):
        with Session(engine) as s:
            u = User(email=email, hashed_password=hash_password(password),
                     email_verified=verified, **kw)
            s.add(u)
            s.commit()
            s.refresh(u)
            return u.id
    return _make


@pytest.fixture
def auth():
    def _auth(user_id):
        return {"Authorization": f"Bearer {create_access_token(user_id)}"}
    return _auth
