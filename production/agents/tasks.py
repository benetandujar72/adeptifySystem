"""
═══════════════════════════════════════════════════════════════════════════════
TASQUES CELERY - Automatització de Campanya
═══════════════════════════════════════════════════════════════════════════════
Tasques asíncrones executades pels workers de Celery.
Connecten els agents IA amb el CRM i el sistema d'emails.
═══════════════════════════════════════════════════════════════════════════════
"""
import os
import logging
from datetime import datetime, timedelta

from agents.celery_app import app
from agents.agent_engine import AgentEngine
from agents.email_sender import EmailSender

logger = logging.getLogger(__name__)

# ── Utils de BD (síncron per Celery) ──
def get_sync_db():
    """Retorna connexió síncrona per tasques Celery."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    # Convertir URL asyncpg → psycopg2
    url = os.environ.get("DATABASE_URL", "").replace("+asyncpg", "")
    engine = create_engine(url)
    return Session(engine)


# ─────────────────────────────────────────────────────────────────────────────
# TASQUES PRINCIPALS
# ─────────────────────────────────────────────────────────────────────────────

@app.task(name="agents.tasks.process_pending_leads")
def process_pending_leads():
    """Processa leads nous que encara no han passat pel pipeline d'agents."""
    from app.models import Lead, AgentLog, LeadStatus
    db = get_sync_db()
    engine = AgentEngine()

    try:
        # Buscar leads nous sense processar (creats en les últimes 24h sense interaccions)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        leads = db.query(Lead).filter(
            Lead.estat == LeadStatus.NOU,
            Lead.created_at >= cutoff,
        ).all()

        logger.info(f"Processant {len(leads)} leads pendents")

        for lead in leads:
            lead_data = {
                "id": lead.id,
                "nom": lead.nom,
                "email": lead.email,
                "empresa": lead.empresa,
                "carrec": lead.carrec,
                "codi_postal": lead.codi_postal,
                "comunitat_autonoma": lead.comunitat_autonoma,
                "origen": lead.origen.value if lead.origen else "web",
                "score": lead.score,
            }

            results = engine.run_pipeline(lead_data)

            # Desar logs
            for result in results:
                log = AgentLog(
                    agent_name=result["agent"],
                    action="pipeline_auto",
                    lead_id=lead.id,
                    input_data=lead_data,
                    output_data=result.get("result", {}),
                    tokens_used=result.get("tokens_input", 0) + result.get("tokens_output", 0),
                    duration_ms=result.get("duration_ms", 0),
                    success=result.get("success", False),
                    error_message=result.get("error", ""),
                )
                db.add(log)

            # Actualitzar lead amb resultats
            scoring_result = next(
                (r for r in results if r["agent"] == "scoring" and r["success"]),
                None
            )
            if scoring_result:
                score_data = scoring_result["result"]
                lead.score = score_data.get("score_total", lead.score)
                lead.estat = LeadStatus.CONTACTAT

            db.commit()
            logger.info(f"Lead {lead.id} processat correctament")

    except Exception as e:
        logger.error(f"Error processant leads: {e}")
        db.rollback()
    finally:
        db.close()


@app.task(name="agents.tasks.send_scheduled_emails")
def send_scheduled_emails():
    """Envia emails programats que ja han arribat a la seva data."""
    from app.models import AutomatedEmail, Lead, Interaction
    db = get_sync_db()
    sender = EmailSender()

    try:
        now = datetime.utcnow()
        emails = db.query(AutomatedEmail).filter(
            AutomatedEmail.enviat == False,
            AutomatedEmail.data_programada <= now,
        ).limit(50).all()

        logger.info(f"Enviant {len(emails)} emails programats")

        for email in emails:
            lead = db.query(Lead).get(email.lead_id)
            if not lead or not lead.consentiment_marketing:
                continue

            success = sender.send_email(
                to_email=lead.email,
                to_name=f"{lead.nom} {lead.cognom}".strip(),
                subject=email.assumpte,
                html_content=email.cos_html,
                text_content=email.cos_text,
            )

            if success:
                email.enviat = True
                email.data_enviament = now

                # Registrar interacció
                interaction = Interaction(
                    lead_id=lead.id,
                    tipus="email_enviat",
                    canal="email",
                    descripcio=f"Email enviat: {email.assumpte}",
                    punts_scoring=0,
                )
                db.add(interaction)

        db.commit()

    except Exception as e:
        logger.error(f"Error enviant emails: {e}")
        db.rollback()
    finally:
        db.close()


