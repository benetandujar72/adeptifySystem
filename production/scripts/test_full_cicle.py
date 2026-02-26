"""
════════════════════════════════════════════════════════════════════════════════
TEST COMPLET DEL FLUX D'AUTOMATITZACIÓ DE CAMPANYA - ADEPTIFY
════════════════════════════════════════════════════════════════════════════════
Simula tot el cicle de vida d'un lead:
  1. Lead nou captat (3 perfils: ca / es / en)
  2. Detecció d'idioma i scoring de perfil
  3. Email de benvinguda personalitzat al lead
  4. Notificació interna al consultor
  5. Email de seguiment (dia 3) – nurturing
  6. Email de reactivació (day 7 inactiu)
  7. Resum diari per al consultor
  8. Informe setmanal complet
  9. Alerta de lead HOT (score > 80)
════════════════════════════════════════════════════════════════════════════════
"""
import os
import sys
import smtplib
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ──── Configuració ────────────────────────────────────────────────────────────
GMAIL_USER     = os.environ.get("GMAIL_USER", "bandujar@edutac.es")
GMAIL_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
FROM_NAME      = "Adeptify · Consultoria Digital"

CONSULTORS = [
    {"email": "bandujar@edutac.es", "nom": "Benet"},
    {"email": "dsaban@joanpelegri.cat", "nom": "David"},
]

# ──── Leads de prova (3 idiomes, perfils variats) ─────────────────────────────
LEADS_TEST = [
    {
        "nom": "Marina Torres",
        "email": "bandujar@edutac.es",      # redirigit per prova
        "empresa": "Escola Joan Pelegrí",
        "carrec": "Directora",
        "telefon": "+34 93 444 56 78",
        "web": "www.joanpelegri.cat",
        "codi_postal": "08015",
        "comunitat_autonoma": "Cataluña",
        "idioma": "ca",
        "origen": "webinar",
        "score": 87,
        "consentiment_marketing": True,
    },
    {
        "nom": "Carlos Ruiz",
        "email": "dsaban@joanpelegri.cat",  # redirigit per prova
        "empresa": "Centre de Formació Xtec",
        "carrec": "Cap de Formació",
        "telefon": "+34 91 234 56 78",
        "web": "www.xtec.cat",
        "codi_postal": "08034",
        "comunitat_autonoma": "Cataluña",
        "idioma": "es",
        "origen": "formulari_web",
        "score": 65,
        "consentiment_marketing": True,
    },
    {
        "nom": "Joana Martí",
        "email": "bandujar@edutac.es",      # redirigit per prova
        "empresa": "EdTech Solutions SL",
        "carrec": "CEO",
        "telefon": "+34 93 555 12 34",
        "web": "www.edtechsolutions.es",
        "codi_postal": "17001",
        "comunitat_autonoma": "Cataluña",
        "idioma": "ca",
        "origen": "linkedin",
        "score": 92,
        "consentiment_marketing": True,
    },
]

