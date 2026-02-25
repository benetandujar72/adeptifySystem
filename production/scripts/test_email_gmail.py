import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_gmail(sender_email, sender_password, to_email, subject, html_content):
    # Setup SMTP server
    smtp_server = "smtp.gmail.com"
    smtp_port = 587

    # Create message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = to_email

    # Add HTML content
    part = MIMEText(html_content, "html")
    msg.attach(part)

    try:
        # Connect and authenticate
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()  # Secure the connection
        server.login(sender_email, sender_password)
        
        # Send
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error enviant a {to_email}: {e}")
        return False

def run_test():
    sender_email = os.environ.get("GMAIL_USER")
    sender_password = os.environ.get("GMAIL_APP_PASSWORD") # App Password, no la contraseña normal

    if not sender_email or not sender_password:
        print("ERROR: Les variables d'entorn GMAIL_USER i GMAIL_APP_PASSWORD no estan configurades.")
        print("Per utilitzar Gmail, necessites configurar el teu compte de correu i una 'App Password' (Contrasenya d'Aplicació) de Google.")
        return

    emails_to_test = [
        "bandujar@edutac.es",
        "benet.andujar@gmail.com",
        "dsaban@joanpelegri.cat",
        "bandujar@xtec.cat"
    ]

    html_content = """
    <h1>🚀 Impulsa el teu Negoci Digital - Prova de Campanya (via Gmail)</h1>
    <p>Aquest és un correu de prova generat automàticament per validar el sistema d'enviament via SMTP de Gmail.</p>
    <p>Si reps aquest correu, significa que la integració amb Gmail funciona correctament.</p>
    <br>
    <p>Salutacions,<br>Equip d'Adeptify</p>
    """

    print(f"Iniciant enviament des de: {sender_email}")
    
    success_count = 0
    for email in emails_to_test:
        print(f"Enviant a {email}...")
        success = send_gmail(
            sender_email=sender_email,
            sender_password=sender_password,
            to_email=email,
            subject="Prova de Campanya de Màrqueting - Adeptify via Gmail",
            html_content=html_content
        )
        if success:
            print(f"✅ Enviat correctament a {email}")
            success_count += 1
        else:
            print(f"❌ Fallada a l'enviar a {email}")
            
    print(f"\nResum: {success_count}/{len(emails_to_test)} correus enviats correctament.")

if __name__ == "__main__":
    run_test()
