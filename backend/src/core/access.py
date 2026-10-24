"""Who may call what.

Three roles exist: ``msme`` (a vendor), ``government_auditor`` and ``admin``. Authentication (is this a valid
token?) lives in ``src.core.auth``; this module holds the authorisation rules on top of it:

* role groups, applied to whole routers in ``src.main`` or to single routes;
* ownership: a vendor may only touch the data of the enterprises linked to their account (the one on the account,
  ``UserModel.msme_id``, plus any they registered, ``UserEnterpriseModel``). Reviewers (auditors and admins) may
  read any enterprise's data, and only vendors (for their own) and admins may change it.

Keeping the rules here means one place to read, and one test (``tests/test_access_control.py``) that fails if
any route is left open by accident.
"""
from typing import Set

from fastapi import Depends, Form, HTTPException, status
from sqlalchemy.orm import Session

from src.core.auth import get_current_user, require_roles
from src.db.database import get_db
from src.db.models import UserEnterpriseModel, UserModel

MSME = "msme"
AUDITOR = "government_auditor"
ADMIN = "admin"

ANY_USER = [MSME, AUDITOR, ADMIN]
VENDORS = [MSME, ADMIN]  # vendor tools; admin may act for any vendor
REVIEWERS = [AUDITOR, ADMIN]  # government side

__all__ = [
    "MSME", "AUDITOR", "ADMIN", "ANY_USER", "VENDORS", "REVIEWERS", "require_roles", "get_current_user",
    "linked_msme_ids", "link_enterprise", "can_read_msme", "can_write_msme",
    "ensure_msme_read", "ensure_msme_write", "msme_path_read", "msme_path_write", "msme_form_write",
]


def linked_msme_ids(db: Session, user: UserModel) -> Set[str]:
    """Enterprise ids a vendor account is linked to."""
    ids = {user.msme_id} if user.msme_id else set()
    rows = db.query(UserEnterpriseModel.msme_id).filter(UserEnterpriseModel.user_id == user.id).all()
    ids.update(r[0] for r in rows)
    return ids


def link_enterprise(db: Session, user: UserModel, msme_id: str) -> None:
    """Record that ``user`` may act for ``msme_id`` (idempotent)."""
    if msme_id in linked_msme_ids(db, user):
        return
    db.add(UserEnterpriseModel(user_id=user.id, msme_id=msme_id))
    db.commit()


def can_read_msme(db: Session, user: UserModel, msme_id: str) -> bool:
    if user.role in REVIEWERS:
        return True
    return user.role == MSME and msme_id in linked_msme_ids(db, user)


def can_write_msme(db: Session, user: UserModel, msme_id: str) -> bool:
    if user.role == ADMIN:
        return True
    return user.role == MSME and msme_id in linked_msme_ids(db, user)


def _forbidden(action: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Operation not permitted. You can only {action} your own enterprise's data.",
    )


def ensure_msme_read(db: Session, user: UserModel, msme_id: str) -> UserModel:
    if not can_read_msme(db, user, msme_id):
        raise _forbidden("read")
    return user


def ensure_msme_write(db: Session, user: UserModel, msme_id: str) -> UserModel:
    if not can_write_msme(db, user, msme_id):
        raise _forbidden("change")
    return user


async def msme_path_read(
    msme_id: str, user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserModel:
    """Route dependency for ``/{msme_id}`` paths that read an enterprise's data."""
    return ensure_msme_read(db, user, msme_id)


async def msme_path_write(
    msme_id: str, user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserModel:
    """Route dependency for ``/{msme_id}`` paths that change an enterprise's data."""
    return ensure_msme_write(db, user, msme_id)


async def msme_form_write(
    msme_id: str = Form(...), user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserModel:
    """Route dependency for multipart routes that change an enterprise's data (``msme_id`` form field)."""
    return ensure_msme_write(db, user, msme_id)