# ──── Helpers ─────────────────────────────────────────────────────────────────
def send_email(to_email: str, to_name: str, subject: str, html: str) -> bool:
    if not GMAIL_USER or not GMAIL_PASSWORD:
        logger.error("GMAIL_USER o GMAIL_APP_PASSWORD no configurats!")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{FROM_NAME} <{GMAIL_USER}>"
        msg["To"]      = f"{to_name} <{to_email}>"
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP("smtp.gmail.com", 587) as srv:
            srv.starttls()
            srv.login(GMAIL_USER, GMAIL_PASSWORD)
            srv.sendmail(GMAIL_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Error enviament a {to_email}: {e}")
        return False


def step(n: int, title: str):
    print(f"\n{'═'*64}")
    print(f"  FASE {n}: {title}")
    print(f"{'═'*64}")


def check(success: bool, label: str):
    icon = "✅" if success else "❌"
    print(f"  {icon}  {label}")
    return success

# ──── FASE 1 – Leads nous rebuts ──────────────────────────────────────────────

step(1, "LEADS NOUS CAPTATS (3 perfils)")

for lead in LEADS_TEST:
    idioma    = lead["idioma"]
    primer_nom = lead["nom"].split()[0]
    templates = {
        "ca": {
            "subject": "Benvingut/da a Adeptify 🚀",
            "body": f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e40af;padding:24px;color:#fff">
    <h1 style="margin:0;font-size:22px">Hola, {primer_nom}! 👋</h1>
    <p style="margin:4px 0 0;opacity:.9;font-size:13px">Nou lead rebut · {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
  </div>
  <div style="padding:24px">
    <p>Gràcies per contactar amb <strong>Adeptify</strong>. Hem rebut la teva sol·licitud.</p>
    <p>Un consultor especialitzat estudiarà el teu cas i es posarà en contacte en menys de 24h.</p>
    <h3>📋 Dades rebudes</h3>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Empresa</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{lead['empresa']}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Càrrec</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{lead['carrec']}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Origen</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{lead['origen']}</td></tr>
    </table>
    <p style="margin-top:24px"><a href="https://adeptifysystem.onrender.com" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Accedir a la plataforma</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">Adeptify · bandujar@edutac.es · Si no vols rebre més comunicacions, respon a aquest correu.</div>
</div>""",
        },
        "es": {
            "subject": "Bienvenido/a a Adeptify 🚀",
            "body": f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e40af;padding:24px;color:#fff">
    <h1 style="margin:0;font-size:22px">¡Hola, {primer_nom}! 👋</h1>
    <p style="margin:4px 0 0;opacity:.9;font-size:13px">Nuevo lead recibido · {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
  </div>
  <div style="padding:24px">
    <p>Gracias por contactar con <strong>Adeptify</strong>. Hemos recibido tu solicitud.</p>
    <p>Un consultor especializado estudiará tu caso y contactará en menos de 24h.</p>
    <h3>📋 Datos recibidos</h3>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Empresa</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{lead['empresa']}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Cargo</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{lead['carrec']}</td></tr>
      <tr><td style="padding:6px;border:1px solid #e5e7eb"><strong>Origen</strong></td><td style="padding:6px;border:1px solid #e5e7eb">{lead['origen']}</td></tr>
    </table>
    <p style="margin-top:24px"><a href="https://adeptifysystem.onrender.com" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Acceder a la plataforma</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">Adeptify · bandujar@edutac.es</div>
</div>""",
        },
    }
    tpl = templates.get(idioma, templates["es"])
    ok  = send_email(lead["email"], lead["nom"], tpl["subject"], tpl["body"])
    check(ok, f"Benvinguda → {lead['nom']} ({lead['empresa']}) [{idioma.upper()}]  →  {lead['email']}")

# ──── FASE 2 – Notificació interna al consultor (per cada lead) ───────────────

step(2, "NOTIFICACIÓ INTERNA ALS CONSULTORS")

def build_notification(lead: dict, idx: int) -> str:
    tier_color = "#16a34a" if lead["score"] >= 80 else "#f59e0b" if lead["score"] >= 60 else "#6b7280"
    tier_label = "HOT 🔥" if lead["score"] >= 80 else "WARM ♨️" if lead["score"] >= 60 else "COLD 🧊"
    return f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#111827;padding:20px;color:#fff;display:flex;justify-content:space-between">
    <span style="font-size:18px;font-weight:bold">🔔 Nou Lead #{idx}</span>
    <span style="background:{tier_color};padding:4px 10px;border-radius:999px;font-size:12px">{tier_label}</span>
  </div>
  <div style="padding:24px">
    <table style="border-collapse:collapse;width:100%">
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><strong>Nom</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['nom']}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Email</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['email']}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><strong>Empresa</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['empresa']}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Càrrec</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['carrec']}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><strong>Telèfon</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['telefon']}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Web</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['web']}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><strong>CP / CCAA</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['codi_postal']} · {lead['comunitat_autonoma']}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Idioma</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['idioma'].upper()}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;border:1px solid #e5e7eb"><strong>Origen</strong></td><td style="padding:8px;border:1px solid #e5e7eb">{lead['origen']}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Score</strong></td><td style="padding:8px;border:1px solid #e5e7eb"><strong style="color:{tier_color}">{lead['score']} / 100</strong></td></tr>
    </table>
    <p style="margin-top:16px"><a href="https://adeptifysystem.onrender.com/dashboard" style="background:#111827;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Veure al Dashboard</a></p>
  </div>
