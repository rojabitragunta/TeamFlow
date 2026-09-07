from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User, UserRole
from app.schemas.workload import WorkloadOut
from app.services.workload_service import compute_team_workload, compute_user_workload

router = APIRouter(prefix="/api/workload", tags=["workload"])


@router.get("", response_model=list[WorkloadOut])
def team_workload(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.TEAM_MEMBER:
        return [compute_user_workload(db, current_user)]
    users = db.query(User).filter(User.role == UserRole.TEAM_MEMBER).all()
    return compute_team_workload(db, users)


@router.get("/me", response_model=WorkloadOut)
def my_workload(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return compute_user_workload(db, current_user)
