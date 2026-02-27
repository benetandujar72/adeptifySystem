"""
Enviament d'emails via Gmail SMTP (principal) o SendGrid (fallback).
Totes les URLs i valors es llegeixen de la configuració central (config.py),
mai hardcodejats.
"""
import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def _get_settings():
    """Importació tardana per evitar cicles."""
    try:
        from app.config import get_settings
        return get_settings()
    except Exception:
        # Fallback minimal quan s'executa fora del context FastAPI (scripts, tests)
        class _Env:
            GMAIL_USER            = os.environ.get("GMAIL_USER", "")
            GMAIL_APP_PASSWORD    = os.environ.get("GMAIL_APP_PASSWORD", "")
            SENDGRID_API_KEY      = os.environ.get("SENDGRID_API_KEY", "")
            EMAIL_FROM            = os.environ.get("EMAIL_FROM", "")
            EMAIL_FROM_NAME       = os.environ.get("EMAIL_FROM_NAME", "Adeptify – Consultoria Digital")
            LEAD_NOTIFICATION_EMAIL = os.environ.get("LEAD_NOTIFICATION_EMAIL", "bandujar@edutac.es")
            APP_URL               = os.environ.get("APP_URL", "https://consultor.adeptify.es/app")
            DASHBOARD_URL         = os.environ.get("DASHBOARD_URL", "")
            CAMPAIGN_NAME         = os.environ.get("CAMPAIGN_NAME", "Adeptify – Consultoria Digital")

            def get_app_url(self):      return self.APP_URL.rstrip("/")
            def get_dashboard_url(self):
                return self.DASHBOARD_URL.rstrip("/") if self.DASHBOARD_URL else f"{self.get_app_url()}/dashboard"
            def get_from_email(self):   return self.EMAIL_FROM or self.GMAIL_USER
        return _Env()


# ─── Plantilles HTML per idioma ──────────────────────────────────────────────

