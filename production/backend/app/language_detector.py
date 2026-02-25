"""
Detector d'idioma basat en codi postal / comunitat autònoma.
Regla de negoci: CA per defecte, EU per País Basc/Navarra.
"""

# Prefixos de codi postal per comunitat
POSTAL_CODE_MAP = {
    # Catalunya
    "08": "ca", "17": "ca", "25": "ca", "43": "ca",
    # Illes Balears (català)
    "07": "ca",
    # País Valencià (català)
    "03": "ca", "12": "ca", "46": "ca",
    # País Basc
    "01": "eu", "20": "eu", "48": "eu",
    # Navarra
    "31": "eu",
}

# Comunitats autònomes → idioma
CCAA_MAP = {
    "catalunya": "ca",
    "cataluña": "ca",
    "illes balears": "ca",
    "islas baleares": "ca",
    "comunitat valenciana": "ca",
    "comunidad valenciana": "ca",
    "país vasco": "eu",
    "euskadi": "eu",
    "país basc": "eu",
    "navarra": "eu",
    "nafarroa": "eu",
}

DEFAULT_LANGUAGE = "ca"


def detect_language_by_postal_code(postal_code: str) -> str:
    """Detecta l'idioma preferit a partir del codi postal."""
    if not postal_code or len(postal_code) < 2:
        return DEFAULT_LANGUAGE
    prefix = postal_code[:2]
    return POSTAL_CODE_MAP.get(prefix, "es")


def detect_language_by_ccaa(ccaa: str) -> str:
    """Detecta l'idioma a partir de la comunitat autònoma."""
    if not ccaa:
        return DEFAULT_LANGUAGE
    return CCAA_MAP.get(ccaa.lower().strip(), "es")


def detect_language(postal_code: str = "", ccaa: str = "") -> str:
    """
    Detecta l'idioma combinant codi postal i CCAA.
    Prioritat: codi postal > CCAA > defecte (ca).
    """
    if postal_code:
        lang = detect_language_by_postal_code(postal_code)
        if lang != "es":  # Si és ca o eu, confirmat
            return lang
    if ccaa:
        lang = detect_language_by_ccaa(ccaa)
        if lang != "es":
            return lang
    if postal_code:
        return detect_language_by_postal_code(postal_code)
    return DEFAULT_LANGUAGE
