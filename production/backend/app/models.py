"""
Models SQLAlchemy per a PostgreSQL de producció.
Migrat des de l'esquema SQLite original amb millores per producció.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime,
    ForeignKey, Index, Enum, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship, DeclarativeBase
import enum


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────────────────────────────────────

class LeadStatus(str, enum.Enum):
    NOU = "nou"
    CONTACTAT = "contactat"
    QUALIFICAT = "qualificat"
    PROPOSTA = "proposta"
    NEGOCIACIO = "negociacio"
    TANCAT_GUANYAT = "tancat_guanyat"
    TANCAT_PERDUT = "tancat_perdut"


class LeadSource(str, enum.Enum):
    WEB = "web"
    LINKEDIN = "linkedin"
    WEBINAR = "webinar"
    REFERIT = "referit"
    FORMULARI = "formulari"
    COLD_EMAIL = "cold_email"
    PUBLICITAT = "publicitat"


class Language(str, enum.Enum):
    CA = "ca"
    ES = "es"
    EU = "eu"


class AlertPriority(str, enum.Enum):
    BAIXA = "baixa"
    MITJANA = "mitjana"
    ALTA = "alta"
    CRITICA = "critica"


class PipelineStage(str, enum.Enum):
    LEAD = "lead"
    MQL = "mql"
    SQL = "sql"
    PROPOSTA = "proposta"
    NEGOCIACIO = "negociacio"
    TANCAT = "tancat"


# ─────────────────────────────────────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────────────────────────────────────

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(200), nullable=False)
    cognom = Column(String(200), default="")
    email = Column(String(320), nullable=False, unique=True, index=True)
    telefon = Column(String(20), default="")
    empresa = Column(String(300), default="")
    carrec = Column(String(200), default="")
    web_empresa = Column(String(500), default="")

    # Localització
    codi_postal = Column(String(10), default="")
    ciutat = Column(String(200), default="")
    comunitat_autonoma = Column(String(100), default="")
    pais = Column(String(100), default="Espanya")

    # Idioma i scoring
    idioma_preferit = Column(Enum(Language), default=Language.CA)
    idioma_detectat = Column(Boolean, default=False)
    score = Column(Integer, default=0)
    estat = Column(Enum(LeadStatus), default=LeadStatus.NOU, index=True)
    origen = Column(Enum(LeadSource), default=LeadSource.WEB)
    etapa_pipeline = Column(Enum(PipelineStage), default=PipelineStage.LEAD)

    # RGPD
    consentiment_rgpd = Column(Boolean, default=False)
    data_consentiment = Column(DateTime, nullable=True)
    consentiment_marketing = Column(Boolean, default=False)

    # Metadata
    tags = Column(JSON, default=list)
    notes = Column(Text, default="")
    utm_source = Column(String(200), default="")
    utm_medium = Column(String(200), default="")
    utm_campaign = Column(String(200), default="")

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacions
    interactions = relationship("Interaction", back_populates="lead", cascade="all, delete-orphan")
    emails = relationship("AutomatedEmail", back_populates="lead", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="lead", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="lead", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="lead", cascade="all, delete-orphan")
    webinar_registrations = relationship("WebinarRegistration", back_populates="lead")

    __table_args__ = (
        Index("idx_lead_score_status", "score", "estat"),
        Index("idx_lead_language", "idioma_preferit"),
    )


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    tipus = Column(String(50), nullable=False)  # email_obert, clic, formulari, trucada, reunio
    canal = Column(String(50), default="")
    descripcio = Column(Text, default="")
    metadata_json = Column(JSON, default=dict)
    punts_scoring = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="interactions")


class AutomatedEmail(Base):
    __tablename__ = "automated_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    sequencia = Column(String(100), nullable=False)
    numero_email = Column(Integer, nullable=False)
    assumpte = Column(String(500), nullable=False)
    cos_html = Column(Text, default="")
    cos_text = Column(Text, default="")
    idioma = Column(Enum(Language), default=Language.CA)

    # Estat
    enviat = Column(Boolean, default=False)
    data_enviament = Column(DateTime, nullable=True)
    data_programada = Column(DateTime, nullable=True)
    obert = Column(Boolean, default=False)
    data_obertura = Column(DateTime, nullable=True)
    clicat = Column(Boolean, default=False)
    data_clic = Column(DateTime, nullable=True)

    # SendGrid
    sendgrid_message_id = Column(String(200), default="")

    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="emails")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    tipus = Column(String(100), nullable=False)  # diagnostic, proposta, informe
    titol = Column(String(500), nullable=False)
    contingut_html = Column(Text, default="")
    fitxer_url = Column(String(1000), default="")
    idioma = Column(Enum(Language), default=Language.CA)
    enviat = Column(Boolean, default=False)
    data_enviament = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="documents")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    tipus = Column(String(100), nullable=False)
    missatge = Column(Text, nullable=False)
    prioritat = Column(Enum(AlertPriority), default=AlertPriority.MITJANA)
    llegida = Column(Boolean, default=False)
    resolta = Column(Boolean, default=False)
    data_resolucio = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="alerts")


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    titol = Column(String(500), nullable=False)
    valor_estimat = Column(Float, default=0.0)
    probabilitat = Column(Integer, default=0)
    etapa = Column(Enum(PipelineStage), default=PipelineStage.LEAD)
    data_tancament_previst = Column(DateTime, nullable=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lead = relationship("Lead", back_populates="opportunities")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(300), nullable=False)
    descripcio = Column(Text, default="")
    data_inici = Column(DateTime, nullable=True)
    data_fi = Column(DateTime, nullable=True)
    pressupost = Column(Float, default=0.0)
    estat = Column(String(50), default="activa")
    objectius_json = Column(JSON, default=dict)
    metriques_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class Webinar(Base):
    __tablename__ = "webinars"

    id = Column(Integer, primary_key=True, autoincrement=True)
    titol = Column(String(500), nullable=False)
    descripcio = Column(Text, default="")
    data_hora = Column(DateTime, nullable=False)
    duracio_minuts = Column(Integer, default=60)
    link_registre = Column(String(1000), default="")
    link_directe = Column(String(1000), default="")
    link_gravacio = Column(String(1000), default="")
    max_assistents = Column(Integer, default=100)
    estat = Column(String(50), default="programat")
    created_at = Column(DateTime, default=datetime.utcnow)

    registrations = relationship("WebinarRegistration", back_populates="webinar")


class WebinarRegistration(Base):
    __tablename__ = "webinar_registrations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    webinar_id = Column(Integer, ForeignKey("webinars.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    assistent = Column(Boolean, default=False)
    data_registre = Column(DateTime, default=datetime.utcnow)

    webinar = relationship("Webinar", back_populates="registrations")
    lead = relationship("Lead", back_populates="webinar_registrations")

    __table_args__ = (
        UniqueConstraint("webinar_id", "lead_id", name="uq_webinar_lead"),
    )


class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(200), unique=True, nullable=False)
    descripcio = Column(Text, default="")
    system_prompt = Column(Text, default="")
    model = Column(String(100), default="claude-sonnet-4-5-20250929")
    actiu = Column(Boolean, default=True)
    config_json = Column(JSON, default=dict)
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_name = Column(String(200), nullable=False, index=True)
    action = Column(String(200), nullable=False)
    lead_id = Column(Integer, nullable=True)
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, default=dict)
    tokens_used = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    success = Column(Boolean, default=True)
    error_message = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(200), nullable=False)
    sequencia = Column(String(100), nullable=False)
    numero = Column(Integer, nullable=False)
    idioma = Column(Enum(Language), nullable=False)
    assumpte = Column(String(500), nullable=False)
    cos_html = Column(Text, nullable=False)
    cos_text = Column(Text, default="")
    actiu = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("sequencia", "numero", "idioma", name="uq_template_seq_num_lang"),
    )


class AdminUser(Base):
    """Usuaris administradors amb accés al Dashboard de gestió.
    Accessible únicament des de https://consultor.adeptify.es/app/dashboard
    """
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(320), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    is_admin = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

