"""Access control across the whole platform, tested against the real FastAPI app (``src.main``).

* Route audit: every route must require a login (or an M2M key), unless it is on the short public list.
* Role matrix: each role gets in where it should and is turned away where it should not.
* Ownership: a vendor reaches only the enterprises linked to their account.
* Registration, token signing and the M2M key can no longer be used to gain privileges.

Heavy AI libraries that are not installed are replaced by inert stand-ins (``_import_stubs``); no agent runs.
"""
import re

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from tests import _import_stubs

_import_stubs.install()

from src.api.routes import m2m  # noqa: E402
from src.core import auth as auth_module  # noqa: E402
from src.core import access  # noqa: E402
from src.core.auth import create_access_token, hash_password  # noqa: E402
from src.db.database import Base, get_db  # noqa: E402
from src.db.models import DocumentModel, MSMEModel, NotificationModel, UserModel  # noqa: E402
from src.main import app  # noqa: E402

PASSWORD = "Password123!"
LEAKED_DEFAULT_SECRET = "procureguard-sovereign-ai-jwt-secret-key-2026"  # was hard-coded in the source

# (email, role, enterprise on the account)
ACCOUNTS = {
    "vendor": ("vendor@test.in", "msme", "M101"),
    "vendor2": ("vendor2@test.in", "msme", "M102"),
    "auditor": ("auditor@test.in", "government_auditor", None),
    "admin": ("admin@test.in", "admin", None),
}
PUBLIC_ROUTES = {
    ("POST", "/api/auth/login"), ("POST", "/api/auth/register"), ("GET", "/health"), ("GET", "/api/behavior/health"),
}


def msme(msme_id, name):
    m = MSMEModel(msme_id=msme_id, company_name=name, sector="IT Services", annual_turnover_lakhs=100.0,
                  years_of_experience=5, is_startup_india_recognized=False, gstin="33AABCU9603R1ZM")
    m.certifications = ["ISO 9001"]
    return m


@pytest.fixture(scope="module")
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine)
    db = factory()
    hashed = hash_password(PASSWORD)
    for email, role, msme_id in ACCOUNTS.values():
        db.add(UserModel(email=email, hashed_password=hashed, full_name=email, role=role, msme_id=msme_id, is_active=True))
    db.add_all([msme("M101", "Apex Tools"), msme("M102", "Bravo Works")])
    db.add_all([
        DocumentModel(msme_id="M101", document_type="PAN Card", file_name="pan101.pdf", status="VALID"),
        DocumentModel(msme_id="M102", document_type="PAN Card", file_name="pan102.pdf", status="VALID"),
        NotificationModel(msme_id="M101", tender_id="T1", kind="SOLO", title="t", message="m"),
        NotificationModel(msme_id="M102", tender_id="T1", kind="SOLO", title="t", message="m"),
    ])
    db.commit()
    db.close()
    return factory


@pytest.fixture()
def client(session_factory, monkeypatch):
    def override_db():
        s = session_factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_db
    # never touch the network, the real database, or the heavy agents
    monkeypatch.setattr("src.api.routes.msme.run_scan_job", lambda *a, **k: None)
    monkeypatch.setattr("src.api.routes.matchmaker.find_solo_opportunities", lambda msme_id: {
        "msme": {"msme_id": msme_id}, "total_eligible": 0, "eligible_tenders": [], "failed_tenders": []})
    monkeypatch.setattr("src.api.routes.matchmaker.analyze_jv_opportunities", lambda msme_id: [])
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.pop(get_db, None)


def token_for(who):
    return create_access_token({"sub": ACCOUNTS[who][0]})


def hdr(who):
    return {"Authorization": f"Bearer {token_for(who)}"}


def call(client, method, path, who=None, **kwargs):
    headers = hdr(who) if who else {}
    return client.request(method, path, headers=headers, **kwargs)


# ───────────────────────── route audit: nothing is open by accident ─────────────────────────
#
# The audit drives the app through its public contract (the OpenAPI schema) and calls every operation without
# credentials, instead of reading FastAPI's internal route objects (those changed shape between versions and a
# check built on them can silently see nothing). An operation passes if it answers 401, or 503 for the M2M
# gateway when no key is configured.

def operations():
    schema = app.openapi()
    for path, item in schema["paths"].items():
        for method in item:
            if method in ("get", "post", "put", "patch", "delete"):
                yield method.upper(), path