@app.task(name="agents.tasks.refresh_all_scoring")
def refresh_all_scoring():
    """Recalcula el scoring de tots els leads actius."""
    from app.models import Lead, Interaction, LeadStatus
    from app.scoring import get_lead_tier, calculate_profile_score
    db = get_sync_db()

    try:
        leads = db.query(Lead).filter(
            Lead.estat.notin_([LeadStatus.TANCAT_GUANYAT, LeadStatus.TANCAT_PERDUT])
        ).all()

        for lead in leads:
            # Score de perfil
            profile_score = calculate_profile_score(
                empresa=lead.empresa,
                carrec=lead.carrec,
                telefon=lead.telefon,
                web=lead.web_empresa,
            )

            # Score d'interaccions
            interactions = db.query(Interaction).filter(
                Interaction.lead_id == lead.id
            ).all()
            interaction_score = sum(i.punts_scoring for i in interactions)

            lead.score = profile_score + interaction_score
            new_tier = get_lead_tier(lead.score)

        db.commit()
        logger.info(f"Scoring refrescat per {len(leads)} leads")

    except Exception as e:
        logger.error(f"Error refrescant scoring: {e}")
        db.rollback()
    finally:
        db.close()


@app.task(name="agents.tasks.send_daily_summary")
def send_daily_summary():
    """Envia resum diari al consultor (bandujar@edutac.es)."""
    from app.models import Lead, Alert, AutomatedEmail, LeadStatus
    db = get_sync_db()
    sender = EmailSender()
    engine = AgentEngine()

    try:
        yesterday = datetime.utcnow() - timedelta(days=1)

        # Recopilar dades
        nous_leads = db.query(Lead).filter(Lead.created_at >= yesterday).count()
        alertes_pendents = db.query(Alert).filter(Alert.resolta == False).count()
        emails_enviats = db.query(AutomatedEmail).filter(
            AutomatedEmail.data_enviament >= yesterday
        ).count()
        leads_hot = db.query(Lead).filter(Lead.score >= 80).count()

        context = {
            "data": datetime.utcnow().strftime("%d/%m/%Y"),
            "nous_leads": nous_leads,
            "alertes_pendents": alertes_pendents,
            "emails_enviats": emails_enviats,
            "leads_hot": leads_hot,
        }

        # Generar resum amb agent analytics
        result = engine.run_agent("analytics", context, "Genera un resum diari breu en català")

        summary_text = f"""
        <h2>Resum Diari - Campanya Digital</h2>
        <p><strong>Data:</strong> {context['data']}</p>
        <ul>
            <li>Nous leads: {nous_leads}</li>
            <li>Alertes pendents: {alertes_pendents}</li>
            <li>Emails enviats (24h): {emails_enviats}</li>
            <li>Leads HOT: {leads_hot}</li>
        </ul>
        """

        if result.get("success"):
            recs = result["result"].get("recomanacions", [])
            if recs:
                summary_text += "<h3>Recomanacions IA:</h3><ul>"
                for r in recs:
                    summary_text += f"<li>{r}</li>"
                summary_text += "</ul>"

        sender.send_email(
            to_email=os.environ.get("LEAD_NOTIFICATION_EMAIL", "bandujar@edutac.es"),
            to_name="Benet",
            subject=f"Resum Diari Campanya - {context['data']}",
            html_content=summary_text,
        )

        logger.info("Resum diari enviat")

    except Exception as e:
        logger.error(f"Error enviant resum diari: {e}")
    finally:
        db.close()