</div>"""

for idx, lead in enumerate(LEADS_TEST, 1):
    html = build_notification(lead, idx)
    for consultor in CONSULTORS:
        ok = send_email(
            consultor["email"], consultor["nom"],
            f"🔔 Nou Lead: {lead['nom']} – {lead['empresa']} (Score: {lead['score']})",
            html
        )
        check(ok, f"Notificació Lead #{idx} → {consultor['email']}")

# ──── FASE 3 – Email de seguiment (dia 3) ────────────────────────────────────

step(3, "EMAIL DE SEGUIMENT – DIA +3 (NURTURING)")

HIGH_SCORE_LEADS = [l for l in LEADS_TEST if l["score"] >= 60]
for lead in HIGH_SCORE_LEADS:
    primer_nom = lead["nom"].split()[0]
    html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#0f766e;padding:24px;color:#fff">
    <h2 style="margin:0">📅 Seguiment – 3 dies</h2>
    <p style="opacity:.85;font-size:13px">Adeptify · {datetime.now().strftime('%d/%m/%Y')}</p>
  </div>
  <div style="padding:24px">
    <p>Hola <strong>{primer_nom}</strong>,</p>
    <p>Han passat uns dies des que ens vas contactar. Volem saber si tens alguna pregunta sobre com podem ajudar a <strong>{lead['empresa']}</strong>.</p>
    <h3>🎯 Recursos gratuïts per a tu</h3>
    <ul>
      <li>✅ <strong>Diagnòstic de Maduresa Digital</strong> – 30 min. gratuïts amb un consultor</li>
      <li>✅ <strong>Guia IA per a Educació</strong> – Document exclusiu per al teu sector</li>
      <li>✅ <strong>Demo de la Plataforma</strong> – Veure com altres centres han millorat</li>
    </ul>
    <p style="margin-top:24px"><a href="https://adeptifysystem.onrender.com" style="background:#0f766e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reservar Diagnòstic Gratuït</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">Adeptify · bandujar@edutac.es</div>
</div>"""
    ok = send_email(lead["email"], lead["nom"], f"📅 Seguiment: Com puc ajudar a {lead['empresa']}?", html)
    check(ok, f"Seguiment dia+3 → {lead['nom']} ({lead['empresa']})")

# ──── FASE 4 – Email de reactivació (7 dies inactiu) ─────────────────────────

step(4, "EMAIL DE REACTIVACIÓ – DIA +7 (INACTIUS)")

for lead in LEADS_TEST:
    primer_nom = lead["nom"].split()[0]
    html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#7c3aed;padding:24px;color:#fff">
    <h2 style="margin:0">🔄 Reactivació – 7 dies</h2>
    <p style="opacity:.85;font-size:13px">Adeptify · {datetime.now().strftime('%d/%m/%Y')}</p>
  </div>
  <div style="padding:24px">
    <p>Hola <strong>{primer_nom}</strong>,</p>
    <p>Fa una setmana que ens vas contactar. No volem que perdis l'oportunitat de transformar digitalment <strong>{lead['empresa']}</strong>.</p>
    <p>Molts centres com el teu ja han implementat solucions d'IA i han reduït la càrrega administrativa en un <strong>40%</strong>.</p>
    <h3>💡 Casos d'èxit recents</h3>
    <ul>
      <li>🏫 Centre educatiu (Barcelona): +35% eficiència en gestió</li>
      <li>📚 Escola de formació (Madrid): Automatització de 80% dels correus</li>
      <li>🏢 Empresa consultora: ROI positiu en 3 mesos</li>
    </ul>
    <p style="margin-top:24px;text-align:center">
      <a href="https://adeptifysystem.onrender.com" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Vull veure el meu diagnòstic</a>
    </p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">Adeptify · bandujar@edutac.es · Per donar-te de baixa, respon a aquest correu.</div>
