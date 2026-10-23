"""
Proactive match notifier (Module 2, "push" half).

Scans MSME profiles against open tenders with the same deterministic rules the on-demand
matchmaker uses (`evaluate_solo_match`, `find_jv_partner`) and stores one notification per
(MSME, tender, kind). The unique constraint makes every scan idempotent, so the periodic
daemon, event triggers and several uvicorn workers can all run it safely.
"""
import asyncio
import logging
import os
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.agents.module2.agent2_matchmaker.consortium_builder import find_jv_partner
from src.agents.module2.agent2_matchmaker.matchmaker import evaluate_solo_match
from src.db.database import SessionLocal
from src.db.models import MSMEModel, NotificationModel, TenderModel

logger = logging.getLogger("match_notifier")

SCAN_INTERVAL_ENV = "MATCH_SCAN_INTERVAL_SECONDS"
DEFAULT_INTERVAL_SECONDS = 300

# Observable daemon state, exposed by GET /api/notifications/daemon/status
daemon_state: Dict[str, Any] = {
    "running": False,
    "interval_seconds": 0,
    "runs": 0,
    "last_run_at": None,
    "last_created": 0,
    "total_created": 0,
    "last_error": None,
}


def _is_open(tender: Dict[str, Any], today: date) -> bool:
    if tender.get("status", "Active") != "Active":
        return False
    deadline = tender.get("submission_deadline")
    try:
        return date.fromisoformat(str(deadline)[:10]) >= today
    except (TypeError, ValueError):
        return True  # unknown deadline: treat as open rather than silently dropping the tender


def _solo_text(tender: Dict[str, Any]) -> str:
    return (
        f"You meet every eligibility criterion for {tender['tender_id']} ({tender.get('category', 'tender')}, "
        f"est. value {tender.get('estimated_value_inr', 'n/a')}). Closes {tender.get('submission_deadline', 'n/a')}."
    )


def _jv_text(tender: Dict[str, Any], partner: Dict[str, Any]) -> str:
    return (
        f"You cannot bid {tender['tender_id']} alone, but a consortium with {partner['partner_name']} "
        f"reaches {partner['combined_turnover']} lakh combined turnover and closes the gap. "
        f"Closes {tender.get('submission_deadline', 'n/a')}."
    )


def scan(
    db: Session,
    msme_ids: Optional[Iterable[str]] = None,
    tender_ids: Optional[Iterable[str]] = None,
    today: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """Creates notifications for new matches; returns the notifications created by this call."""
    today = today or date.today()
    msme_filter = set(msme_ids) if msme_ids is not None else None
    tender_filter = set(tender_ids) if tender_ids is not None else None

    msmes = [m.to_dict() for m in db.query(MSMEModel).all()]
    tenders = [t.to_dict() for t in db.query(TenderModel).all()]
    open_tenders = [t for t in tenders if _is_open(t, today) and (tender_filter is None or t["tender_id"] in tender_filter)]
    targets = [m for m in msmes if msme_filter is None or m["msme_id"] in msme_filter]

    existing = {
        (n.msme_id, n.tender_id, n.kind)
        for n in db.query(NotificationModel.msme_id, NotificationModel.tender_id, NotificationModel.kind)
    }

    created: List[NotificationModel] = []
    for msme in targets:
        for tender in open_tenders:
            solo = evaluate_solo_match(msme, tender)
            if solo["is_eligible"]:
                kind, score, partner, text = "SOLO", int(solo["score"]), None, _solo_text(tender)
            else:
                partner = find_jv_partner(msme, tender, msmes)
                if not partner:
                    continue
                kind, score, text = "JV", int(partner["match_score"]), _jv_text(tender, partner)

            key = (msme["msme_id"], tender["tender_id"], kind)
            if key in existing:
                continue
            row = NotificationModel(
                msme_id=msme["msme_id"],
                tender_id=tender["tender_id"],
                kind=kind,
                score=score,
                title=tender["title"],
                message=text,
                partner_name=partner["partner_name"] if partner else None,
            )
            # Commit per row: a concurrent worker inserting the same key must not roll back the rest.
            try:
                db.add(row)
                db.commit()
                db.refresh(row)
                existing.add(key)
                created.append(row)
            except IntegrityError:
                db.rollback()
                existing.add(key)

    return [n.to_dict() for n in created]


def run_scan_job(msme_ids: Optional[Iterable[str]] = None, tender_ids: Optional[Iterable[str]] = None) -> int:
    """Opens its own session; used by the daemon and by background tasks after ingestion events."""
    db = SessionLocal()
    try:
        created = scan(db, msme_ids=msme_ids, tender_ids=tender_ids)
        if created:
            logger.info("match notifier created %d notification(s)", len(created))
        return len(created)
    except Exception:
        logger.exception("match notifier scan failed")
        return 0
    finally:
        db.close()


def configured_interval() -> int:
    try:
        return int(os.getenv(SCAN_INTERVAL_ENV, DEFAULT_INTERVAL_SECONDS))
    except ValueError:
        return DEFAULT_INTERVAL_SECONDS


async def scan_loop(interval_seconds: int) -> None:
    """Periodic daemon. Runs a full backfill scan immediately, then every `interval_seconds`."""
    daemon_state.update(running=True, interval_seconds=interval_seconds)
    try:
        while True:
            try:
                created = await asyncio.to_thread(run_scan_job)
                daemon_state.update(
                    runs=daemon_state["runs"] + 1,
                    last_run_at=datetime.utcnow().isoformat(timespec="seconds"),
                    last_created=created,
                    total_created=daemon_state["total_created"] + created,
                    last_error=None,
                )
            except Exception as exc:  # keep the daemon alive
                daemon_state["last_error"] = str(exc)
                logger.exception("scan loop iteration failed")
            await asyncio.sleep(interval_seconds)
    except asyncio.CancelledError:
        daemon_state["running"] = False
        raise
