"""Database engine + session helpers."""
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

from config import settings
import models  # noqa: F401  -- ensure models are registered before create_all

# Managed Postgres often hands out a "postgres://" URL, which SQLAlchemy 2 rejects.
_db_url = settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
engine = create_engine(_db_url, echo=False, pool_pre_ping=True, connect_args=connect_args)


# Columns added after the first release. SQLModel.create_all() only CREATEs
# missing tables — it never ALTERs an existing one — so we add new columns by
# hand. The DDL (NOT NULL + DEFAULT) is valid on both SQLite and Postgres.
_ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "user": {
        "subscription_credits": "INTEGER NOT NULL DEFAULT 0",
        "plan": "VARCHAR NOT NULL DEFAULT 'free'",
        # Nullable — no DEFAULT clause needed for nullable VARCHAR
        "stripe_customer_id": "VARCHAR",
        "subscription_id": "VARCHAR",
        # Grandfather pre-existing accounts to verified so they aren't locked
        # out; new signups insert email_verified=False explicitly. TRUE/FALSE
        # literals are valid on both SQLite (>=3.23) and Postgres.
        "email_verified": "BOOLEAN NOT NULL DEFAULT TRUE",
        # Agency team membership. Nullable — no DEFAULT clause needed (solo users
        # have NULL). New tables (team, client, etc.) are auto-created by
        # create_all and must NOT be listed here (this dict is for ALTERs only).
        "team_id": "INTEGER",
        "team_role": "VARCHAR",
    },
    "analysis": {
        "platform": "VARCHAR NOT NULL DEFAULT ''",
        "hashtags": "VARCHAR NOT NULL DEFAULT ''",
        "best_times": "VARCHAR NOT NULL DEFAULT ''",
        "improvements": "VARCHAR NOT NULL DEFAULT ''",
    },
}


def _ensure_columns() -> None:
    """Idempotently add any missing post-release columns to existing tables."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, cols in _ADDED_COLUMNS.items():
            if table not in tables:
                continue  # fresh DB: create_all already built it with all columns
            have = {c["name"] for c in inspector.get_columns(table)}
            for col, ddl in cols.items():
                if col not in have:
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {col} {ddl}'))


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_columns()


def get_session():
    with Session(engine) as session:
        yield session
