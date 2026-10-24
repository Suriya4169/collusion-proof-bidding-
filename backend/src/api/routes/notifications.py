from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.core.access import REVIEWERS, ensure_msme_write, get_current_user, msme_path_read, msme_path_write, require_roles
from src.db.database import get_db
from src.db.models import MSMEModel, NotificationModel, UserModel
from src.services import match_notifier

router = APIRouter(prefix="/api/notifications", tags=["Autonomous Matchmaker & Coalition Builder"])


class ScanRequest(BaseModel):
    msme_id: Optional[str] = None
    tender_id: Optional[str] = None


@router.get("/daemon/status", summary="Match notifier daemon status", response_model=Dict[str, Any],
            dependencies=[Depends(require_roles(REVIEWERS))])
async def daemon_status():
    return match_notifier.daemon_state


@router.post("/scan", summary="Run a match scan now (optionally for one MSME or tender)", response_model=Dict[str, Any],
             dependencies=[Depends(require_roles(REVIEWERS))])
async def scan_now(req: ScanRequest, db: Session = Depends(get_db)):
    created = match_notifier.scan(
        db,
        msme_ids=[req.msme_id] if req.msme_id else None,
        tender_ids=[req.tender_id] if req.tender_id else None,
    )
    return {"created": len(created), "notifications": created}


@router.post("/item/{notification_id}/read", summary="Mark one notification read", response_model=Dict[str, Any])
async def mark_read(notification_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    row = db.query(NotificationModel).filter(NotificationModel.id == notification_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Notification {notification_id} not found.")
    ensure_msme_write(db, user, row.msme_id)
    if row.read_at is None:
        row.read_at = datetime.utcnow()
        db.commit()
    return row.to_dict()


@router.post("/{msme_id}/read-all", summary="Mark all of an MSME's notifications read", response_model=Dict[str, Any],
             dependencies=[Depends(msme_path_write)])
async def mark_all_read(msme_id: str, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    updated = (
        db.query(NotificationModel)
        .filter(NotificationModel.msme_id == msme_id, NotificationModel.read_at.is_(None))
        .update({NotificationModel.read_at: now}, synchronize_session=False)
    )
    db.commit()
    return {"msme_id": msme_id, "marked_read": updated}


@router.get("/{msme_id}", summary="List match notifications for an MSME", response_model=Dict[str, Any],
            dependencies=[Depends(msme_path_read)])
async def list_notifications(
    msme_id: str,
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if not db.query(MSMEModel).filter(MSMEModel.msme_id == msme_id).first():
        raise HTTPException(status_code=404, detail=f"MSME {msme_id} not found.")
    base = db.query(NotificationModel).filter(NotificationModel.msme_id == msme_id)
    unread = base.filter(NotificationModel.read_at.is_(None)).count()
    q = base.filter(NotificationModel.read_at.is_(None)) if unread_only else base
    rows = q.order_by(NotificationModel.created_at.desc(), NotificationModel.id.desc()).limit(limit).all()
    return {"msme_id": msme_id, "unread_count": unread, "notifications": [r.to_dict() for r in rows]}
