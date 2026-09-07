"""Minimal, additive, idempotent schema migrations.

The project does not use Alembic. `Base.metadata.create_all()` only creates
tables that don't exist yet — it never alters an existing table, so adding a
column to a model requires an explicit, safe ALTER TABLE. This module inspects
the live schema and adds any missing columns it knows about. It never drops
or renames anything, so existing data is preserved.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("uvicorn.error")

# (table, column, DDL to add it)
ADDITIVE_COLUMNS = [
    (
        "users",
        "is_active",
        "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE",
    ),
]


def run_safe_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, column, ddl in ADDITIVE_COLUMNS:
            if table not in existing_tables:
                # Table doesn't exist yet — create_all() will create it
                # (already including the column, since it comes from the model).
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if column in columns:
                continue
            logger.info("Applying additive migration: %s", ddl)
            conn.execute(text(ddl))
