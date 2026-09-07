from sqlalchemy.orm import Session

from app.models.task import Task, TaskStatus
from app.models.user import User
from app.services.task_service import is_task_overdue


def compute_user_workload(db: Session, user: User) -> dict:
    tasks = db.query(Task).filter(Task.assigned_to == user.id).all()
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    active = sum(1 for t in tasks if t.status != TaskStatus.COMPLETED)
    overdue = sum(1 for t in tasks if is_task_overdue(t))
    completion_rate = round((completed / total) * 100, 1) if total else 0.0

    workload_score = min(100.0, round(active * 15 + overdue * 10, 1))

    return {
        "user_id": user.id,
        "name": user.name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "active_tasks": active,
        "completed_tasks": completed,
        "overdue_tasks": overdue,
        "total_tasks": total,
        "completion_rate": completion_rate,
        "workload_score": workload_score,
    }


def compute_team_workload(db: Session, users: list[User]) -> list[dict]:
    return [compute_user_workload(db, u) for u in users]
