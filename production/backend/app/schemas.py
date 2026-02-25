"""Esquemes Pydantic per validació d'entrada/sortida de l'API."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.models import LeadStatus, LeadSource, Language, AlertPriority, PipelineStage


# ── Lead ──

class LeadCreate(BaseModel):
    nom: str = Field(..., min_length=1, max_length=200)
    cognom: str = ""
    email: EmailStr
    telefon: str = ""
    empresa: str = ""
    carrec: str = ""
    web_empresa: str = ""
    codi_postal: str = ""
    ciutat: str = ""
    comunitat_autonoma: str = ""
    origen: LeadSource = LeadSource.WEB
    consentiment_rgpd: bool = False
    consentiment_marketing: bool = False
    tags: list[str] = []
    notes: str = ""
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""


class LeadUpdate(BaseModel):
    nom: Optional[str] = None
    cognom: Optional[str] = None
    telefon: Optional[str] = None
    empresa: Optional[str] = None
    carrec: Optional[str] = None
    estat: Optional[LeadStatus] = None
    tags: Optional[list[str]] = None
    notes: Optional[str] = None


class LeadResponse(BaseModel):
    id: int
    nom: str
    cognom: str
    email: str
    telefon: str
    empresa: str
    carrec: str
    codi_postal: str
    idioma_preferit: Language
    score: int
    estat: LeadStatus
    origen: LeadSource
    etapa_pipeline: PipelineStage
    tags: list
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadListResponse(BaseModel):
    leads: list[LeadResponse]
    total: int
    page: int
    per_page: int


# ── Interaction ──

class InteractionCreate(BaseModel):
    lead_id: int
    tipus: str
    canal: str = ""
    descripcio: str = ""
    metadata_json: dict = {}


class InteractionResponse(BaseModel):
    id: int
    lead_id: int
    tipus: str
    canal: str
    descripcio: str
    punts_scoring: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Alert ──

class AlertResponse(BaseModel):
    id: int
    lead_id: Optional[int]
    tipus: str
    missatge: str
    prioritat: AlertPriority
    llegida: bool
    resolta: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard Stats ──

class DashboardStats(BaseModel):
    total_leads: int
    leads_nous: int
    leads_qualificats: int
    leads_proposta: int
    leads_tancats: int
    score_mitja: float
    leads_per_idioma: dict
    leads_per_origen: dict
    emails_enviats: int
    emails_oberts: int
    alertes_pendents: int
    pipeline_valor: float


# ── Webhook ──

class WebhookLeadCapture(BaseModel):
    """Format per captura de leads des de formularis externs."""
    name: str
    email: EmailStr
    phone: str = ""
    company: str = ""
    role: str = ""
    postal_code: str = ""
    source: str = "web"
    gdpr_consent: bool = False
    marketing_consent: bool = False
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    language: str = ""
