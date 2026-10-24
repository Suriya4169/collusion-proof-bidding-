"""Database engine: SQLite for local development, PostgreSQL when ``DATABASE_URL`` is set.

``DATABASE_URL`` may point at any PostgreSQL server, including a managed Supabase project (see
``docs/SUPABASE_SETUP.md``). For Supabase hosts this module also
* requires TLS (``sslmode=require``) unless the URL already says otherwise,
* switches off client-side pooling for the transaction pooler (port 6543), which pools connections itself, and
* can enable row-level security on every table (``enable_row_level_security``), because Supabase publishes the
  ``public`` schema over its REST API and an unprotected table is readable with the project's public key.
"""
import os
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_SQLITE_PATH = os.path.join(BACKEND_DIR, "procureguard.db")

# src.main loads the repo-root .env only after the routes (and so this module) are imported, so read it here too.
# Variables that are already set in the environment always win.
load_dotenv(Path(BACKEND_DIR).parent / ".env")

SUPABASE_HOST_SUFFIXES = (".supabase.co", ".supabase.com")
TRANSACTION_POOLER_PORT = 6543


def normalize_database_url(url: str) -> str:
    """Accept the ``postgres://`` spelling that hosting dashboards print; SQLAlchemy 2 wants ``postgresql://``."""
    url = url.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def is_postgres_url(url: str) -> bool:
    return normalize_database_url(url).startswith("postgresql")


def is_supabase_url(url: str) -> bool:
    host = (make_url(normalize_database_url(url)).host or "").lower()
    return host.endswith(SUPABASE_HOST_SUFFIXES)


def uses_transaction_pooler(url: str) -> bool:
    return is_supabase_url(url) and make_url(normalize_database_url(url)).port == TRANSACTION_POOLER_PORT


def prepare_database_url(url: str) -> str:
    """Normalise the URL and, for Supabase, require TLS unless the URL already chooses an ``sslmode``."""
    url = normalize_database_url(url)
    if is_supabase_url(url) and "sslmode" not in make_url(url).query:
        url = make_url(url).update_query_dict({"sslmode": "require"}).render_as_string(hide_password=False)
    return url


def engine_options(url: str) -> Dict[str, Any]:
    """Pool settings. The Supabase transaction pooler (and ``DB_POOL=null``) get no client-side pool."""
    if uses_transaction_pooler(url) or os.getenv("DB_POOL", "").strip().lower() == "null":
        return {"poolclass": NullPool, "pool_pre_ping": True}
    return {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
        "pool_timeout": 30,
        "pool_pre_ping": True,
    }


def rls_statements(metadata) -> List[str]:
    """One idempotent statement per table. With row-level security on and no policies, Supabase's public
    (anon / authenticated) roles see nothing; this backend connects as the ``postgres`` role, which bypasses it."""
    return [f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY' for table in metadata.sorted_tables]


def enable_row_level_security(engine: Engine, metadata=None) -> int:
    """Switch row-level security on for every table. Returns the number of tables handled."""
    statements = rls_statements(metadata if metadata is not None else Base.metadata)
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
    return len(statements)


def should_enable_rls(url: str) -> bool:
    """On by default for Supabase hosts. ``SUPABASE_ENABLE_RLS=0`` opts out; ``=force`` applies it to any PostgreSQL
    server (useful for testing against a local database)."""
    setting = os.getenv("SUPABASE_ENABLE_RLS", "auto").strip().lower()
    if setting in ("0", "false", "no"):
        return False
    if setting == "force":
        return is_postgres_url(url)
    return is_supabase_url(url)


# Database URL Resolution: PostgreSQL (e.g. Supabase) when DATABASE_URL names one, SQLite for local development
RAW_DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
DATABASE_URL = prepare_database_url(RAW_DATABASE_URL) if RAW_DATABASE_URL and is_postgres_url(RAW_DATABASE_URL) else None

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, **engine_options(DATABASE_URL))
    print(f"[Database] Initialized {'Supabase ' if is_supabase_url(DATABASE_URL) else ''}PostgreSQL engine.")
else:
    # Local high-performance SQLite engine with multi-thread support
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    print(f"[Database] Initialized SQLite Engine at {DEFAULT_SQLITE_PATH}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