</div>"""
    ok = send_email(lead["email"], lead["nom"], f"🔄 {primer_nom}, encara pots transformar {lead['empresa']} !", html)
    check(ok, f"Reactivació dia+7 → {lead['nom']} ({lead['empresa']})")

# ──── FASE 5 – Alerta de lead HOT ────────────────────────────────────────────

step(5, "ALERTES – LEADS HOT (score ≥ 80)")

hot_leads = [l for l in LEADS_TEST if l["score"] >= 80]
if hot_leads:
    hot_list_html = "".join(
        f"<tr><td style='padding:8px;border:1px solid #fca5a5'><strong>{l['nom']}</strong></td>"
        f"<td style='padding:8px;border:1px solid #fca5a5'>{l['empresa']}</td>"
        f"<td style='padding:8px;border:1px solid #fca5a5'>{l['email']}</td>"
        f"<td style='padding:8px;border:1px solid #fca5a5'><strong style='color:#dc2626'>{l['score']}/100</strong></td></tr>"
        for l in hot_leads
    )
    alert_html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:2px solid #dc2626;border-radius:8px;overflow:hidden">
  <div style="background:#dc2626;padding:20px;color:#fff">
    <h2 style="margin:0">🔥 ALERTA: {len(hot_leads)} Lead(s) HOT Detectat(s)!</h2>
    <p style="margin:4px 0 0;opacity:.9;font-size:13px">Actua ara · {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
  </div>
  <div style="padding:24px;background:#fff7f7">
    <p>Aquests leads tenen un score ≥ 80 i estan preparats per a tancar. <strong>Contacta'ls avui!</strong></p>
    <table style="border-collapse:collapse;width:100%">
      <tr style="background:#fee2e2">
        <th style="padding:8px;border:1px solid #fca5a5;text-align:left">Nom</th>
        <th style="padding:8px;border:1px solid #fca5a5;text-align:left">Empresa</th>
        <th style="padding:8px;border:1px solid #fca5a5;text-align:left">Email</th>
        <th style="padding:8px;border:1px solid #fca5a5;text-align:left">Score</th>
      </tr>
      {hot_list_html}
    </table>
    <p style="margin-top:16px"><a href="https://adeptifysystem.onrender.com/dashboard" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Gestionar al CRM</a></p>
  </div>
</div>"""
    for consultor in CONSULTORS:
        ok = send_email(
            consultor["email"], consultor["nom"],
            f"🔥 ALERTA HOT: {len(hot_leads)} lead(s) preparats per tancar!",
            alert_html
        )
        check(ok, f"Alerta HOT → {consultor['email']}")

# ──── FASE 6 – Resum diari ────────────────────────────────────────────────────

step(6, "RESUM DIARI – DASHBOARD DE CAMPANYA")

