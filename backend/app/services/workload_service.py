from sqlalchemy.orm import Session

from app.models.task import Task, TaskStatus
from app.models.user import User
from app.services.task_service import is_task_overdue


def _workload_from_tasks(user: User, tasks: list[Task]) -> dict:
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


def compute_user_workload(db: Session, user: User) -> dict:
    tasks = db.query(Task).filter(Task.assigned_to == user.id).all()
    return _workload_from_tasks(user, tasks)


def compute_team_workload(db: Session, users: list[User]) -> list[dict]:
    """Batch-computes workload for many users in a single query instead of
    issuing one Task query per user (N+1)."""
    if not users:
        return []

    user_ids = [u.id for u in users]
    all_tasks = db.query(Task).filter(Task.assigned_to.in_(user_ids)).all()

    tasks_by_user: dict[int, list[Task]] = {uid: [] for uid in user_ids}
    for task in all_tasks:
        tasks_by_user[task.assigned_to].append(task)

    return [_workload_from_tasks(u, tasks_by_user[u.id]) for u in users]
