"""The _ensure_columns ALTER path — simulates an old prod 'user' table that
predates the new columns, then confirms create_db_and_tables adds them."""
from sqlalchemy import inspect, text

from db import create_db_and_tables, engine


def test_ensure_columns_adds_new_user_columns():
    # Replace 'user' with a legacy-shaped table missing the post-release columns.
    with engine.begin() as conn:
        conn.execute(text('DROP TABLE IF EXISTS "user"'))
        conn.execute(text(
            'CREATE TABLE "user" ('
            'id INTEGER PRIMARY KEY, email VARCHAR, hashed_password VARCHAR, '
            'credits INTEGER NOT NULL DEFAULT 0, subscription_status VARCHAR DEFAULT \'none\')'
        ))

    create_db_and_tables()  # runs SQLModel.create_all + _ensure_columns (idempotent ALTERs)

    cols = {c["name"] for c in inspect(engine).get_columns("user")}
    for expected in ("team_id", "team_role", "email_verified", "plan", "subscription_credits"):
        assert expected in cols, f"migration did not add column {expected}"


def test_new_tables_autocreate():
    create_db_and_tables()
    tables = set(inspect(engine).get_table_names())
    for t in ("generation", "team", "teammembership", "client"):
        assert t in tables
