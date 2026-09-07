from pydantic import BaseModel


class WorkloadOut(BaseModel):
    user_id: int
    name: str
    role: str
    active_tasks: int
    completed_tasks: int
    overdue_tasks: int
    total_tasks: int
    completion_rate: float
    workload_score: float


class DashboardSummary(BaseModel):
    total_projects: int
    active_projects: int
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    critical_tasks: int
    status_distribution: dict[str, int]
    priority_distribution: dict[str, int]
    workload: list[WorkloadOut]
    recent_tasks: list[dict]
