from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.dependencies.auth import get_current_user
from app.models.comment import Comment
from app.models.task import Task
from app.models.user import User, UserRole
from app.schemas.comment import CommentCreate, CommentOut

router = APIRouter(prefix="/api", tags=["comments"])


def _check_task_access(task: Task, current_user: User):
    if current_user.role == UserRole.TEAM_MEMBER and task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to access this task's comments")


@router.get("/tasks/{task_id}/comments", response_model=list[CommentOut])
def list_comments(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _check_task_access(task, current_user)
    return db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.created_at.asc()).all()


@router.post("/tasks/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    task_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    _check_task_access(task, current_user)
    comment = Comment(task_id=task_id, user_id=current_user.id, comment=payload.comment)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if current_user.role != UserRole.ADMIN and comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    db.delete(comment)
    db.commit()
    return None