def _welcome_html(nom: str, empresa: str, carrec: str, origen: str, cfg) -> dict:
    """Retorna subject + body per idioma basat en l'objecte de configuració."""
    app_url  = cfg.get_app_url()
    btn_color = "#2563eb"
    footer   = f"{cfg.CAMPAIGN_NAME} · {cfg.get_from_email()}"

    templates = {
        "ca": {
            "subject": f"Benvingut/da a {cfg.CAMPAIGN_NAME} 🚀",
            "body": f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e40af;padding:24px;color:#fff">
    <h1 style="margin:0;font-size:22px">Hola, {nom}! 👋</h1>
  </div>
  <div style="padding:24px">
    <p>Gràcies per contactar amb <strong>{cfg.CAMPAIGN_NAME}</strong>. Hem rebut la teva sol·licitud de <strong>{empresa}</strong>.</p>
    <p>Un consultor especialitzat estudiarà el teu cas i es posarà en contacte en menys de 24h.</p>
    <h3>📋 Dades rebudes</h3>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Empresa</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{empresa}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Càrrec</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{carrec}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Origen</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{origen}</td></tr>
    </table>
    <p style="margin-top:24px"><a href="{app_url}" style="background:{btn_color};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Accedir a la plataforma</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">{footer}</div>
</div>""",
        },
        "es": {
            "subject": f"Bienvenido/a a {cfg.CAMPAIGN_NAME} 🚀",
            "body": f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e40af;padding:24px;color:#fff">
    <h1 style="margin:0;font-size:22px">¡Hola, {nom}! 👋</h1>
  </div>
  <div style="padding:24px">
    <p>Gracias por contactar con <strong>{cfg.CAMPAIGN_NAME}</strong>. Hemos recibido tu solicitud de <strong>{empresa}</strong>.</p>
    <p>Un consultor especializado estudiará tu caso y contactará en menos de 24h.</p>
    <h3>📋 Datos recibidos</h3>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Empresa</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{empresa}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Cargo</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{carrec}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Origen</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{origen}</td></tr>
    </table>
    <p style="margin-top:24px"><a href="{app_url}" style="background:{btn_color};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Acceder a la plataforma</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">{footer}</div>
</div>""",
        },
        "en": {
            "subject": f"Welcome to {cfg.CAMPAIGN_NAME} 🚀",
            "body": f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e40af;padding:24px;color:#fff">
    <h1 style="margin:0;font-size:22px">Hello, {nom}! 👋</h1>
  </div>
  <div style="padding:24px">
    <p>Thank you for contacting <strong>{cfg.CAMPAIGN_NAME}</strong>. We've received your request from <strong>{empresa}</strong>.</p>
    <p>A consultant will review your case and get in touch within 24h.</p>
    <p style="margin-top:24px"><a href="{app_url}" style="background:{btn_color};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Access the platform</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">{footer}</div>
</div>""",
        },
    }
    return templates.get("ca" if "ca" in str(nom) else "es", templates["ca"])


class EmailSender:
    """Client per enviar emails via Gmail SMTP (principal) o SendGrid (fallback).
    Tots els paràmetres provenen de variables d'entorn via Settings."""

    def __init__(self):
        cfg = _get_settings()
        self.gmail_user        = cfg.GMAIL_USER
        self.gmail_password    = cfg.GMAIL_APP_PASSWORD
        self.sendgrid_api_key  = cfg.SENDGRID_API_KEY
        self.from_email        = cfg.get_from_email()
        self.from_name         = cfg.EMAIL_FROM_NAME
        self.notification_email = cfg.LEAD_NOTIFICATION_EMAIL
        self._cfg              = cfg

    # ── Gmail SMTP ─────────────────────────────────────────────────────────────

    def _send_via_gmail(self, to_email: str, to_name: str, subject: str, html_content: str) -> bool:
        if not self.gmail_user or not self.gmail_password:
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"]    = f"{self.from_name} <{self.gmail_user}>"
            msg["To"]      = f"{to_name} <{to_email}>" if to_name else to_email
            msg.attach(MIMEText(html_content, "html"))
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(self.gmail_user, self.gmail_password)
                server.sendmail(self.gmail_user, to_email, msg.as_string())
            logger.info(f"[Gmail] ✅ {to_email}: {subject}")
            return True
        except Exception as e:
            logger.error(f"[Gmail] ❌ {to_email}: {e}")
            return False

    # ── SendGrid fallback ──────────────────────────────────────────────────────

    def _send_via_sendgrid(self, to_email, to_name, subject, html_content,
                           text_content="", reply_to="", categories=None) -> bool:
        if not self.sendgrid_api_key:
            return False
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import (
                Mail, Email, To, Content, ReplyTo, Category,
                TrackingSettings, OpenTracking, ClickTracking,
            )
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email, to_name),
                subject=subject,
            )
            message.add_content(Content("text/html", html_content))
            if text_content:
                message.add_content(Content("text/plain", text_content))
            if reply_to:
                message.reply_to = ReplyTo(reply_to)
            if categories:
                for cat in categories:
                    message.add_category(Category(cat))
            tracking = TrackingSettings()
            tracking.open_tracking = OpenTracking(True)
            tracking.click_tracking = ClickTracking(True, True)
            message.tracking_settings = tracking
            sg = SendGridAPIClient(self.sendgrid_api_key)
            response = sg.send(message)
            logger.info(f"[SendGrid] ✅ {to_email}: status={response.status_code}")
            return response.status_code in (200, 201, 202)
        except Exception as e:
            logger.error(f"[SendGrid] ❌ {to_email}: {e}")
            return False

    # ── Mètode principal ───────────────────────────────────────────────────────

    def send_email(self, to_email: str, to_name: str, subject: str,
                   html_content: str, text_content: str = "",
                   reply_to: str = "", categories: list[str] | None = None) -> bool:
        """Gmail primer, SendGrid com a fallback."""
        if self._send_via_gmail(to_email, to_name, subject, html_content):
            return True
        return self._send_via_sendgrid(
            to_email, to_name, subject, html_content, text_content, reply_to, categories
        )

    # ── Email de benvinguda ────────────────────────────────────────────────────

    def send_welcome_email(self, lead_data: dict) -> bool:
        """Envia email de benvinguda al lead i notificació interna al consultor."""
        idioma     = lead_data.get("idioma", "ca")
        nom        = lead_data.get("nom", "")
        primer_nom = nom.split()[0] if nom else "Hola"
        empresa    = lead_data.get("empresa", "")
        carrec     = lead_data.get("carrec", "")
        origen     = lead_data.get("origen", "web")

        tpl = _welcome_html(primer_nom, empresa, carrec, origen, self._cfg)
        # Substituir idioma real
        subjects = {
            "ca": f"Benvingut/da a {self._cfg.CAMPAIGN_NAME} 🚀",
            "es": f"Bienvenido/a a {self._cfg.CAMPAIGN_NAME} 🚀",
            "en": f"Welcome to {self._cfg.CAMPAIGN_NAME} 🚀",
        }
        subject = subjects.get(idioma, subjects["ca"])
        html    = tpl["body"]

        ok = self.send_email(
            to_email=lead_data.get("email", ""),
            to_name=nom,
            subject=subject,
            html_content=html,
            categories=["welcome", "lead_nurturing", f"lang_{idioma}"],
        )
        self.send_lead_notification(lead_data)
        return ok

    # ── Notificació interna ───────────────────────────────────────────────────

    def send_lead_notification(self, lead_data: dict) -> bool:
        cfg        = self._cfg
        dash_url   = cfg.get_dashboard_url()
        score      = lead_data.get("score", "-")
        tier_color = "#16a34a" if isinstance(score, int) and score >= 80 else \
                     "#f59e0b" if isinstance(score, int) and score >= 60 else "#6b7280"

        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#111827;padding:20px;color:#fff">
    <span style="font-size:18px;font-weight:bold">🔔 Nou Lead – {cfg.CAMPAIGN_NAME}</span>
  </div>
  <div style="padding:24px">
    <table style="border-collapse:collapse;width:100%">
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><b>Nom</b></td><td style="padding:8px;border:1px solid #e5e7eb">{lead_data.get('nom','')}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Email</b></td><td style="padding:8px;border:1px solid #e5e7eb">{lead_data.get('email','')}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><b>Empresa</b></td><td style="padding:8px;border:1px solid #e5e7eb">{lead_data.get('empresa','-')}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Càrrec</b></td><td style="padding:8px;border:1px solid #e5e7eb">{lead_data.get('carrec','-')}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><b>Telèfon</b></td><td style="padding:8px;border:1px solid #e5e7eb">{lead_data.get('telefon','-')}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Score</b></td><td style="padding:8px;border:1px solid #e5e7eb"><strong style="color:{tier_color}">{score}/100</strong></td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><b>Idioma</b></td><td style="padding:8px;border:1px solid #e5e7eb">{lead_data.get('idioma','ca').upper()}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Origen</b></td><td style="padding:8px;border:1px solid #e5e7eb">{lead_data.get('origen','web')}</td></tr>
    </table>
    <p style="margin-top:16px"><a href="{dash_url}" style="background:#111827;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Veure al Dashboard CRM</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">{cfg.CAMPAIGN_NAME} · {cfg.get_from_email()}</div>
</div>"""

        return self.send_email(
            to_email=self.notification_email,
            to_name="Benet",
            subject=f"🔔 Nou Lead: {lead_data.get('nom','Desconegut')} – {lead_data.get('empresa','')} (Score: {score})",
            html_content=html,
            categories=["lead_notification"],
        )
