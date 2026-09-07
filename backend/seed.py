"""Seed the TeamFlow database with realistic demo data.

Usage (from the backend/ directory, with the venv active):
    python seed.py
"""
from datetime import date, datetime, timedelta, timezone

from app.core.security import hash_password
from app.database.database import Base, SessionLocal, engine
from app.models.comment import Comment
from app.models.project import Project, ProjectStatus
from app.models.project_member import ProjectMember
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    if db.query(User).count() > 0:
        print("Database already has data — skipping seed. Delete the tables first if you want a fresh seed.")
        raise SystemExit(0)

    def pwd(p="password123"):
        return hash_password(p)

    admin = User(name="Roja Bitragunta", email="admin@teamflow.com", password_hash=pwd(), role=UserRole.ADMIN)
    pm = User(name="Aditya Rao", email="pm@teamflow.com", password_hash=pwd(), role=UserRole.PROJECT_MANAGER)
    members = [
        User(name="Priya Sharma", email="priya@teamflow.com", password_hash=pwd(), role=UserRole.TEAM_MEMBER),
        User(name="Rahul Verma", email="rahul@teamflow.com", password_hash=pwd(), role=UserRole.TEAM_MEMBER),
        User(name="Sara Khan", email="sara@teamflow.com", password_hash=pwd(), role=UserRole.TEAM_MEMBER),
        User(name="Karan Mehta", email="karan@teamflow.com", password_hash=pwd(), role=UserRole.TEAM_MEMBER),
    ]

    db.add_all([admin, pm, *members])
    db.commit()
    for u in [admin, pm, *members]:
        db.refresh(u)

    today = date.today()

    projects = [
        Project(
            name="Website Revamp",
            description="Redesign the public marketing site with a new component library and faster load times.",
            status=ProjectStatus.ACTIVE,
            start_date=today - timedelta(days=30),
            end_date=today + timedelta(days=30),
            created_by=pm.id,
        ),
        Project(
            name="Mobile App Launch",
            description="Ship v1.0 of the TeamFlow companion mobile app for iOS and Android.",
            status=ProjectStatus.ACTIVE,
            start_date=today - timedelta(days=15),
            end_date=today + timedelta(days=60),
            created_by=pm.id,
        ),
        Project(
            name="Internal Analytics Platform",
            description="Build an internal dashboard for tracking product usage metrics.",
            status=ProjectStatus.PLANNED,
            start_date=today + timedelta(days=10),
            end_date=today + timedelta(days=90),
            created_by=admin.id,
        ),
        Project(
            name="Customer Onboarding Revamp",
            description="Streamline the new customer onboarding flow and reduce drop-off.",
            status=ProjectStatus.COMPLETED,
            start_date=today - timedelta(days=90),
            end_date=today - timedelta(days=10),
            created_by=pm.id,
        ),
    ]
    db.add_all(projects)
    db.commit()
    for p in projects:
        db.refresh(p)

    all_users = [admin, pm, *members]
    for project in projects:
        for u in all_users:
            db.add(ProjectMember(project_id=project.id, user_id=u.id))
    db.commit()

    def dt(days_offset):
        return datetime.now(timezone.utc) + timedelta(days=days_offset)

    task_specs = [
        (projects[0], "Set up new design system", TaskPriority.HIGH, TaskStatus.COMPLETED, members[0], -20),
        (projects[0], "Rebuild homepage hero section", TaskPriority.HIGH, TaskStatus.IN_PROGRESS, members[0], 5),
        (projects[0], "Migrate blog to new CMS", TaskPriority.MEDIUM, TaskStatus.TODO, members[1], 12),
        (projects[0], "Fix broken checkout links", TaskPriority.CRITICAL, TaskStatus.IN_PROGRESS, members[1], -2),
        (projects[0], "Accessibility audit", TaskPriority.MEDIUM, TaskStatus.REVIEW, members[2], 3),
        (projects[1], "Implement push notifications", TaskPriority.HIGH, TaskStatus.IN_PROGRESS, members[2], 7),
        (projects[1], "App Store submission checklist", TaskPriority.CRITICAL, TaskStatus.TODO, members[3], -1),
        (projects[1], "Offline sync for task list", TaskPriority.MEDIUM, TaskStatus.TODO, members[3], 15),
        (projects[1], "Beta tester feedback triage", TaskPriority.LOW, TaskStatus.COMPLETED, members[0], -10),
        (projects[1], "Crash reporting integration", TaskPriority.HIGH, TaskStatus.REVIEW, members[1], 2),
        (projects[2], "Define KPI schema", TaskPriority.MEDIUM, TaskStatus.TODO, members[2], 20),
        (projects[2], "Evaluate charting libraries", TaskPriority.LOW, TaskStatus.TODO, members[3], 25),
        (projects[3], "Design new onboarding wizard", TaskPriority.HIGH, TaskStatus.COMPLETED, members[0], -60),
        (projects[3], "A/B test onboarding copy", TaskPriority.MEDIUM, TaskStatus.COMPLETED, members[1], -45),
        (projects[3], "Roll out to 100% of users", TaskPriority.HIGH, TaskStatus.COMPLETED, members[2], -15),
    ]

    tasks = []
    for project, title, priority, status, assignee, due_offset in task_specs:
        tasks.append(
            Task(
                project_id=project.id,
                title=title,
                description=f"{title} for the {project.name} initiative.",
                assigned_to=assignee.id,
                created_by=pm.id,
                priority=priority,
                status=status,
                due_date=dt(due_offset),
            )
        )
    db.add_all(tasks)
    db.commit()
    for t in tasks:
        db.refresh(t)

    comment_specs = [
        (tasks[1], members[0], "Started on the hero layout, will share a preview by EOD."),
        (tasks[1], pm, "Looks great so far — make sure it's responsive on tablet too."),
        (tasks[3], members[1], "Found the root cause, patch incoming."),
        (tasks[6], members[3], "Blocked on App Store review guidelines clarification."),
    ]
    for task, user, text in comment_specs:
        db.add(Comment(task_id=task.id, user_id=user.id, comment=text))
    db.commit()

    print("Seed complete.")
    print("  Admin login:            admin@teamflow.com / password123")
    print("  Project Manager login:  pm@teamflow.com / password123")
    print("  Team member login:      priya@teamflow.com / password123 (also rahul/sara/karan)")

finally:
    db.close()
