from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.task import Task, TaskStatus


def is_task_overdue(task: Task) -> bool:
    if task.status == TaskStatus.COMPLETED or task.due_date is None:
        return False
    due = task.due_date
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    return due < datetime.now(timezone.utc)


def get_overdue_tasks(db: Session, project_id: int | None = None) -> list[Task]:
    query = db.query(Task).filter(Task.status != TaskStatus.COMPLETED, Task.due_date.isnot(None))
    if project_id:
        query = query.filter(Task.project_id == project_id)
    now = datetime.now(timezone.utc)
    return [t for t in query.all() if is_task_overdue(t)]
