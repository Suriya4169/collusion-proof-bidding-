"""Tests for the proactive match notifier (Module 2 push half). Uses an isolated in-memory DB."""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.db.database import Base
from src.db.models import MSMEModel, NotificationModel, TenderModel
from src.services import match_notifier

TODAY = date(2026, 10, 23)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def msme(msme_id, sector="IT Services", turnover=100.0, years=5, certs=("ISO 9001",), startup=False):
    m = MSMEModel(msme_id=msme_id, company_name=f"Co {msme_id}", sector=sector, annual_turnover_lakhs=turnover,
                  years_of_experience=years, is_startup_india_recognized=startup)
    m.certifications = list(certs)
    return m


def tender(tender_id, category="IT Services", turnover=50.0, years=3, certs=("ISO 9001",), deadline="2026-12-01",
           status="Active", exempt=False):
    t = TenderModel(tender_id=tender_id, title=f"Tender {tender_id}", category=category, min_turnover_lakhs=turnover,
                    min_experience_years=years, allows_startup_exemption=exempt, emd_amount_inr=0.0,
                    estimated_value_inr="Rs 1 Cr", submission_deadline=deadline, status=status)
    t.required_certifications = list(certs)
    return t


def test_solo_match_creates_notification_once(db):
    db.add_all([msme("M1"), tender("T1")])
    db.commit()
    first = match_notifier.scan(db, today=TODAY)
    assert [(n["msme_id"], n["tender_id"], n["kind"]) for n in first] == [("M1", "T1", "SOLO")]
    assert first[0]["read"] is False
    assert match_notifier.scan(db, today=TODAY) == []  # idempotent
    assert db.query(NotificationModel).count() == 1


def test_jv_notification_when_partner_closes_the_gap(db):
    db.add_all([msme("M1", turnover=20.0), msme("M2", turnover=80.0), tender("T1", turnover=60.0)])
    db.commit()
    created = match_notifier.scan(db, msme_ids=["M1"], today=TODAY)
    assert len(created) == 1
    assert created[0]["kind"] == "JV" and created[0]["partner_name"] == "Co M2"


def test_no_notification_for_sector_mismatch_or_unbridgeable_gap(db):
    db.add_all([msme("M1", sector="Manufacturing"), tender("T1", category="IT Services", turnover=500.0)])
    db.commit()
    assert match_notifier.scan(db, today=TODAY) == []


def test_closed_and_expired_tenders_are_skipped(db):
    db.add_all([msme("M1"), tender("T_OLD", deadline="2026-01-01"), tender("T_CLOSED", status="Closed"), tender("T_OK")])
    db.commit()
    assert {n["tender_id"] for n in match_notifier.scan(db, today=TODAY)} == {"T_OK"}


def test_unparseable_deadline_is_treated_as_open(db):
    db.add_all([msme("M1"), tender("T1", deadline="30-11-2026")])
    db.commit()
    assert len(match_notifier.scan(db, today=TODAY)) == 1


def test_scoped_scan_only_touches_requested_tender(db):
    db.add_all([msme("M1"), tender("T1"), tender("T2")])
    db.commit()
    created = match_notifier.scan(db, tender_ids=["T2"], today=TODAY)
    assert [n["tender_id"] for n in created] == ["T2"]
    later = match_notifier.scan(db, today=TODAY)  # the periodic full scan backfills the rest
    assert [n["tender_id"] for n in later] == ["T1"]


def test_new_tender_after_first_scan_is_pushed(db):
    db.add_all([msme("M1"), tender("T1")])
    db.commit()
    match_notifier.scan(db, today=TODAY)
    db.add(tender("T2"))
    db.commit()
    assert [n["tender_id"] for n in match_notifier.scan(db, today=TODAY)] == ["T2"]
