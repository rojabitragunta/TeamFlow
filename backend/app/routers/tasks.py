from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.dependencies.auth import get_current_user, require_manager
from app.models.project_member import ProjectMember
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.schemas.task import RecommendationResponse, TaskCreate, TaskDetailOut, TaskOut, TaskUpdate
from app.services.recommendation_service import recommend_assignee
from app.services.task_service import is_task_overdue

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _serialize(task: Task) -> TaskOut:
    out = TaskOut.model_validate(task)
    out.is_overdue = is_task_overdue(task)
    return out


def _serialize_detail(task: Task) -> TaskDetailOut:
    out = TaskDetailOut.model_validate(task)
    out.is_overdue = is_task_overdue(task)
    return out


@router.get("", response_model=list[TaskOut])
def list_tasks(
    project_id: int | None = None,
    assigned_to: int | None = None,
    status_filter: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    keyword: str | None = None,
    overdue_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task)

    if current_user.role == UserRole.TEAM_MEMBER:
        query = query.filter(Task.assigned_to == current_user.id)

    if project_id:
        query = query.filter(Task.project_id == project_id)
    if assigned_to:
        query = query.filter(Task.assigned_to == assigned_to)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if priority:
        query = query.filter(Task.priority == priority)
    if keyword:
        query = query.filter(Task.title.ilike(f"%{keyword}%"))

    tasks = query.order_by(Task.due_date.is_(None), Task.due_date.asc()).all()
    results = [_serialize(t) for t in tasks]
    if overdue_only:
        results = [r for r in results if r.is_overdue]
    return results


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager)
):
    task = Task(**payload.model_dump(), created_by=current_user.id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return _serialize(task)


@router.get("/{task_id}", response_model=TaskDetailOut)
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role == UserRole.TEAM_MEMBER and task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to view this task")
    return _serialize_detail(task)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    data = payload.model_dump(exclude_unset=True)

    if current_user.role == UserRole.TEAM_MEMBER:
        if task.assigned_to != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to update this task")
        allowed_fields = {"status"}
        if not set(data.keys()) <= allowed_fields:
            raise HTTPException(
                status_code=403, detail="Team members may only update task status"
            )

    for field, value in data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return _serialize(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None


@router.get("/recommend/{project_id}", response_model=RecommendationResponse)
def recommend(project_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return recommend_assignee(db, project_id)