def concrete(path):
    return re.sub(r"\{[^}]+\}", "x", path)


def test_the_audit_sees_the_whole_api():
    ops = list(operations())
    assert len(ops) >= 40, f"only {len(ops)} operations found; the audit is not seeing the real API"
    prefixes = ("/api/auth/", "/api/tenders", "/api/documents/", "/api/cartel/", "/api/behavior/",
                "/api/v1/agent/solvency/", "/api/m2m/v1/", "/api/notifications/", "/api/matchmaker/", "/api/jobs/")
    for prefix in prefixes:
        assert any(path.startswith(prefix) for _, path in ops), f"no operation under {prefix}"


def test_every_operation_refuses_an_anonymous_caller_unless_explicitly_public(client, monkeypatch):
    monkeypatch.setenv("M2M_MASTER_KEY", "k" * 40)
    open_routes = []
    for method, path in operations():
        if (method, path) in PUBLIC_ROUTES:
            continue
        status = client.request(method, concrete(path)).status_code
        if status != 401:
            open_routes.append(f"{method} {path} -> {status}")
    listing = "\n".join(open_routes)
    assert not open_routes, f"These routes answered an anonymous caller. Guard them or list them in PUBLIC_ROUTES on purpose:\n{listing}"


def test_the_public_list_is_exactly_what_is_open(client):
    paths = {(m, p) for m, p in operations()}
    assert PUBLIC_ROUTES <= paths, f"PUBLIC_ROUTES names operations that do not exist: {PUBLIC_ROUTES - paths}"
    for method, path in sorted(PUBLIC_ROUTES):
        assert client.request(method, concrete(path)).status_code != 401, f"{method} {path} is listed public but asks for a login"


# ───────────────────────── role matrix ─────────────────────────

ANY, VENDORS, REVIEWERS = access.ANY_USER, access.VENDORS, access.REVIEWERS
ROLE_OF = {"vendor": "msme", "vendor2": "msme", "auditor": "government_auditor", "admin": "admin"}

MATRIX = [
    ("POST", "/api/tender/analyze", VENDORS),
    ("POST", "/api/payments/track", VENDORS),
    ("POST", "/api/msme/register", VENDORS),
    ("GET", "/api/msme/all", ANY),
    ("POST", "/api/diff", ANY),
    ("GET", "/api/cartel/bidders", REVIEWERS),
    ("GET", "/api/cartel/health", REVIEWERS),
    ("GET", "/api/tenders", ANY),
    ("POST", "/api/tenders", ANY),
    ("GET", "/api/jobs/does-not-exist", ANY),
    ("POST", "/api/jobs/tender-analyze", ANY),
    ("POST", "/api/orchestrator/analyze", ANY),
    ("GET", "/api/notifications/daemon/status", REVIEWERS),
    ("POST", "/api/notifications/scan", REVIEWERS),
    ("GET", "/api/behavior/signals", REVIEWERS),
    ("POST", "/api/behavior/analyze", REVIEWERS),
    ("POST", "/api/behavior/submit", VENDORS),
]


@pytest.mark.parametrize("method,path,allowed", MATRIX, ids=[f"{m} {p}" for m, p, _ in MATRIX])
def test_role_matrix(client, method, path, allowed):
    assert call(client, method, path).status_code == 401, "no login"
    for who, role in ROLE_OF.items():
        status = call(client, method, path, who=who).status_code
        if role in allowed:
            assert status not in (401, 403), f"{who} ({role}) should get in, got {status}"
        else:
            assert status == 403, f"{who} ({role}) should be refused, got {status}"


def test_solvency_agent_is_for_reviewers_only(client):
    ops = [(m, p) for m, p in operations() if p.startswith("/api/v1/agent/solvency")]
    assert ops, "solvency router not mounted"
    for method, path in ops:
        assert call(client, method, concrete(path)).status_code == 401, (method, path)
        assert call(client, method, concrete(path), who="vendor").status_code == 403, (method, path)


def test_m2m_routes_use_the_api_key_not_a_login(client, monkeypatch):
    monkeypatch.setenv("M2M_MASTER_KEY", "k" * 40)
    assert call(client, "POST", "/api/m2m/v1/tenders/push", json={}).status_code == 401
    assert client.post("/api/m2m/v1/tenders/push", json={}, headers={"X-ProcureGuard-Key": "wrong"}).status_code == 403
    ok = client.post("/api/m2m/v1/tenders/push", json={}, headers={"X-ProcureGuard-Key": "k" * 40})
    assert ok.status_code == 422  # authenticated; the empty body is what failed


