from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskPriority, TaskStatus
from app.schemas.user import UserOut


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.TODO
    due_date: datetime | None = None
    assigned_to: int | None = None


class TaskCreate(TaskBase):
    project_id: int


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    due_date: datetime | None = None
    assigned_to: int | None = None
    project_id: int | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    is_overdue: bool = False


class TaskDetailOut(TaskOut):
    assignee: UserOut | None = None
    creator: UserOut | None = None


class RecommendationOut(BaseModel):
    user_id: int
    name: str
    score: float
    reason: str


class RecommendationResponse(BaseModel):
    recommended: RecommendationOut | None
    candidates: list[RecommendationOut]
