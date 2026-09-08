from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError

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


@app.exception_handler(IntegrityError)
def integrity_error_handler(request: Request, exc: IntegrityError):
    # A unique/foreign-key constraint fired at the DB level — most commonly a
    # race on a duplicate email, or a reference to a row that doesn't exist.
    # Return a clean 409 instead of leaking a raw 500 + DB traceback.
    return JSONResponse(status_code=409, content={"detail": "This request conflicts with existing data."})

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