def test_m2m_gateway_is_off_without_a_configured_key(client, monkeypatch):
    monkeypatch.delenv("M2M_MASTER_KEY", raising=False)
    for key in (None, "pg_sovereign_m2m_key_prod_2026"):  # the second is the old hard-coded default
        headers = {"X-ProcureGuard-Key": key} if key else {}
        assert client.post("/api/m2m/v1/tenders/push", json={}, headers=headers).status_code == 503


# ───────────────────────── ownership ─────────────────────────

def test_a_vendor_reads_only_their_own_vault(client):
    assert call(client, "GET", "/api/documents/M101", "vendor").status_code == 200
    assert call(client, "GET", "/api/documents/M102", "vendor").status_code == 403
    assert call(client, "GET", "/api/documents/M102", "vendor2").status_code == 200
    for reviewer in ("auditor", "admin"):
        assert call(client, "GET", "/api/documents/M102", reviewer).status_code == 200


def test_changing_a_vault_needs_ownership_or_admin(client):
    files = {"file": ("x.pdf", b"%PDF-1.4", "application/pdf")}
    data = {"msme_id": "M102", "document_type": "PAN Card"}
    assert client.post("/api/documents/upload", files=files, data=data, headers=hdr("vendor")).status_code == 403
    assert client.post("/api/documents/upload", files=files, data={"msme_id": "M101", "document_type": "PAN Card"}, headers=hdr("auditor")).status_code == 403
    assert client.post("/api/documents/extract-and-verify", files=files, data=data, headers=hdr("vendor")).status_code == 403


def test_deleting_a_document_needs_ownership(client, session_factory):
    db = session_factory()
    other = db.query(DocumentModel).filter(DocumentModel.msme_id == "M102").first().id
    mine = DocumentModel(msme_id="M101", document_type="GST", file_name="gst.pdf", status="VALID")
    db.add(mine)
    db.commit()
    mine_id = mine.id
    assert call(client, "DELETE", f"/api/documents/{other}", "vendor").status_code == 403
    assert call(client, "DELETE", f"/api/documents/{other}", "auditor").status_code == 403
    assert db.query(DocumentModel).filter(DocumentModel.id == other).count() == 1
    assert call(client, "DELETE", f"/api/documents/{mine_id}", "vendor").status_code == 200
    db.close()


def test_matchmaker_and_notifications_are_per_enterprise(client, session_factory):
    assert call(client, "GET", "/api/matchmaker/M101", "vendor").status_code == 200
    assert call(client, "GET", "/api/matchmaker/M102", "vendor").status_code == 403
    assert call(client, "GET", "/api/matchmaker/M102", "auditor").status_code == 200
    assert call(client, "GET", "/api/notifications/M102", "vendor").status_code == 403
    assert call(client, "GET", "/api/notifications/M101", "vendor").status_code == 200
    assert call(client, "POST", "/api/notifications/M102/read-all", "vendor").status_code == 403
    assert call(client, "POST", "/api/notifications/M102/read-all", "auditor").status_code == 403  # reviewers read, they do not change
    db = session_factory()
    theirs = db.query(NotificationModel).filter(NotificationModel.msme_id == "M102").first().id
    mine = db.query(NotificationModel).filter(NotificationModel.msme_id == "M101").first().id
    assert call(client, "POST", f"/api/notifications/item/{theirs}/read", "vendor").status_code == 403
    assert db.query(NotificationModel).filter(NotificationModel.id == theirs).first().read_at is None
    assert call(client, "POST", f"/api/notifications/item/{mine}/read", "vendor").status_code == 200
    db.close()


def test_enterprise_list_shows_a_vendor_only_their_own(client):
    assert [m["msme_id"] for m in call(client, "GET", "/api/msme/all", "vendor").json()] == ["M101"]
    assert sorted(m["msme_id"] for m in call(client, "GET", "/api/msme/all", "auditor").json()) == ["M101", "M102"]


NEW_ENTERPRISE = {
    "company_name": "Kavach Cyber Defense Solutions", "sector": "IT Services", "annual_turnover_lakhs": 85.0,
    "years_of_experience": 4, "udyam_number": "UDYAM-DL-01-0098765", "gstin": "07AAAAA0000A1Z5",
}


