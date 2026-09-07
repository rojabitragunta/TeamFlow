from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import ProjectStatus
from app.schemas.user import UserOut


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    status: ProjectStatus = ProjectStatus.PLANNED
    start_date: date | None = None
    end_date: date | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    status: ProjectStatus | None = None
    start_date: date | None = None
    end_date: date | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime


class ProjectMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    user_id: int
    joined_at: datetime
    user: UserOut


class ProjectMemberAdd(BaseModel):
    user_id: int


class ProjectDetailOut(ProjectOut):
    members: list[ProjectMemberOut] = []
    progress: float = 0.0
    task_count: int = 0
    completed_task_count: int = 0
