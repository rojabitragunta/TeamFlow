from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.database.database import get_db
from app.dependencies.auth import get_current_user, require_admin, require_manager
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    role: UserRole | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.name).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager)
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # A Project Manager may add team members but must not grant admin/manager
    # privileges — only an Admin can create Admins or other Project Managers.
    role = payload.role
    if current_user.role != UserRole.ADMIN:
        role = UserRole.TEAM_MEMBER

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_self = current_user.id == user_id
    is_admin = current_user.role == UserRole.ADMIN
    is_manager = current_user.role == UserRole.PROJECT_MANAGER

    if not (is_self or is_admin or is_manager):
        raise HTTPException(status_code=403, detail="Not allowed to update this user")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    current_password = data.pop("current_password", None)

    if "email" in data and data["email"] != user.email:
        if db.query(User).filter(User.email == data["email"], User.id != user_id).first():
            raise HTTPException(status_code=409, detail="An account with this email already exists")

    if "password" in data and data["password"]:
        # Anyone changing their OWN password must prove they know the current one.
        # An admin resetting someone else's password is exempt from this check.
        if is_self and not verify_password(current_password or "", user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = hash_password(data.pop("password"))
    else:
        data.pop("password", None)

    # Only an Admin may change role or active status; a Project Manager can
    # still edit a member's name/email, but never elevate privileges.
    if not is_admin:
        data.pop("role", None)
        data.pop("is_active", None)

    if "role" in data and data["role"] is None:
        data.pop("role")

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None
