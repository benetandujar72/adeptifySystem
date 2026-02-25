"""
Configuració Celery per automatització d'agents.
"""
import os
from celery import Celery
from celery.schedules import crontab

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/2")

app = Celery("campanya_agents", broker=broker_url, backend=result_backend)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Madrid",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=300,   # 5 min
    task_time_limit=600,        # 10 min
)

# Registrar tasques
app.autodiscover_tasks(["agents"])

# ── Planificació automàtica ──
app.conf.beat_schedule = {
    # Cada hora: processar nous leads pendents
    "process-new-leads": {
        "task": "agents.tasks.process_pending_leads",
        "schedule": crontab(minute=0),  # Cada hora en punt
    },
    # Cada 30 min: enviar emails programats
    "send-scheduled-emails": {
        "task": "agents.tasks.send_scheduled_emails",
        "schedule": crontab(minute="*/30"),
    },
    # Cada 6h: actualitzar scoring de tots els leads
    "refresh-scoring": {
        "task": "agents.tasks.refresh_all_scoring",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    # Cada dia a les 8:00: resum diari al consultor
    "daily-summary": {
        "task": "agents.tasks.send_daily_summary",
        "schedule": crontab(minute=0, hour=8),
    },
    # Cada dia a les 9:00: detectar leads inactius (>7d)
    "detect-inactive-leads": {
        "task": "agents.tasks.detect_inactive_leads",
        "schedule": crontab(minute=0, hour=9),
    },
    # Cada dilluns 7:00: informe setmanal d'analytics
    "weekly-analytics": {
        "task": "agents.tasks.generate_weekly_analytics",
        "schedule": crontab(minute=0, hour=7, day_of_week=1),
    },
}
