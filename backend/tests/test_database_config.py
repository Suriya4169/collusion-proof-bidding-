"""Database configuration: plain PostgreSQL, Supabase, and the row-level-security step.

The pure URL/pool logic is tested directly. The security claim ("a public Supabase role cannot read these tables")
is tested against a real PostgreSQL server started from the ``pgserver`` package; that test is skipped where the
package is not installed (``pip install pgserver``).
"""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool, QueuePool

from src.db import database as db
from src.db.database import Base
from src.db import models  # noqa: F401  (registers every table on Base.metadata)

POOLER = "postgres://postgres.abcdefghij:p%40ss@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
POOLER_SESSION = "postgresql://postgres.abcdefghij:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
DIRECT = "postgresql://postgres:pw@db.abcdefghij.supabase.co:5432/postgres"
PLAIN = "postgresql://pg_user:pw@postgres:5432/procureguard"


def test_postgres_spelling_is_normalised():
    assert db.normalize_database_url("postgres://u:p@h/db") == "postgresql://u:p@h/db"
    assert db.normalize_database_url("  postgresql://u:p@h/db ") == "postgresql://u:p@h/db"
    assert db.is_postgres_url("postgres://u:p@h/db") and not db.is_postgres_url("sqlite:///x.db")


@pytest.mark.parametrize("url,expected", [(POOLER, True), (POOLER_SESSION, True), (DIRECT, True), (PLAIN, False)])
def test_supabase_hosts_are_recognised(url, expected):
    assert db.is_supabase_url(url) is expected


def test_supabase_connections_require_tls_unless_the_url_says_otherwise():
    assert "sslmode=require" in db.prepare_database_url(DIRECT)
    assert "sslmode=disable" in db.prepare_database_url(DIRECT + "?sslmode=disable")
    assert "sslmode" not in db.prepare_database_url(PLAIN)  # a local database is left alone


def test_the_password_survives_url_preparation():
    prepared = db.make_url(db.prepare_database_url(POOLER))
    assert prepared.password == "p@ss" and prepared.drivername == "postgresql"


def test_only_the_transaction_pooler_disables_client_side_pooling(monkeypatch):
    monkeypatch.delenv("DB_POOL", raising=False)
    assert db.uses_transaction_pooler(POOLER) and not db.uses_transaction_pooler(POOLER_SESSION)
    assert not db.uses_transaction_pooler(DIRECT) and not db.uses_transaction_pooler(PLAIN)
    assert db.engine_options(POOLER)["poolclass"] is NullPool
    assert "poolclass" not in db.engine_options(DIRECT) and db.engine_options(DIRECT)["pool_size"] == 10
    monkeypatch.setenv("DB_POOL", "null")
    assert db.engine_options(PLAIN)["poolclass"] is NullPool


def test_engines_are_built_lazily_with_the_chosen_pool():
    pooled = create_engine(db.prepare_database_url(POOLER), **db.engine_options(POOLER))
    queued = create_engine(db.prepare_database_url(DIRECT), **db.engine_options(DIRECT))
    assert isinstance(pooled.pool, NullPool) and isinstance(queued.pool, QueuePool)
    assert queued.url.query["sslmode"] == "require"


@pytest.mark.parametrize("setting,url,expected", [
    (None, DIRECT, True), (None, PLAIN, False), ("0", DIRECT, False), ("false", DIRECT, False),
    ("force", PLAIN, True), ("force", "sqlite:///x.db", False),
])
def test_row_level_security_is_on_for_supabase_and_can_be_overridden(monkeypatch, setting, url, expected):
    if setting is None:
        monkeypatch.delenv("SUPABASE_ENABLE_RLS", raising=False)
    else:
        monkeypatch.setenv("SUPABASE_ENABLE_RLS", setting)
    assert db.should_enable_rls(url) is expected


def test_one_rls_statement_per_table():
    statements = db.rls_statements(Base.metadata)
    assert len(statements) == len(Base.metadata.tables) >= 9
    assert 'ALTER TABLE "behavior_signals" ENABLE ROW LEVEL SECURITY' in statements
    assert 'ALTER TABLE "users" ENABLE ROW LEVEL SECURITY' in statements


# ───────────────────────── against a real PostgreSQL ─────────────────────────

@pytest.fixture(scope="module")
def postgres(tmp_path_factory):
    pgserver = pytest.importorskip("pgserver", reason="pip install pgserver to run the real-PostgreSQL tests")
    server = pgserver.get_server(tmp_path_factory.mktemp("pg"))
    engine = create_engine(server.get_uri())
    yield engine
    engine.dispose()
    server.cleanup()


def test_every_table_can_be_created_on_postgresql(postgres):
    Base.metadata.create_all(bind=postgres)
    with postgres.connect() as c:
        have = {r[0] for r in c.execute(text("select tablename from pg_tables where schemaname = 'public'"))}
    assert set(Base.metadata.tables) <= have


def test_rls_hides_every_table_from_a_public_role(postgres):
    """The Supabase exposure, reproduced: a role like ``anon`` reads the rows until row-level security is on."""
    Base.metadata.create_all(bind=postgres)
    with postgres.begin() as c:
        c.execute(text("drop role if exists anon_like"))
        c.execute(text("create role anon_like"))
        c.execute(text("grant usage on schema public to anon_like"))
        c.execute(text("grant select on all tables in schema public to anon_like"))
        c.execute(text("delete from users"))
        c.execute(text("insert into users (email, hashed_password, full_name, role, is_active) "
                       "values ('a@b.in', 'hash', 'Alice', 'admin', true)"))

    def rows_seen_by_public_role():
        with postgres.begin() as c:
            c.execute(text("set local role anon_like"))
            return c.execute(text("select count(*) from users")).scalar()

    assert rows_seen_by_public_role() == 1  # before: readable with the public key
    assert db.enable_row_level_security(postgres) == len(Base.metadata.tables)
    assert rows_seen_by_public_role() == 0  # after: nothing, and the owning role still works
    with postgres.connect() as c:
        assert c.execute(text("select count(*) from users")).scalar() == 1
        enabled = {r[0] for r in c.execute(text(
            "select relname from pg_class join pg_namespace n on n.oid = relnamespace "
            "where nspname = 'public' and relkind = 'r' and relrowsecurity"))}
    assert set(Base.metadata.tables) <= enabled
    db.enable_row_level_security(postgres)  # idempotent
