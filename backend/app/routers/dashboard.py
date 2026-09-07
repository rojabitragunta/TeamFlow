from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.dependencies.auth import get_current_user
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.schemas.workload import DashboardSummary
from app.services.task_service import is_task_overdue
from app.services.workload_service import compute_team_workload

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task_query = db.query(Task)
    project_query = db.query(Project)

    if current_user.role == UserRole.TEAM_MEMBER:
        task_query = task_query.filter(Task.assigned_to == current_user.id)

    projects = project_query.all()
    tasks = task_query.all()

    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    in_progress_tasks = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    overdue_tasks = sum(1 for t in tasks if is_task_overdue(t))
    critical_tasks = sum(1 for t in tasks if t.priority == TaskPriority.CRITICAL)

    status_distribution = {s.value: sum(1 for t in tasks if t.status == s) for s in TaskStatus}
    priority_distribution = {p.value: sum(1 for t in tasks if t.priority == p) for p in TaskPriority}

    if current_user.role == UserRole.TEAM_MEMBER:
        workload = []
    else:
        members = db.query(User).filter(User.role == UserRole.TEAM_MEMBER).all()
        workload = compute_team_workload(db, members)

    recent = sorted(tasks, key=lambda t: t.created_at, reverse=True)[:8]
    recent_tasks = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status.value,
            "priority": t.priority.value,
            "project_id": t.project_id,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "is_overdue": is_task_overdue(t),
        }
        for t in recent
    ]

    return DashboardSummary(
        total_projects=len(projects),
        active_projects=sum(1 for p in projects if p.status == ProjectStatus.ACTIVE),
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        in_progress_tasks=in_progress_tasks,
        overdue_tasks=overdue_tasks,
        critical_tasks=critical_tasks,
        status_distribution=status_distribution,
        priority_distribution=priority_distribution,
        workload=workload,
        recent_tasks=recent_tasks,
    )
