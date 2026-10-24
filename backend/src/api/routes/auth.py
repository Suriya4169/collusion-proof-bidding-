from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from src.db.database import get_db
from src.db.models import UserModel, MSMEModel
from src.core.auth import hash_password, verify_password, create_access_token, get_current_user, get_optional_user

router = APIRouter(prefix="/api/auth", tags=["Authentication & Access Control (RBAC)"])

ASSIGNABLE_ROLES = ("msme", "government_auditor", "admin")

class UserRegisterRequest(BaseModel):
    email: str = Field(..., example="founder@apexprecision.in")
    password: str = Field(..., min_length=6, example="SecurePass123!")
    full_name: str = Field(..., example="Rajesh Sharma")
    role: str = Field(default="msme", example="msme") # "msme", "government_auditor", "admin"
    msme_id: Optional[str] = Field(default=None, example="M101")  # an admin links a vendor account to its enterprise

class UserLoginRequest(BaseModel):
    email: str = Field(..., example="founder@apexprecision.in")
    password: str = Field(..., example="SecurePass123!")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

@router.post("/register", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def register_user(
    req: UserRegisterRequest,
    db: Session = Depends(get_db),
    caller: Optional[UserModel] = Depends(get_optional_user),
):
    """
    Registers a new user with bcrypt password hashing and assigned RBAC role.

    Anyone may register a vendor (`msme`) account. Auditor and admin accounts can only be created by a signed-in
    admin: the role is a privilege, and a public form must not be able to grant it. An enterprise (`msme_id`)
    can be linked to one account only.
    """
    if req.role not in ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role. Choose one of: {', '.join(ASSIGNABLE_ROLES)}."
        )
    if req.role != "msme" and not (caller and caller.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an administrator can create auditor or admin accounts."
        )
    if req.role == "msme" and req.msme_id and db.query(UserModel).filter(UserModel.msme_id == req.msme_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That enterprise is already linked to an account."
        )

    existing_user = db.query(UserModel).filter(UserModel.email == req.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Validate msme_id if role is msme
    if req.role == "msme" and req.msme_id:
        msme_exists = db.query(MSMEModel).filter(MSMEModel.msme_id == req.msme_id).first()
        if not msme_exists:
            # Fallback to first available or allow
            pass

    hashed = hash_password(req.password)
    new_user = UserModel(
        email=req.email,
        hashed_password=hashed,
        full_name=req.full_name,
        role=req.role,
        msme_id=req.msme_id if req.role == "msme" else None,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Issue JWT token immediately
    token = create_access_token(data={"sub": new_user.email, "role": new_user.role, "msme_id": new_user.msme_id})

    return {
        "message": "User account created successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": new_user.to_dict()
    }

@router.post("/login", response_model=TokenResponse)
async def login_user(req: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates user credentials against bcrypt hash and issues a signed JWT Bearer Token.
    """
    user = db.query(UserModel).filter(UserModel.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated.")

    token = create_access_token(data={"sub": user.email, "role": user.role, "msme_id": user.msme_id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict()
    }

@router.get("/me", response_model=Dict[str, Any])
async def get_my_profile(current_user: UserModel = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile and RBAC role.
    """
    return {
        "user": current_user.to_dict(),
        "permissions": {
            "is_msme": current_user.role == "msme",
            "is_auditor": current_user.role in ["government_auditor", "admin"],
            "is_admin": current_user.role == "admin"
        }
    }
