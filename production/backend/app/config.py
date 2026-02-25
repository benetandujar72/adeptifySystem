"""
Configuració centralitzada de l'aplicació.
Totes les variables sensibles es carreguen des de variables d'entorn.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──
    APP_NAME: str = "Campanya Consultoria Digital"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "https://impulsa.edutac.es"]

    # ── URLs de l'aplicació (sense barra final) ──
    APP_URL: str = "https://adeptifysystem-1061852826388.europe-west1.run.app"
    DASHBOARD_URL: str = ""   # Si buit, s'usa APP_URL + /dashboard
    CAMPAIGN_NAME: str = "Adeptify – Consultoria Digital"

    # ── Base de Dades ──
    DATABASE_URL: str = "postgresql+asyncpg://campanya:campanya@db:5432/campanya_crm"
    DATABASE_ECHO: bool = False

    # ── Redis ──
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # ── Email: Gmail SMTP (principal) ──
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""
    EMAIL_FROM: str = ""         # Si buit, s'usa GMAIL_USER
    EMAIL_FROM_NAME: str = "Adeptify – Consultoria Digital"
    LEAD_NOTIFICATION_EMAIL: str = "bandujar@edutac.es"

    # ── Email: SendGrid (fallback) ──
    SENDGRID_API_KEY: str = ""

    # ── IA ──
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_MODEL_CHAT: str = "claude-sonnet-4-5-20250929"
    AI_MODEL_AGENTS: str = "claude-sonnet-4-5-20250929"
    GEMINI_MODEL_IMAGES: str = "gemini-2.5-flash-image"

    # ── Auth (JWT) ──
    JWT_SECRET_KEY: str = "CHANGE-ME-JWT-SECRET"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24h

    # ── Observabilitat ──
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    # ── Idiomes ──
    DEFAULT_LANGUAGE: str = "ca"
    SUPPORTED_LANGUAGES: list[str] = ["ca", "es", "eu"]

    # ── Scoring ──
    SCORE_THRESHOLD_MQL: int = 30
    SCORE_THRESHOLD_SQL: int = 60
    SCORE_THRESHOLD_HOT: int = 80

    def get_app_url(self) -> str:
        return self.APP_URL.rstrip("/")

    def get_dashboard_url(self) -> str:
        if self.DASHBOARD_URL:
            return self.DASHBOARD_URL.rstrip("/")
        return f"{self.get_app_url()}/dashboard"

    def get_from_email(self) -> str:
        return self.EMAIL_FROM or self.GMAIL_USER

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

