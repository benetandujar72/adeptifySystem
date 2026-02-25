"""
Enviament d'emails via Gmail SMTP (principal) o SendGrid (fallback).
"""
import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# ─── Plantilles HTML per idioma ──────────────────────────────────────────────

WELCOME_TEMPLATES = {
    "ca": {
        "subject": "Benvingut/da a Adeptify – Impulsa el teu Negoci Digital",
        "body": """
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h1 style="color:#2563eb">Hola, {nom}! 👋</h1>
  <p>Gràcies per contactar amb <strong>Adeptify</strong>. Hem rebut la teva sol·licitud i un consultor es posarà en contacte amb tu aviat.</p>
  <p>Mentrestant, pots explorar els nostres recursos:</p>
  <ul>
    <li>📊 Diagnòstic gratuït de maduresa digital</li>
    <li>🤖 Automatització amb Intel·ligència Artificial</li>
    <li>📈 Estratègia de creixement digital</li>
  </ul>
  <p style="margin-top:24px"><a href="https://adeptifysystem.onrender.com" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Accedir a la plataforma</a></p>
  <hr style="margin-top:32px"/>
  <p style="color:#888;font-size:12px">Adeptify – Consultoria Digital · bandujar@edutac.es</p>
</div>
""",
    },
    "es": {
        "subject": "Bienvenido/a a Adeptify – Impulsa tu Negocio Digital",
        "body": """
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h1 style="color:#2563eb">¡Hola, {nom}! 👋</h1>
  <p>Gracias por contactar con <strong>Adeptify</strong>. Hemos recibido tu solicitud y un consultor se pondrá en contacto contigo en breve.</p>
  <p>Mientras tanto, puedes explorar nuestros recursos:</p>
  <ul>
    <li>📊 Diagnóstico gratuito de madurez digital</li>
    <li>🤖 Automatización con Inteligencia Artificial</li>
    <li>📈 Estrategia de crecimiento digital</li>
  </ul>
  <p style="margin-top:24px"><a href="https://adeptifysystem.onrender.com" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Acceder a la plataforma</a></p>
  <hr style="margin-top:32px"/>
  <p style="color:#888;font-size:12px">Adeptify – Consultoría Digital · bandujar@edutac.es</p>
</div>
""",
    },
    "en": {
        "subject": "Welcome to Adeptify – Boost your Digital Business",
        "body": """
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h1 style="color:#2563eb">Hello, {nom}! 👋</h1>
  <p>Thank you for contacting <strong>Adeptify</strong>. We've received your request and a consultant will be in touch shortly.</p>
  <p>In the meantime, explore our resources:</p>
  <ul>
    <li>📊 Free digital maturity diagnostic</li>
    <li>🤖 AI-powered business automation</li>
    <li>📈 Digital growth strategy</li>
  </ul>
  <p style="margin-top:24px"><a href="https://adeptifysystem.onrender.com" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Access the platform</a></p>
  <hr style="margin-top:32px"/>
  <p style="color:#888;font-size:12px">Adeptify – Digital Consulting · bandujar@edutac.es</p>
</div>
""",
    },
}


class EmailSender:
    """Client per enviar emails via Gmail SMTP (principal) o SendGrid (fallback)."""

    def __init__(self):
        # Gmail SMTP
        self.gmail_user = os.environ.get("GMAIL_USER", "")
        self.gmail_password = os.environ.get("GMAIL_APP_PASSWORD", "")

        # SendGrid (fallback)
        self.sendgrid_api_key = os.environ.get("SENDGRID_API_KEY", "")

        self.from_email = self.gmail_user or os.environ.get("EMAIL_FROM", "campanya@edutac.es")
        self.from_name = os.environ.get("EMAIL_FROM_NAME", "Adeptify – Consultoria Digital")

    # ── Gmail SMTP ─────────────────────────────────────────────────────────────

    def _send_via_gmail(self, to_email: str, to_name: str, subject: str, html_content: str) -> bool:
        """Envia un email via Gmail SMTP."""
        if not self.gmail_user or not self.gmail_password:
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.gmail_user}>"
            msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email

            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(self.gmail_user, self.gmail_password)
                server.sendmail(self.gmail_user, to_email, msg.as_string())

            logger.info(f"[Gmail] Email enviat a {to_email}: {subject}")
            return True
        except Exception as e:
            logger.error(f"[Gmail] Error enviant a {to_email}: {e}")
            return False

    # ── SendGrid (fallback) ────────────────────────────────────────────────────

    def _send_via_sendgrid(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        text_content: str = "",
        reply_to: str = "",
        categories: list[str] | None = None,
    ) -> bool:
        """Envia un email via SendGrid."""
        if not self.sendgrid_api_key:
            return False
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import (
                Mail, Email, To, Content, ReplyTo, Category, TrackingSettings,
                OpenTracking, ClickTracking,
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

            logger.info(f"[SendGrid] Email enviat a {to_email}: status={response.status_code}")
            return response.status_code in (200, 201, 202)

        except Exception as e:
            logger.error(f"[SendGrid] Error enviant email a {to_email}: {e}")
            return False

    # ── Mètode principal (Gmail → SendGrid) ───────────────────────────────────

    def send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        text_content: str = "",
        reply_to: str = "",
        categories: list[str] | None = None,
    ) -> bool:
        """Envia email. Intenta Gmail primer, SendGrid com a fallback."""
        if self._send_via_gmail(to_email, to_name, subject, html_content):
            return True
        return self._send_via_sendgrid(
            to_email, to_name, subject, html_content, text_content, reply_to, categories
        )

    # ── Email de benvinguda per nou lead ──────────────────────────────────────

    def send_welcome_email(self, lead_data: dict) -> bool:
        """Envia email de benvinguda personalitzat al nou lead."""
        idioma = lead_data.get("idioma", "es")
        if idioma not in WELCOME_TEMPLATES:
            idioma = "es"

        template = WELCOME_TEMPLATES[idioma]
        nom = lead_data.get("nom", "")
        primer_nom = nom.split()[0] if nom else "Hola"

        html = template["body"].format(nom=primer_nom)
        subject = template["subject"]

        success = self.send_email(
            to_email=lead_data.get("email", ""),
            to_name=nom,
            subject=subject,
            html_content=html,
            categories=["welcome", "lead_nurturing", f"lang_{idioma}"],
        )

        # Notificació interna al consultor
        self.send_lead_notification(lead_data)

        return success

    # ── Notificació interna ───────────────────────────────────────────────────

    def send_lead_notification(self, lead_data: dict) -> bool:
        """Envia notificació de nou lead al consultor."""
        notification_email = os.environ.get("LEAD_NOTIFICATION_EMAIL", "bandujar@edutac.es")

        html = f"""
        <h2>🔔 Nou Lead Captat!</h2>
        <table style="border-collapse:collapse; width:100%;">
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Nom</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('nom', '')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Email</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('email', '')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Empresa</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('empresa', '-')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Telèfon</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('telefon', '-')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Score</strong></td>
                <td style="padding:8px; border:1px solid #ddd;"><strong>{lead_data.get('score', '-')}</strong></td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Idioma</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('idioma', 'es')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Origen</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('origen', 'web')}</td></tr>
        </table>
        <p><a href="https://adeptifysystem.onrender.com/dashboard">Veure al Dashboard</a></p>
        """

        return self.send_email(
            to_email=notification_email,
            to_name="Benet",
            subject=f"🔔 Nou Lead: {lead_data.get('nom', 'Desconegut')} ({lead_data.get('empresa', '')})",
            html_content=html,
            categories=["lead_notification"],
        )
