"""
Motor de Lead Scoring automàtic.
Assigna punts segons interaccions, perfil i comportament.
"""
from app.config import get_settings

settings = get_settings()

# ── Matriu de puntuació per tipus d'interacció ──
SCORING_MATRIX = {
    # Interaccions web
    "visita_landing": 2,
    "descarrega_guia": 10,
    "descarrega_dossier": 40,
    "formulari_contacte": 15,
    "formulari_diagnostic": 20,

    # Email
    "email_obert": 3,
    "email_clic": 5,
    "email_resposta": 15,

    # Webinar
    "registre_webinar": 10,
    "assistencia_webinar": 20,

    # Reunions
    "trucada_realitzada": 15,
    "reunio_programada": 25,
    "reunio_realitzada": 30,
    "demo_sol_licitada": 25,

    # Social
    "linkedin_connexio": 5,
    "linkedin_interaccio": 3,

    # Negatiu
    "email_rebujat": -5,
    "baixa_newsletter": -20,
    "no_resposta_30d": -10,
}

# ── Punts de perfil (dades demogràfiques) ──
PROFILE_SCORING = {
    "te_empresa": 10,
    "te_carrec_decisor": 15,  # CEO, CTO, Director
    "te_telefon": 5,
    "te_web": 5,
    "empresa_objectiu_b2b": 10,
}

DECISOR_KEYWORDS = [
    "ceo", "cto", "cio", "coo", "director", "directora",
    "gerent", "gerente", "propietari", "propietaria",
    "fundador", "fundadora", "responsable", "cap de",
    "jefe", "jefa", "owner", "manager", "zuzendari",
]


def calculate_interaction_score(interaction_type: str) -> int:
    """Retorna els punts per un tipus d'interacció."""
    return SCORING_MATRIX.get(interaction_type, 0)


def calculate_profile_score(
    empresa: str = "",
    carrec: str = "",
    telefon: str = "",
    web: str = "",
) -> int:
    """Calcula punts de perfil del lead."""
    score = 0
    if empresa:
        score += PROFILE_SCORING["te_empresa"]
    if telefon:
        score += PROFILE_SCORING["te_telefon"]
    if web:
        score += PROFILE_SCORING["te_web"]
    if carrec:
        carrec_lower = carrec.lower()
        if any(kw in carrec_lower for kw in DECISOR_KEYWORDS):
            score += PROFILE_SCORING["te_carrec_decisor"]
    return score


def get_lead_tier(score: int) -> str:
    """Classifica el lead segons el score."""
    if score >= settings.SCORE_THRESHOLD_HOT:
        return "hot"
    elif score >= settings.SCORE_THRESHOLD_SQL:
        return "sql"
    elif score >= settings.SCORE_THRESHOLD_MQL:
        return "mql"
    return "lead"


def should_trigger_alert(score: int, previous_score: int) -> str | None:
    """Determina si cal llançar una alerta pel canvi de score."""
    for threshold, tier in [
        (settings.SCORE_THRESHOLD_HOT, "hot"),
        (settings.SCORE_THRESHOLD_SQL, "sql"),
        (settings.SCORE_THRESHOLD_MQL, "mql"),
    ]:
        if score >= threshold and previous_score < threshold:
            return tier
    return None