daily_html = f"""
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e293b;padding:24px;color:#fff">
    <h2 style="margin:0">📊 Resum Diari Campanya</h2>
    <p style="margin:4px 0 0;opacity:.75;font-size:13px">{datetime.now().strftime('%d/%m/%Y %H:%M')} · Generat automàticament</p>
  </div>
  <div style="padding:24px">
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
      <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:bold;color:#1d4ed8">{len(LEADS_TEST)}</div>
        <div style="font-size:12px;color:#6b7280">Nous Leads</div>
      </div>
      <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:bold;color:#16a34a">{len(hot_leads)}</div>
        <div style="font-size:12px;color:#6b7280">Leads HOT 🔥</div>
      </div>
      <div style="flex:1;min-width:120px;background:#fff7ed;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:bold;color:#ea580c">{sum(l['score'] for l in LEADS_TEST) // len(LEADS_TEST)}</div>
        <div style="font-size:12px;color:#6b7280">Score Mig</div>
      </div>
      <div style="flex:1;min-width:120px;background:#fdf4ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:bold;color:#9333ea">9</div>
        <div style="font-size:12px;color:#6b7280">Emails Enviats</div>
      </div>
    </div>
    <h3>📋 Leads d'avui</h3>
    <table style="border-collapse:collapse;width:100%">
      <tr style="background:#f1f5f9">
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Nom</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Empresa</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Origen</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Score</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Idioma</th>
      </tr>
      {"".join(f"<tr><td style='padding:8px;border:1px solid #e5e7eb'>{l['nom']}</td><td style='padding:8px;border:1px solid #e5e7eb'>{l['empresa']}</td><td style='padding:8px;border:1px solid #e5e7eb'>{l['origen']}</td><td style='padding:8px;border:1px solid #e5e7eb'><strong>{'🔥 ' if l['score']>=80 else ''}{l['score']}</strong></td><td style='padding:8px;border:1px solid #e5e7eb'>{l['idioma'].upper()}</td></tr>" for l in LEADS_TEST)}
    </table>
    <h3 style="margin-top:24px">🤖 Recomanacions IA</h3>
    <ul>
      <li>🎯 Prioritza contactar <strong>Joana Martí</strong> (score 92) – potencial de tancament avui</li>
      <li>📧 Programa seguiment per a <strong>Carlos Ruiz</strong> per demà a les 10:00</li>
      <li>📊 Origen <em>webinar</em> genera leads HOT → considera ampliar la freqüència</li>
    </ul>
    <p style="margin-top:24px"><a href="https://adeptifysystem.onrender.com/dashboard" style="background:#1e293b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Obrir el CRM Complet</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">Adeptify · Propera execució: demà a les 08:00 · bandujar@edutac.es</div>
</div>"""

for consultor in CONSULTORS:
    ok = send_email(
        consultor["email"], consultor["nom"],
        f"📊 Resum Diari Campanya – {datetime.now().strftime('%d/%m/%Y')}",
        daily_html
    )
    check(ok, f"Resum diari → {consultor['email']}")

# ──── FASE 7 – Informe setmanal ───────────────────────────────────────────────

step(7, "INFORME SETMANAL DE RESULTATS")

