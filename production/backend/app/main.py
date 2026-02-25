"""
═══════════════════════════════════════════════════════════════════════════════
BACKEND API - CAMPANYA CONSULTORIA DIGITAL
═══════════════════════════════════════════════════════════════════════════════
FastAPI backend de producció per gestió de leads, automatització d'emails,
scoring, agents IA i pipeline de vendes.

Endpoints:
  /api/v1/leads         - CRUD de leads + captura
  /api/v1/interactions  - Registre d'interaccions
  /api/v1/emails        - Automatització d'emails
  /api/v1/alerts        - Sistema d'alertes
  /api/v1/dashboard     - Estadístiques i KPIs
  /api/v1/agents        - Gestió d'agents IA
  /api/v1/webhooks      - Webhooks per integracions
  /api/v1/webinars      - Gestió de webinars
  /api/v1/documents     - Documents personalitzats
  /api/v1/images        - Generació d'imatges Nano Banana
  /health               - Health check
═══════════════════════════════════════════════════════════════════════════════
"""
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings, Settings
from app.database import get_db, engine
from app.models import (
    Base, Lead, Interaction, AutomatedEmail, Alert, Opportunity,
    Campaign, Webinar, WebinarRegistration, AgentConfig, AgentLog,
    LeadStatus, Language, PipelineStage, AlertPriority,
)
from app.schemas import (
    LeadCreate, LeadUpdate, LeadResponse, LeadListResponse,
    InteractionCreate, InteractionResponse,
    AlertResponse, DashboardStats, WebhookLeadCapture,
)
from app.language_detector import detect_language
from agents.email_sender import EmailSender
from app.scoring import (
    calculate_interaction_score, calculate_profile_score,
    get_lead_tier, should_trigger_alert,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# APP LIFECYCLE
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Crea taules al iniciar (dev) / verifica connexió (prod)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Base de dades inicialitzada")
    yield
    await engine.dispose()


settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API de gestió de campanya de consultoria digital",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# BACKGROUND TASKS
# ─────────────────────────────────────────────────────────────────────────────

async def process_new_lead(lead_id: int, db: AsyncSession):
    """Processa un nou lead: scoring, idioma, primera seqüència email."""
    lead = await db.get(Lead, lead_id)
    if not lead:
        return

    # 1. Detectar idioma
    lang = detect_language(lead.codi_postal, lead.comunitat_autonoma)
    lead.idioma_preferit = Language(lang)
    lead.idioma_detectat = True

    # 2. Calcular score de perfil
    profile_score = calculate_profile_score(
        empresa=lead.empresa,
        carrec=lead.carrec,
        telefon=lead.telefon,
        web=lead.web_empresa,
    )
    lead.score = profile_score

    # 3. Classificar
    lead.etapa_pipeline = PipelineStage(get_lead_tier(lead.score))

    await db.commit()
    logger.info(f"Lead {lead_id} processat: idioma={lang}, score={profile_score}")

    # 4. Enviar email de benvinguda al lead i notificació interna
    sender = EmailSender()
    sender.send_welcome_email({
        "nom": lead.nom,
        "email": lead.email,
        "empresa": lead.empresa or "",
        "telefon": lead.telefon or "",
        "idioma": lang,
        "origen": lead.origen.value if lead.origen else "web",
        "score": profile_score,
    })
    logger.info(f"Lead {lead_id}: email de benvinguda enviat a {lead.email}")


async def create_alert_for_lead(
    db: AsyncSession, lead_id: int, tipus: str, missatge: str,
    prioritat: AlertPriority = AlertPriority.MITJANA
):
    """Crea una alerta associada a un lead."""
    alert = Alert(
        lead_id=lead_id,
        tipus=tipus,
        missatge=missatge,
        prioritat=prioritat,
    )
    db.add(alert)
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# LEADS
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/leads", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Crea un nou lead i llança processament asíncron."""
    # Verificar duplicat
    existing = await db.execute(select(Lead).where(Lead.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Lead amb email {data.email} ja existeix")

    lead = Lead(**data.model_dump())
    if data.consentiment_rgpd:
        lead.data_consentiment = datetime.utcnow()

    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    # Processament asíncron
    background_tasks.add_task(process_new_lead, lead.id, db)

    logger.info(f"Nou lead creat: {lead.id} - {lead.email}")
    return lead


@app.get("/api/v1/leads", response_model=LeadListResponse)
async def list_leads(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    estat: LeadStatus | None = None,
    idioma: Language | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_db),
):
    """Llista leads amb paginació, filtres i cerca."""
    query = select(Lead)

    if estat:
        query = query.where(Lead.estat == estat)
    if idioma:
        query = query.where(Lead.idioma_preferit == idioma)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Lead.nom.ilike(pattern),
                Lead.email.ilike(pattern),
                Lead.empresa.ilike(pattern),
            )
        )

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    # Sort
    sort_col = getattr(Lead, sort_by, Lead.created_at)
    if sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    leads = result.scalars().all()

    return LeadListResponse(
        leads=[LeadResponse.model_validate(l) for l in leads],
        total=total,
        page=page,
        per_page=per_page,
    )


