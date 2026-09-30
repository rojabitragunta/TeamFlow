import certifi
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _connect_args() -> dict:
    """TLS connect args for PyMySQL.

    PyMySQL's `ssl` connect arg only turns on real certificate + hostname
    verification when an explicit CA bundle is supplied — with no `ca` given,
    it silently falls back to `verify_mode=CERT_NONE` and
    `check_hostname=False` even if you pass `check_hostname: True` in the
    dict (see PyMySQL Connection._create_ssl_ctx: `hasnoca` forces both off).
    So we always pass certifi's trusted CA bundle, which covers the publicly
    signed certificates TiDB Cloud (and other managed MySQL hosts) present.
    """
    if not settings.db_use_ssl:
        return {}
    return {
        "ssl": {
            "ca": certifi.where(),
            "check_hostname": True,
            "verify_mode": "required",
        }
    }


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args=_connect_args(),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