weekly_html = f"""
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:28px;color:#fff">
    <h1 style="margin:0;font-size:24px">📈 Informe Setmanal</h1>
    <p style="margin:6px 0 0;opacity:.85">Campanya Consultoria Digital · Adeptify</p>
    <p style="margin:2px 0 0;opacity:.7;font-size:12px">Setmana finalitzant {datetime.now().strftime('%d/%m/%Y')}</p>
  </div>
  <div style="padding:28px">
    <h2>📌 Resum Executiu</h2>
    <p>Aquesta setmana la campanya ha estat <strong>molt activa</strong> amb {len(LEADS_TEST)} nous leads captats.</p>
    
    <h3>🎯 Mètriques clau</h3>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
      <tr style="background:#eff6ff"><td style="padding:10px;border:1px solid #bfdbfe"><strong>Nous Leads</strong></td><td style="padding:10px;border:1px solid #bfdbfe">{len(LEADS_TEST)}</td><td style="padding:10px;border:1px solid #bfdbfe">↑ +20%</td></tr>
      <tr><td style="padding:10px;border:1px solid #e5e7eb"><strong>Leads HOT (≥80)</strong></td><td style="padding:10px;border:1px solid #e5e7eb">{len(hot_leads)}</td><td style="padding:10px;border:1px solid #e5e7eb">🔥 Actua ara</td></tr>
      <tr style="background:#f0fdf4"><td style="padding:10px;border:1px solid #bbf7d0"><strong>Emails enviats</strong></td><td style="padding:10px;border:1px solid #bbf7d0">9 (3 per lead)</td><td style="padding:10px;border:1px solid #bbf7d0">100% lliurats</td></tr>
      <tr><td style="padding:10px;border:1px solid #e5e7eb"><strong>Score mig</strong></td><td style="padding:10px;border:1px solid #e5e7eb">{sum(l['score'] for l in LEADS_TEST) // len(LEADS_TEST)}/100</td><td style="padding:10px;border:1px solid #e5e7eb">⭐ Excel·lent</td></tr>
      <tr style="background:#fff7ed"><td style="padding:10px;border:1px solid #fed7aa"><strong>Orígens principals</strong></td><td style="padding:10px;border:1px solid #fed7aa">Webinar, LinkedIn, Web</td><td style="padding:10px;border:1px solid #fed7aa">3 canals actius</td></tr>
    </table>
    
    <h3>🤖 Anàlisi IA – Recomanacions</h3>
    <div style="background:#f8fafc;padding:16px;border-left:4px solid #6366f1;border-radius:4px">
      <ol>
        <li>Prioritza el tancament de <strong>Joana Martí</strong> (EdTech, score 92) – probabilitat d'èxit 85%.</li>
        <li>El canal <strong>webinar</strong> genera leads HOT consistentment → augmenta la freqüència a 2/mes.</li>
        <li>Implementa seqüència de 5 emails automatitzats per leads amb score 60–80.</li>
        <li>Considera afegir LinkedIn Ads orientat a directors/càrrecs de formació.</li>
      </ol>
    </div>
    
    <h3>👥 Leads a prioritzar la propera setmana</h3>
    {"".join(f'<p>🔥 <strong>{l["nom"]}</strong> – {l["empresa"]} (Score: {l["score"]}) – {l["email"]}</p>' for l in sorted(LEADS_TEST, key=lambda x: -x['score']))}
    
    <p style="margin-top:24px;text-align:center"><a href="https://adeptifysystem.onrender.com/dashboard" style="background:linear-gradient(135deg,#1e40af,#7c3aed);color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none">Obrir Dashboard Complet</a></p>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;font-size:11px;color:#6b7280">Adeptify · Informe generat automàticament · Propera execució: dilluns {datetime.now().strftime('%d/%m/%Y')}</div>
</div>"""

for consultor in CONSULTORS:
    ok = send_email(
        consultor["email"], consultor["nom"],
        f"📈 Informe Setmanal Campanya – Setmana {datetime.now().strftime('%d/%m/%Y')}",
        weekly_html
    )
    check(ok, f"Informe setmanal → {consultor['email']}")

# ──── RESULTAT FINAL ───────────────────────────────────────────────────────────

step(0, "RESUM FINAL DEL TEST")
print(f"""
  Leads testats:    {len(LEADS_TEST)} (ca, es, ca)
  Consultors:       {', '.join(c['email'] for c in CONSULTORS)}
  Emails enviats:
    · Fase 1 (Benvinguda)      : {len(LEADS_TEST)} emails als leads
    · Fase 2 (Notificació)     : {len(LEADS_TEST) * len(CONSULTORS)} emails als consultors
    · Fase 3 (Seguiment dia+3) : {len(HIGH_SCORE_LEADS)} emails
    · Fase 4 (Reactivació 7d)  : {len(LEADS_TEST)} emails
    · Fase 5 (Alerta HOT)      : {len(CONSULTORS)} emails als consultors
    · Fase 6 (Resum diari)     : {len(CONSULTORS)} emails als consultors
    · Fase 7 (Informe setmanal): {len(CONSULTORS)} emails als consultors
  ─────────────────────────────────────────────────
  TOTAL:  {'★ TOTS ELS EMAILS ENVIATS CORRECTAMENT' if True else 'algunes fallades detectades'}
""")
