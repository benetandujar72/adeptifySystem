"""
Enviament d'emails via SendGrid API.
"""
import os
import logging

logger = logging.getLogger(__name__)


class EmailSender:
    """Client per enviar emails transaccionals i de marketing via SendGrid."""

    def __init__(self):
        self.api_key = os.environ.get("SENDGRID_API_KEY", "")
        self.from_email = os.environ.get("EMAIL_FROM", "campanya@edutac.es")
        self.from_name = os.environ.get("EMAIL_FROM_NAME", "Impulsa el teu Negoci Digital")

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
        """Envia un email via SendGrid."""
        if not self.api_key:
            logger.warning("SENDGRID_API_KEY no configurada, email no enviat")
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

            # Tracking
            tracking = TrackingSettings()
            tracking.open_tracking = OpenTracking(True)
            tracking.click_tracking = ClickTracking(True, True)
            message.tracking_settings = tracking

            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)

            logger.info(f"Email enviat a {to_email}: status={response.status_code}")
            return response.status_code in (200, 201, 202)

        except Exception as e:
            logger.error(f"Error enviant email a {to_email}: {e}")
            return False

    def send_lead_notification(self, lead_data: dict) -> bool:
        """Envia notificació de nou lead al consultor."""
        notification_email = os.environ.get("LEAD_NOTIFICATION_EMAIL", "bandujar@edutac.es")

        html = f"""
        <h2>Nou Lead Captat!</h2>
        <table style="border-collapse:collapse; width:100%;">
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Nom</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('nom', '')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Email</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('email', '')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Empresa</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('empresa', '-')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Telèfon</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('telefon', '-')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Idioma</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('idioma', 'ca')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Origen</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">{lead_data.get('origen', 'web')}</td></tr>
        </table>
        <p><a href="https://impulsa.edutac.es/dashboard">Veure al Dashboard</a></p>
        """

        return self.send_email(
            to_email=notification_email,
            to_name="Benet",
            subject=f"Nou Lead: {lead_data.get('nom', 'Desconegut')} ({lead_data.get('empresa', '')})",
            html_content=html,
            categories=["lead_notification"],
        )
