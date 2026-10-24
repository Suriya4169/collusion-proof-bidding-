import logging
import os
import secrets
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from src.db.database import get_db
from src.db.models import UserModel

logger = logging.getLogger("procureguard.auth")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
MIN_SECRET_LENGTH = 32

_secret_key: Optional[str] = None


def is_production() -> bool:
    return os.getenv("PROCUREGUARD_ENV", "development").strip().lower() == "production"


def get_secret_key() -> str:
    """The JWT signing key, read from ``JWT_SECRET`` the first time it is needed.

    It is read lazily because ``src.main`` loads ``.env`` after importing this module. There is no built-in
    default: a key that sits in the source code is a key everyone can use to forge an admin token. In
    development a random key is generated for the process (tokens stop working on restart, and are not shared
    between workers); in production a missing or short key stops the server from starting.
    """
    global _secret_key
    if _secret_key is None:
        configured = os.getenv("JWT_SECRET", "").strip()
        if configured and len(configured) >= MIN_SECRET_LENGTH:
            _secret_key = configured
        elif is_production():
            raise RuntimeError(
                f"JWT_SECRET must be set to a random value of at least {MIN_SECRET_LENGTH} characters "
                "when PROCUREGUARD_ENV=production. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        else:
            logger.warning(
                "JWT_SECRET is %s; using a random key for this process. Logins will not survive a restart "
                "and are not shared between workers. Set JWT_SECRET (>= %d characters) in .env.",
                "too short" if configured else "not set", MIN_SECRET_LENGTH,
            )
            _secret_key = secrets.token_urlsafe(48)
    return _secret_key

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Encodes a JWT payload with expiration timestamp."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> UserModel:
    """
    FastAPI Dependency to retrieve the currently authenticated user from Bearer Token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    user = db.query(UserModel).filter(UserModel.email == email).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user

async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[UserModel]:
    """The authenticated user, or ``None`` when no token was sent. A token that is present but invalid is
    rejected, never treated as anonymous."""
    if not token:
        return None
    return await get_current_user(token=token, db=db)

def require_roles(allowed_roles: List[str]):
    """
    FastAPI Role-Based Access Control (RBAC) dependency factory.
    Example: Depends(require_roles(["admin", "government_auditor"]))
    """
    async def role_checker(current_user: UserModel = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
