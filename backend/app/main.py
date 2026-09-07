from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.database.database import Base, engine
from app.database.migrations import run_safe_migrations
from app.models import *  # noqa: F401,F403  (ensures all models are registered on Base)
from app.routers import auth, comments, dashboard, projects, tasks, users, workload

app = FastAPI(
    title="TeamFlow API",
    description="Role-based team task & workload management platform.",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
        run_safe_migrations(engine)
    except Exception as exc:  # pragma: no cover - only hit when DB is unreachable
        import logging

        logging.getLogger("uvicorn.error").warning(
            "Could not connect to the database on startup: %s", exc
        )


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(comments.router)
app.include_router(dashboard.router)
app.include_router(workload.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