@app.get("/api/v1/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead no trobat")
    return lead


@app.patch("/api/v1/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int, data: LeadUpdate, db: AsyncSession = Depends(get_db)
):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead no trobat")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    lead.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(lead)
    return lead


# ─────────────────────────────────────────────────────────────────────────────
# INTERACTIONS
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/interactions", response_model=InteractionResponse, status_code=201)
async def create_interaction(
    data: InteractionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Registra interacció i actualitza scoring del lead."""
    lead = await db.get(Lead, data.lead_id)
    if not lead:
        raise HTTPException(404, "Lead no trobat")

    points = calculate_interaction_score(data.tipus)
    interaction = Interaction(
        **data.model_dump(),
        punts_scoring=points,
    )
    db.add(interaction)

    # Actualitzar score
    previous_score = lead.score
    lead.score += points
    lead.updated_at = datetime.utcnow()

    # Re-classificar
    new_tier = get_lead_tier(lead.score)
    lead.etapa_pipeline = PipelineStage(new_tier)

    # Alerta si ha canviat de tier
    alert_tier = should_trigger_alert(lead.score, previous_score)
    if alert_tier:
        await create_alert_for_lead(
            db, lead.id,
            tipus=f"tier_upgrade_{alert_tier}",
            missatge=f"Lead {lead.nom} ({lead.email}) ha passat a {alert_tier.upper()} (score: {lead.score})",
            prioritat=AlertPriority.ALTA if alert_tier in ("sql", "hot") else AlertPriority.MITJANA,
        )

    await db.commit()
    await db.refresh(interaction)
    return interaction


@app.get("/api/v1/leads/{lead_id}/interactions", response_model=list[InteractionResponse])
async def list_lead_interactions(lead_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Interaction)
        .where(Interaction.lead_id == lead_id)
        .order_by(Interaction.created_at.desc())
    )
    return result.scalars().all()


# ─────────────────────────────────────────────────────────────────────────────
# ALERTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/alerts", response_model=list[AlertResponse])
async def list_alerts(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Alert).order_by(Alert.created_at.desc()).limit(limit)
    if unread_only:
        query = query.where(Alert.llegida == False)
    result = await db.execute(query)
    return result.scalars().all()


@app.patch("/api/v1/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alerta no trobada")
    alert.llegida = True
    await db.commit()
    return {"status": "ok"}


@app.patch("/api/v1/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alerta no trobada")
    alert.resolta = True
    alert.data_resolucio = datetime.utcnow()
    await db.commit()
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Retorna estadístiques generals del dashboard."""
    # Total leads
    total = (await db.execute(select(func.count(Lead.id)))).scalar() or 0

    # Per estat
    nous = (await db.execute(
        select(func.count(Lead.id)).where(Lead.estat == LeadStatus.NOU)
    )).scalar() or 0
    qualificats = (await db.execute(
        select(func.count(Lead.id)).where(Lead.estat == LeadStatus.QUALIFICAT)
    )).scalar() or 0
    proposta = (await db.execute(
        select(func.count(Lead.id)).where(Lead.estat == LeadStatus.PROPOSTA)
    )).scalar() or 0
    tancats = (await db.execute(
        select(func.count(Lead.id)).where(Lead.estat == LeadStatus.TANCAT_GUANYAT)
    )).scalar() or 0

    # Score mitjà
    avg_score = (await db.execute(select(func.avg(Lead.score)))).scalar() or 0

    # Per idioma
    lang_result = await db.execute(
        select(Lead.idioma_preferit, func.count(Lead.id))
        .group_by(Lead.idioma_preferit)
    )
    leads_idioma = {str(row[0].value): row[1] for row in lang_result.all()}

    # Per origen
    source_result = await db.execute(
        select(Lead.origen, func.count(Lead.id))
        .group_by(Lead.origen)
    )
    leads_origen = {str(row[0].value): row[1] for row in source_result.all()}

    # Emails
    emails_enviats = (await db.execute(
        select(func.count(AutomatedEmail.id)).where(AutomatedEmail.enviat == True)
    )).scalar() or 0
    emails_oberts = (await db.execute(
        select(func.count(AutomatedEmail.id)).where(AutomatedEmail.obert == True)
    )).scalar() or 0

    # Alertes pendents
    alertes = (await db.execute(
        select(func.count(Alert.id)).where(Alert.resolta == False)
    )).scalar() or 0

    # Pipeline valor
    pipeline_valor = (await db.execute(
        select(func.sum(Opportunity.valor_estimat))
    )).scalar() or 0

    return DashboardStats(
        total_leads=total,
        leads_nous=nous,
        leads_qualificats=qualificats,
        leads_proposta=proposta,
        leads_tancats=tancats,
        score_mitja=round(float(avg_score), 1),
        leads_per_idioma=leads_idioma,
        leads_per_origen=leads_origen,
        emails_enviats=emails_enviats,
        emails_oberts=emails_oberts,
        alertes_pendents=alertes,
        pipeline_valor=float(pipeline_valor),
    )


# ─────────────────────────────────────────────────────────────────────────────
# WEBHOOKS (captura externa de leads)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/webhooks/lead-capture", status_code=201)
async def webhook_lead_capture(
    data: WebhookLeadCapture,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint webhook per captura de leads des de formularis externs,
    landing pages, o integracions de tercers.
    """
    # Verificar duplicat
    existing = await db.execute(select(Lead).where(Lead.email == data.email))
    if existing.scalar_one_or_none():
        return {"status": "duplicate", "message": "Lead ja existent"}

    lead = Lead(
        nom=data.name,
        email=data.email,
        telefon=data.phone,
        empresa=data.company,
        carrec=data.role,
        codi_postal=data.postal_code,
        origen=data.source if data.source else "web",
        consentiment_rgpd=data.gdpr_consent,
        consentiment_marketing=data.marketing_consent,
        utm_source=data.utm_source,
        utm_medium=data.utm_medium,
        utm_campaign=data.utm_campaign,
    )

    # Idioma: preferència manual o detecció automàtica
    if data.language and data.language in ("ca", "es", "eu"):
        lead.idioma_preferit = Language(data.language)
    else:
        lang = detect_language(data.postal_code)
        lead.idioma_preferit = Language(lang)
        lead.idioma_detectat = True

    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    background_tasks.add_task(process_new_lead, lead.id, db)

    return {
        "status": "created",
        "lead_id": lead.id,
        "language_detected": lead.idioma_preferit.value,
    }


# ─────────────────────────────────────────────────────────────────────────────
# AGENTS IA
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/agents")
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfig).order_by(AgentConfig.nom))
    agents = result.scalars().all()
    return [
        {
            "id": a.id,
            "nom": a.nom,
            "descripcio": a.descripcio,
            "model": a.model,
            "actiu": a.actiu,
            "last_run": a.last_run.isoformat() if a.last_run else None,
        }
        for a in agents
    ]


@app.post("/api/v1/agents/{agent_name}/trigger")
async def trigger_agent(agent_name: str, db: AsyncSession = Depends(get_db)):
    """Llança manualment un agent."""
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.nom == agent_name)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, f"Agent '{agent_name}' no trobat")
    if not agent.actiu:
        raise HTTPException(400, f"Agent '{agent_name}' està desactivat")

    # Log de trigger
    log = AgentLog(
        agent_name=agent_name,
        action="manual_trigger",
        input_data={"triggered_by": "api"},
    )
    db.add(log)
    agent.last_run = datetime.utcnow()
    await db.commit()

    return {"status": "triggered", "agent": agent_name}


@app.get("/api/v1/agents/logs")
async def get_agent_logs(
    agent_name: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(AgentLog).order_by(AgentLog.created_at.desc()).limit(limit)
    if agent_name:
        query = query.where(AgentLog.agent_name == agent_name)
    result = await db.execute(query)
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "agent_name": l.agent_name,
            "action": l.action,
            "lead_id": l.lead_id,
            "success": l.success,
            "tokens_used": l.tokens_used,
            "duration_ms": l.duration_ms,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]


# ─────────────────────────────────────────────────────────────────────────────
# WEBINARS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/webinars")
async def list_webinars(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Webinar).order_by(Webinar.data_hora.desc()))
    webinars = result.scalars().all()
    return [
        {
            "id": w.id,
            "titol": w.titol,
            "data_hora": w.data_hora.isoformat(),
            "estat": w.estat,
            "link_registre": w.link_registre,
        }
        for w in webinars
    ]


@app.post("/api/v1/webinars/{webinar_id}/register")
async def register_for_webinar(
    webinar_id: int, lead_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    webinar = await db.get(Webinar, webinar_id)
    if not webinar:
        raise HTTPException(404, "Webinar no trobat")

    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead no trobat")

    reg = WebinarRegistration(webinar_id=webinar_id, lead_id=lead_id)
    db.add(reg)

    # Registrar interacció
    interaction = Interaction(
        lead_id=lead_id,
        tipus="registre_webinar",
        canal="web",
        descripcio=f"Registre al webinar: {webinar.titol}",
        punts_scoring=calculate_interaction_score("registre_webinar"),
    )
    db.add(interaction)
    lead.score += interaction.punts_scoring

    await db.commit()
    return {"status": "registered"}


# ─────────────────────────────────────────────────────────────────────────────
# IMATGES (Nano Banana)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/images/generate")
async def generate_image(
    prompt: str,
    aspect_ratio: str = "16:9",
    size: str = "2K",
    lang: str = "ca",
):
    """Genera una imatge via Nano Banana API (Gemini Image)."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(500, "GEMINI_API_KEY no configurada")

    import json
    import urllib.request
    import base64

    model = settings.GEMINI_MODEL_IMAGES
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": {
                "aspectRatio": aspect_ratio,
                "imageSize": size,
            },
        },
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.GEMINI_API_KEY,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        for part in data["candidates"][0]["content"]["parts"]:
            if "inlineData" in part:
                image_b64 = part["inlineData"]["data"]
                return {
                    "status": "success",
                    "image_base64": image_b64,
                    "mime_type": part["inlineData"].get("mimeType", "image/png"),
                    "model": model,
                }

        return {"status": "error", "message": "No s'ha generat cap imatge"}
    except Exception as e:
        raise HTTPException(500, f"Error generant imatge: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=4 if not settings.DEBUG else 1,
    )
