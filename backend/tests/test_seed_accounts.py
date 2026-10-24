"""Which accounts exist after start-up: demo accounts in development, a bootstrap admin in production."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.core.auth import verify_password
from src.db import seed
from src.db.database import Base
from src.db.models import UserModel

PASSWORD = "A-long-bootstrap-password-1"


@pytest.fixture()
def database(monkeypatch):
    """Point the seeder at a private in-memory database instead of the real one."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(seed, "engine", engine)
    monkeypatch.setattr(seed, "SessionLocal", factory)
    monkeypatch.setattr(seed, "DATABASE_URL", None)
    for name in ("PROCUREGUARD_ENV", "SEED_DEMO_USERS", "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    return factory


def users(factory):
    db = factory()
    try:
        return db.query(UserModel).all()
    finally:
        db.close()


def test_development_creates_the_demo_accounts(database):
    seed.seed_database()
    assert sorted(u.email for u in users(database)) == ["admin@procureguard.in", "auditor@gem.gov.in", "msme@apex.in"]


def test_production_creates_no_demo_accounts(database, monkeypatch):
    monkeypatch.setenv("PROCUREGUARD_ENV", "production")
    seed.seed_database()
    assert users(database) == []


def test_production_creates_the_configured_bootstrap_admin(database, monkeypatch):
    monkeypatch.setenv("PROCUREGUARD_ENV", "production")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_EMAIL", "root@agency.gov.in")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", PASSWORD)
    seed.seed_database()
    (admin,) = users(database)
    assert admin.email == "root@agency.gov.in" and admin.role == "admin" and admin.is_active
    assert verify_password(PASSWORD, admin.hashed_password)


def test_a_weak_bootstrap_password_is_refused(database, monkeypatch):
    monkeypatch.setenv("PROCUREGUARD_ENV", "production")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_EMAIL", "root@agency.gov.in")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "short")
    seed.seed_database()
    assert users(database) == []


def test_the_bootstrap_admin_is_only_created_when_there_are_no_users(database, monkeypatch):
    seed.seed_database()  # development: demo accounts exist
    monkeypatch.setenv("PROCUREGUARD_ENV", "production")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_EMAIL", "root@agency.gov.in")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", PASSWORD)
    seed.seed_database()
    assert "root@agency.gov.in" not in [u.email for u in users(database)]


@pytest.mark.parametrize("value,expected_count", [("0", 0), ("false", 0), ("1", 3), ("true", 3), ("", 3)])
def test_seed_demo_users_overrides_the_default(database, monkeypatch, value, expected_count):
    monkeypatch.setenv("SEED_DEMO_USERS", value)  # "" is what docker compose passes when the variable is unset
    seed.seed_database()
    assert len(users(database)) == expected_count


def test_demo_users_can_be_forced_on_in_production(database, monkeypatch):
    monkeypatch.setenv("PROCUREGUARD_ENV", "production")
    monkeypatch.setenv("SEED_DEMO_USERS", "1")
    seed.seed_database()
    assert len(users(database)) == 3
