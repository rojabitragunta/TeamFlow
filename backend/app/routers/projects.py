from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.dependencies.auth import get_current_user, require_manager
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailOut,
    ProjectMemberAdd,
    ProjectMemberOut,
    ProjectOut,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_detail(db: Session, project: Project) -> ProjectDetailOut:
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    progress = round((completed / total) * 100, 1) if total else 0.0
    detail = ProjectDetailOut.model_validate(project)
    detail.task_count = total
    detail.completed_task_count = completed
    detail.progress = progress
    detail.members = [ProjectMemberOut.model_validate(m) for m in project.members]
    return detail


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.TEAM_MEMBER:
        member_project_ids = [
            m.project_id
            for m in db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
        ]
        return db.query(Project).filter(Project.id.in_(member_project_ids)).order_by(Project.created_at.desc()).all()
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager)
):
    project = Project(**payload.model_dump(), created_by=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    db.add(ProjectMember(project_id=project.id, user_id=current_user.id))
    db.commit()
    return project


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == UserRole.TEAM_MEMBER:
        is_member = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id)
            .first()
        )
        if not is_member:
            raise HTTPException(status_code=404, detail="Project not found")
    return _to_detail(db, project)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None


@router.post("/{project_id}/members", response_model=ProjectMemberOut, status_code=status.HTTP_201_CREATED)
def add_member(
    project_id: int,
    payload: ProjectMemberAdd,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == payload.user_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already a member of this project")
    member = ProjectMember(project_id=project_id, user_id=payload.user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: int, user_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return None
