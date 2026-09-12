from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

INSECURE_DEFAULT_JWT_SECRET = "insecure-dev-secret-change-me"


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "teamflow"
    db_user: str = "root"
    db_password: str = "changeme"

    jwt_secret: str = INSECURE_DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    environment: str = "development"
    cors_origins: str = "http://localhost:5500,http://127.0.0.1:5500"
    admin_setup_token: str | None = None

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() not in ("development", "dev", "test", "testing")

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="mysql+pymysql",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )


settings = Settings()

if settings.is_production and settings.jwt_secret == INSECURE_DEFAULT_JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is unset or using the insecure default. Set a strong, random JWT_SECRET "
        "environment variable before running outside of development."
    )
