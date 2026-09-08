from sqlalchemy.orm import Session

from app.models.project_member import ProjectMember
from app.services.workload_service import compute_team_workload


def recommend_assignee(db: Session, project_id: int) -> dict:
    """Rule-based smart assignee recommendation.

    Scores each project member using active workload, overdue tasks and
    completion rate. Lower active/overdue load and higher completion rate
    produce a higher (better) score. Purely arithmetic, no external AI call.
    """
    member_rows = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    members = [row.user for row in member_rows]
    workloads = compute_team_workload(db, members)
    candidates = []

    for w in workloads:
        score = 100.0
        score -= w["active_tasks"] * 12
        score -= w["overdue_tasks"] * 20
        score += w["completion_rate"] * 0.3
        score = max(0.0, round(score, 1))

        reasons = []
        if w["active_tasks"] == 0:
            reasons.append("no active tasks currently")
        else:
            reasons.append(f"{w['active_tasks']} active task(s)")
        if w["overdue_tasks"] > 0:
            reasons.append(f"{w['overdue_tasks']} overdue task(s) (penalized)")
        reasons.append(f"{w['completion_rate']}% completion rate")

        candidates.append(
            {
                "user_id": w["user_id"],
                "name": w["name"],
                "score": score,
                "reason": ", ".join(reasons),
            }
        )

    candidates.sort(key=lambda c: c["score"], reverse=True)
    recommended = candidates[0] if candidates else None

    return {"recommended": recommended, "candidates": candidates}