@app.task(name="agents.tasks.detect_inactive_leads")
def detect_inactive_leads():
    """Detecta leads inactius i llança seqüència de reactivació."""
    from app.models import Lead, Interaction, Alert, AlertPriority, LeadStatus
    db = get_sync_db()
    engine = AgentEngine()

    try:
        cutoff_7d = datetime.utcnow() - timedelta(days=7)
        cutoff_14d = datetime.utcnow() - timedelta(days=14)
        cutoff_30d = datetime.utcnow() - timedelta(days=30)

        active_leads = db.query(Lead).filter(
            Lead.estat.notin_([LeadStatus.TANCAT_GUANYAT, LeadStatus.TANCAT_PERDUT])
        ).all()

        for lead in active_leads:
            last_interaction = db.query(Interaction).filter(
                Interaction.lead_id == lead.id
            ).order_by(Interaction.created_at.desc()).first()

            if not last_interaction:
                continue

            last_date = last_interaction.created_at
            days_inactive = (datetime.utcnow() - last_date).days

            if days_inactive < 7:
                continue

            # Consultar agent de seguiment
            context = {
                "lead_id": lead.id,
                "nom": lead.nom,
                "email": lead.email,
                "score": lead.score,
                "idioma": lead.idioma_preferit.value,
                "dies_inactiu": days_inactive,
                "ultima_interaccio": last_date.isoformat(),
            }

            result = engine.run_agent("seguiment", context)

            if result.get("success"):
                accio = result["result"].get("accio_recomanada", "cap")
                if accio != "cap":
                    alert = Alert(
                        lead_id=lead.id,
                        tipus=f"inactivitat_{days_inactive}d",
                        missatge=f"Lead {lead.nom} inactiu {days_inactive} dies. Recomanació: {accio}",
                        prioritat=AlertPriority.ALTA if days_inactive > 14 else AlertPriority.MITJANA,
                    )
                    db.add(alert)

        db.commit()
        logger.info(f"Detecció d'inactivitat completada per {len(active_leads)} leads")

    except Exception as e:
        logger.error(f"Error detectant leads inactius: {e}")
        db.rollback()
    finally:
        db.close()


@app.task(name="agents.tasks.generate_weekly_analytics")
def generate_weekly_analytics():
    """Genera informe setmanal d'analytics."""
    from app.models import Lead, Interaction, AutomatedEmail, Opportunity
    db = get_sync_db()
    engine = AgentEngine()
    sender = EmailSender()

    try:
        week_ago = datetime.utcnow() - timedelta(days=7)

        context = {
            "periode": "setmanal",
            "data_inici": week_ago.isoformat(),
            "nous_leads": db.query(Lead).filter(Lead.created_at >= week_ago).count(),
            "interaccions": db.query(Interaction).filter(Interaction.created_at >= week_ago).count(),
            "emails_enviats": db.query(AutomatedEmail).filter(
                AutomatedEmail.data_enviament >= week_ago
            ).count(),
            "emails_oberts": db.query(AutomatedEmail).filter(
                AutomatedEmail.data_enviament >= week_ago,
                AutomatedEmail.obert == True,
            ).count(),
        }

        result = engine.run_agent(
            "analytics", context,
            "Genera un informe setmanal detallat en català amb recomanacions"
        )

        if result.get("success"):
            # Enviar per email
            sender.send_email(
                to_email=os.environ.get("LEAD_NOTIFICATION_EMAIL", "bandujar@edutac.es"),
                to_name="Benet",
                subject=f"Informe Setmanal Campanya - {datetime.utcnow().strftime('%d/%m/%Y')}",
                html_content=f"<pre>{result['result']}</pre>",
            )

        logger.info("Informe setmanal generat i enviat")

    except Exception as e:
        logger.error(f"Error generant analytics setmanal: {e}")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# TASQUES SOB DEMANDA
# ─────────────────────────────────────────────────────────────────────────────

@app.task(name="agents.tasks.generate_document_for_lead")
def generate_document_for_lead(lead_id: int, doc_type: str = "diagnostic"):
    """Genera un document personalitzat per un lead específic."""
    from app.models import Lead, Document
    db = get_sync_db()
    engine = AgentEngine()

    try:
        lead = db.query(Lead).get(lead_id)
        if not lead:
            return {"error": "Lead no trobat"}

        context = {
            "lead": {
                "nom": lead.nom,
                "empresa": lead.empresa,
                "carrec": lead.carrec,
                "sector": lead.tags,
                "idioma": lead.idioma_preferit.value,
                "score": lead.score,
            },
            "tipus_document": doc_type,
        }

        result = engine.run_agent("documents", context)

        if result.get("success"):
            doc = Document(
                lead_id=lead_id,
                tipus=doc_type,
                titol=result["result"].get("titol", f"Document {doc_type}"),
                contingut_html=str(result["result"].get("seccions", [])),
                idioma=lead.idioma_preferit,
            )
            db.add(doc)
            db.commit()
            return {"status": "created", "document_id": doc.id}

        return {"error": "Agent no ha pogut generar el document"}

    except Exception as e:
        logger.error(f"Error generant document: {e}")
        return {"error": str(e)}
    finally:
        db.close()