def test_a_vendor_keeps_access_to_the_enterprise_they_register(client):
    r = call(client, "POST", "/api/msme/register", "vendor", json=NEW_ENTERPRISE)
    assert r.status_code == 200, r.text
    new_id = r.json()["msme_id"]
    assert call(client, "GET", f"/api/documents/{new_id}", "vendor").status_code == 200
    assert new_id in [m["msme_id"] for m in call(client, "GET", "/api/msme/all", "vendor").json()]
    # ... and nobody else gains access to it, not even by registering the same company again
    assert call(client, "GET", f"/api/documents/{new_id}", "vendor2").status_code == 403
    again = call(client, "POST", "/api/msme/register", "vendor2", json=NEW_ENTERPRISE)
    assert again.json()["msme_id"] == new_id
    assert call(client, "GET", f"/api/documents/{new_id}", "vendor2").status_code == 403


# ───────────────────────── registration, tokens, secrets ─────────────────────────

def register(client, who=None, **body):
    base = {"email": f"new{len(body)}{id(body)}@test.in", "password": "Secret123!", "full_name": "New User"}
    return client.post("/api/auth/register", json={**base, **body}, headers=hdr(who) if who else {})


def test_nobody_can_register_themselves_as_admin_or_auditor(client):
    for role in ("admin", "government_auditor"):
        assert register(client, role=role).status_code == 403
        assert register(client, who="vendor", role=role).status_code == 403
        assert register(client, who="auditor", role=role).status_code == 403


def test_only_an_admin_can_create_privileged_accounts(client):
    assert register(client, who="admin", role="government_auditor").status_code == 201


def test_public_registration_makes_a_vendor_and_rejects_unknown_roles(client):
    r = register(client, role="msme")
    assert r.status_code == 201 and r.json()["user"]["role"] == "msme"
    assert register(client, role="superuser").status_code == 400


def test_an_enterprise_cannot_be_claimed_by_a_second_account(client):
    assert register(client, role="msme", msme_id="M101").status_code == 409  # already linked to the seeded vendor


def test_a_token_signed_with_the_old_hard_coded_secret_is_rejected(client):
    forged = pyjwt.encode({"sub": ACCOUNTS["admin"][0], "role": "admin"}, LEAKED_DEFAULT_SECRET, algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    assert client.get("/api/auth/me", headers=hdr("admin")).status_code == 200


def test_a_deactivated_user_is_locked_out(client, session_factory):
    db = session_factory()
    user = db.query(UserModel).filter(UserModel.email == ACCOUNTS["vendor2"][0]).first()
    user.is_active = False
    db.commit()
    try:
        assert call(client, "GET", "/api/documents/M102", "vendor2").status_code == 401
    finally:
        user.is_active = True
        db.commit()
        db.close()


def test_the_signing_secret_must_be_configured_in_production(monkeypatch):
    monkeypatch.setattr(auth_module, "_secret_key", None)
    monkeypatch.setenv("PROCUREGUARD_ENV", "production")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        auth_module.get_secret_key()
    monkeypatch.setenv("JWT_SECRET", "too-short")
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        auth_module.get_secret_key()
    monkeypatch.setenv("JWT_SECRET", "s" * 40)
    assert auth_module.get_secret_key() == "s" * 40


def test_development_without_a_secret_gets_a_random_key_not_a_known_one(monkeypatch):
    monkeypatch.setattr(auth_module, "_secret_key", None)
    monkeypatch.setenv("PROCUREGUARD_ENV", "development")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    key = auth_module.get_secret_key()
    assert len(key) >= 32 and key != LEAKED_DEFAULT_SECRET


# ───────────────────────── the ownership rules themselves ─────────────────────────

def test_ownership_rules(session_factory):
    db = session_factory()
    by = {k: db.query(UserModel).filter(UserModel.email == v[0]).first() for k, v in ACCOUNTS.items()}
    assert access.can_read_msme(db, by["vendor"], "M101") and not access.can_read_msme(db, by["vendor"], "M102")
    assert access.can_read_msme(db, by["auditor"], "M102") and not access.can_write_msme(db, by["auditor"], "M102")
    assert access.can_write_msme(db, by["admin"], "M102")
    assert access.linked_msme_ids(db, by["auditor"]) == set()
    db.close()
