import sys
import os
import json

# Agregar la ruta base del proyecto para que las importaciones funcionen
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from production.agents.email_sender import EmailSender

def run_test():
    sender = EmailSender()
    
    if not sender.api_key:
        print("ERROR: La variable de entorno SENDGRID_API_KEY no está configurada.")
        print("Asegúrate de configurar la variable de entorno o crear un archivo .env válido.")
        return

    emails_to_test = [
        "bandujar@edutac.es",
        "benet.andujar@gmail.com",
        "dsaban@joanpelegri.cat",
        "bandujar@xtec.cat"
    ]

    html_content = """
    <h1>🚀 Impulsa el teu Negoci Digital - Prova de Campanya</h1>
    <p>Aquest és un correu de prova generat automàticament per validar el sistema d'enviament de campanyes de màrqueting del sistema Adeptify.</p>
    <p>Si reps aquest correu, significa que la integració amb SendGrid funciona correctament.</p>
    <br>
    <p>Salutacions,<br>Equip d'Adeptify</p>
    """

    print("Iniciant enviament de correus de prova...")
    
    success_count = 0
    for email in emails_to_test:
        print(f"Enviant a {email}...")
        success = sender.send_email(
            to_email=email,
            to_name="Usuari de Prova",
            subject="Prova de Campanya de Màrqueting - Adeptify",
            html_content=html_content,
            categories=["test_campanya", "marketing"]
        )
        if success:
            print(f"✅ Enviat correctament a {email}")
            success_count += 1
        else:
            print(f"❌ Fallada a l'enviar a {email}")
            
    print(f"\nResum: {success_count}/{len(emails_to_test)} correus enviats correctament.")

if __name__ == "__main__":
    run_test()
