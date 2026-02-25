#!/usr/bin/env python3
"""
===============================================================================
GENERADOR D'IMATGES DE CAMPANYA - NANO BANANA API (Gemini Image)
===============================================================================
Genera totes les imatges necessàries per a la campanya de consultoria digital
utilitzant l'API Nano Banana (Gemini 2.5 Flash Image / Gemini 3 Pro Image).

Ús:
    export GEMINI_API_KEY="la_teva_clau_api"
    python generate_campaign_images.py [--model flash|pro] [--lang ca|es|eu]

Autor: Sistema de Campanya Automatitzat
Versió: 1.0.0
===============================================================================
"""

import os
import sys
import json
import time
import base64
import argparse
import logging
from pathlib import Path
from datetime import datetime

try:
    from google import genai
    from google.genai import types
    USE_SDK = True
except ImportError:
    import urllib.request
    import urllib.parse
    USE_SDK = False

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓ
# ─────────────────────────────────────────────────────────────────────────────

MODELS = {
    "flash": "gemini-2.5-flash-image",      # Ràpid, econòmic (~$0.039/imatge)
    "pro": "gemini-3-pro-image-preview",     # Pro, 4K (~$0.12/imatge)
}

API_BASE = "https://generativelanguage.googleapis.com/v1beta"

OUTPUT_DIR = Path("generated_images")
LOG_FILE = "image_generation.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# PROMPTS D'IMATGES PER LA CAMPANYA (TRILINGÜE)
# ─────────────────────────────────────────────────────────────────────────────

CAMPAIGN_IMAGES = {
    # ── LOGO I BRANDING ──
    "logo_campanya": {
        "prompt": {
            "ca": (
                "Dissenya un logotip professional i modern per a una campanya de "
                "consultoria de transformació digital anomenada 'Impulsa el teu Negoci Digital'. "
                "Estil minimalista, colors blau tecnològic (#0066CC) i verd innovació (#00CC66), "
                "fons transparent, tipografia sans-serif neta. Inclou un símbol abstracte "
                "que representi connexió digital i creixement empresarial. "
                "Format quadrat, apte per xarxes socials i web."
            ),
            "es": (
                "Diseña un logotipo profesional y moderno para una campaña de "
                "consultoría de transformación digital llamada 'Impulsa tu Negocio Digital'. "
                "Estilo minimalista, colores azul tecnológico (#0066CC) y verde innovación (#00CC66), "
                "fondo transparente, tipografía sans-serif limpia. Incluye un símbolo abstracto "
                "que represente conexión digital y crecimiento empresarial."
            ),
            "eu": (
                "Diseinatu logotipo profesional eta moderno bat aholkularitza digitalaren "
                "kanpaina baterako, 'Bultzatu zure Negozio Digitala' izenekoa. "
                "Estilo minimalista, kolore teknologiko urdina (#0066CC) eta berrikuntza berdea (#00CC66), "
                "atzeko plano gardena, tipografia sans-serif garbia."
            ),
        },
        "aspect_ratio": "1:1",
        "size": "2K",
        "category": "branding",
    },

    # ── HERO BANNER LANDING PAGE ──
    "hero_landing": {
        "prompt": {
            "ca": (
                "Imatge hero per a una landing page de consultoria tecnològica. "
                "Mostra un entorn d'oficina modern amb professionals treballant amb "
                "pantalles hologràfiques, gràfics de dades i interfícies digitals. "
                "Atmosfera professional però futurista, il·luminació càlida amb accents blaus. "
                "Estil fotorealista, alta qualitat, sense text superposat. "
                "Composició horitzontal panoràmica."
            ),
            "es": (
                "Imagen hero para landing page de consultoría tecnológica. "
                "Muestra un entorno de oficina moderno con profesionales trabajando con "
                "pantallas holográficas, gráficos de datos e interfaces digitales. "
                "Atmósfera profesional pero futurista, iluminación cálida con acentos azules. "
                "Estilo fotorrealista, alta calidad, sin texto superpuesto."
            ),
            "eu": (
                "Hero irudia aholkularitza teknologikoaren landing page baterako. "
                "Erakutsi bulego moderno bat profesionalekin pantaila holografikoekin lan egiten, "
                "datu-grafikoekin eta interfaze digitalekin. Giro profesionala baina futurista."
            ),
        },
        "aspect_ratio": "16:9",
        "size": "2K",
        "category": "landing",
    },

    # ── BLOG: 5 SEÑALES DE DIGITALIZACIÓN ──
    "blog_5_senyals": {
        "prompt": {
            "ca": (
                "Il·lustració conceptual per a un article de blog sobre les 5 senyals "
                "que la teva empresa necessita digitalitzar-se. Mostra una transformació visual: "
                "a l'esquerra, un despatx tradicional antic amb papers i arxivadors; "
                "a la dreta, un espai digital modern amb pantalles i connexions al núvol. "
                "Una línia de transició gradual connecta ambdós mons. "
                "Estil il·lustració plana moderna, colors blau i taronja, net i professional."
            ),
            "es": (
                "Ilustración conceptual para artículo de blog sobre las 5 señales "
                "de que tu empresa necesita digitalizarse. Muestra transformación visual: "
                "a la izquierda, oficina tradicional antigua con papeles y archivadores; "
                "a la derecha, espacio digital moderno con pantallas y conexiones en la nube. "
                "Estilo ilustración plana moderna, colores azul y naranja."
            ),
            "eu": (
                "Kontzeptu-ilustrazioa blog artikulu baterako, enpresak digitalizatu behar "
                "duela adierazten duten 5 seinaleei buruz. Erakutsi eraldaketa bisuala: "
                "ezkerrean, bulego tradizionala; eskuinean, espazio digital modernoa."
            ),
        },
        "aspect_ratio": "16:9",
        "size": "2K",
        "category": "blog",
    },

    # ── LINKEDIN: PRE-LLANÇAMENT ──
    "linkedin_prelanzamiento_1": {
        "prompt": {
            "ca": (
                "Imatge per a un post de LinkedIn sobre transformació digital per a pimes. "
                "Mostra un gràfic d'ascens amb una fletxa digital brillant que puja, "
                "amb icones de tecnologia (núvol, IA, dades) integrades al camí. "
                "Fons professional fosc amb accent blau elèctric. "
                "Format quadrat 1:1, estil corporatiu modern, net sense text."
            ),
            "es": (
                "Imagen para post de LinkedIn sobre transformación digital para pymes. "
                "Gráfico de ascenso con flecha digital brillante subiendo, "
                "iconos de tecnología (nube, IA, datos) integrados al camino. "
                "Fondo profesional oscuro con acento azul eléctrico."
            ),
            "eu": (
                "LinkedIn argitalpen baterako irudia enpresa txiki eta ertainen "
                "eraldaketa digitalari buruz. Gora egiten duen gezi digital distiratsua."
            ),
        },
        "aspect_ratio": "1:1",
        "size": "2K",
        "category": "social",
    },

    "linkedin_prelanzamiento_2": {
        "prompt": {
            "ca": (
                "Infografia visual per LinkedIn sobre intel·ligència artificial per a pimes. "
                "Mostra un cervell digital connectat amb engranatges empresarials, "
                "circuits i nodes de xarxa. Estil isomètric 3D, colors blau-lila gradient, "
                "fons net blanc/gris clar. Format quadrat, professional i atractiu."
            ),
            "es": (
                "Infografía visual para LinkedIn sobre inteligencia artificial para pymes. "
                "Cerebro digital conectado con engranajes empresariales, "
                "circuitos y nodos de red. Estilo isométrico 3D, colores azul-lila gradiente."
            ),
            "eu": (
                "LinkedIn-erako infografia bisuala adimen artifizialari buruz ETEentzat. "
                "Garun digitala enpresa-engranajeei konektatuta."
            ),
        },
        "aspect_ratio": "1:1",
        "size": "2K",
        "category": "social",
    },

    "linkedin_prelanzamiento_3": {
        "prompt": {
            "ca": (
                "Post visual LinkedIn: estadístiques de digitalització empresarial. "
                "Mostra un dashboard hologràfic flotant amb gràfics de barres i percentatges, "
                "una mà professional interactuant amb les dades. "
                "Estil futurista però accessible, colors blau corporatiu i verd esperança."
            ),
            "es": (
                "Post visual LinkedIn: estadísticas de digitalización empresarial. "
                "Dashboard holográfico flotante con gráficos de barras y porcentajes, "
                "mano profesional interactuando con los datos."
            ),
            "eu": (
                "LinkedIn argitalpen bisuala: enpresa-digitalizazioaren estatistikak. "
                "Dashboard holografiko flotagarria barra-grafikoekin."
            ),
        },
        "aspect_ratio": "1:1",
        "size": "2K",
        "category": "social",
    },

    # ── WEBINAR ──
    "webinar_cover": {
        "prompt": {
            "ca": (
                "Portada per a un webinar titulat 'Primers Passos en IA per a Pimes'. "
                "Mostra un escenari virtual de presentació amb una pantalla gran "
                "que mostra gràfics d'IA i dades. Un presentador professional davant "
                "d'una audiència virtual representada per icones de vídeo. "
                "Estil modern, colors gradient blau a violeta, alta qualitat. "
                "Format 16:9, sense text visible."
            ),
            "es": (
                "Portada para webinar 'Primeros Pasos en IA para Pymes'. "
                "Escenario virtual de presentación con pantalla grande "
                "mostrando gráficos de IA y datos. Presentador profesional ante "
                "audiencia virtual representada por iconos de video."
            ),
            "eu": (
                "Webinar baten azala 'ETEentzat AAren Lehen Urratsak'. "
                "Aurkezpen-eszenario birtuala pantaila handiz."
            ),
        },
        "aspect_ratio": "16:9",
        "size": "2K",
        "category": "webinar",
    },

    # ── EMAIL: LEAD MAGNET ──
    "email_lead_magnet": {
        "prompt": {
            "ca": (
                "Header per a un email de lead magnet: 'Guia gratuïta de diagnòstic digital'. "
                "Mostra un document digital brillant flotant amb un check verd, "
                "envoltat de partícules de dades i icones de tecnologia. "
                "Fons gradient blau fosc a negre, estil premium i professional. "
                "Format horitzontal 3:1, net i elegant."
            ),
            "es": (
                "Header para email de lead magnet: 'Guía gratuita de diagnóstico digital'. "
                "Documento digital brillante flotando con check verde, "
                "rodeado de partículas de datos e iconos de tecnología."
            ),
            "eu": (
                "Email-aren goiburua lead magnet baterako: 'Diagnostiko digitalaren gida doakoa'. "
                "Dokumentu digital distiratsua flotatzen."
            ),
        },
        "aspect_ratio": "3:1",
        "size": "2K",
        "category": "email",
    },

    # ── EMAIL: NURTURING SEQUENCE ──
    "email_nurturing_caso_exito": {
        "prompt": {
            "ca": (
                "Imatge per email de cas d'èxit de transformació digital. "
                "Mostra un gràfic dramàtic d'abans/després: a l'esquerra, "
                "un edifici d'oficines gris; a la dreta, el mateix edifici "
                "transformat en un hub tecnològic brillant amb connexions digitals. "
                "Estil il·lustració moderna, colors contrastats."
            ),
            "es": (
                "Imagen para email de caso de éxito de transformación digital. "
                "Gráfico dramático antes/después: edificio de oficinas gris "
                "transformado en hub tecnológico brillante con conexiones digitales."
            ),
            "eu": (
                "Emailerako irudia eraldaketa digitalaren arrakasta-kasua. "
                "Aurretik/ondoren grafiko dramatikoa."
            ),
        },
        "aspect_ratio": "16:9",
        "size": "2K",
        "category": "email",
    },

    # ── DIAGNÒSTIC ──
    "diagnostic_report_cover": {
        "prompt": {
            "ca": (
                "Portada per a un informe de diagnòstic digital personalitzat. "
                "Mostra un escàner digital analitzant una empresa des de dalt, "
                "amb raigs de llum blava revelant capes d'informació: processos, "
                "dades, tecnologia. Estil futurista però professional, "
                "paleta blau-plata, format A4 vertical."
            ),
            "es": (
                "Portada para informe de diagnóstico digital personalizado. "
                "Escáner digital analizando una empresa desde arriba, "
                "rayos de luz azul revelando capas de información."
            ),
            "eu": (
                "Diagnostiko digital pertsonalizatuko txosten baten azala. "
                "Eskaner digitala enpresa bat goitik aztertzen."
            ),
        },
        "aspect_ratio": "3:4",
        "size": "2K",
        "category": "report",
    },

    # ── SOCIAL ADS ──
    "ad_facebook_retargeting": {
        "prompt": {
            "ca": (
                "Anunci per Facebook/Instagram Ads de retargeting per consultoría digital. "
                "Mostra un professional somrient davant d'una pantalla amb dashboards "
                "i mètriques positives. Ambient d'oficina moderna, llum natural. "
                "Estil fotorealista, colors càlids amb accents blaus. "
                "Format quadrat 1:1, alta qualitat."
            ),
            "es": (
                "Anuncio para Facebook/Instagram Ads de retargeting para consultoría digital. "
                "Profesional sonriente ante pantalla con dashboards y métricas positivas."
            ),
            "eu": (
                "Facebook/Instagram Ads birbidalketarako iragarkia aholkularitza digitalerako. "
                "Profesional irribarretsu bat pantaila baten aurrean."
            ),
        },
        "aspect_ratio": "1:1",
        "size": "2K",
        "category": "ads",
    },

    # ── THANK YOU / CONFIRMATION ──
    "thank_you_page": {
        "prompt": {
            "ca": (
                "Imatge per a una pàgina de confirmació/agraïment després d'un registre. "
                "Mostra confeti digital, un sobre obert amb llum brillant sortint, "
                "i icones de celebració tecnològica. Estil alegre però professional, "
                "colors blau, verd i daurat. Format horitzontal 16:9."
            ),
            "es": (
                "Imagen para página de confirmación/agradecimiento tras un registro. "
                "Confeti digital, sobre abierto con luz brillante saliendo, "
                "iconos de celebración tecnológica."
            ),
            "eu": (
                "Erregistro baten ondoren eskerrak ematearen orrirako irudia. "
                "Konfeti digitala, gutun-azal irekia argi distiratsuz."
            ),
        },
        "aspect_ratio": "16:9",
        "size": "2K",
        "category": "landing",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# GENERADOR D'IMATGES
# ─────────────────────────────────────────────────────────────────────────────

class NanoBananaImageGenerator:
    """Generador d'imatges via Nano Banana API (Gemini Image)."""

    def __init__(self, api_key: str, model: str = "flash"):
        self.api_key = api_key
        self.model_name = MODELS.get(model, MODELS["flash"])
        self.generated = []
        self.errors = []
        logger.info(f"Inicialitzat generador amb model: {self.model_name}")

    def generate_image_sdk(self, prompt: str, aspect_ratio: str = "16:9",
                           size: str = "2K") -> bytes | None:
        """Genera imatge usant el SDK oficial de Google GenAI."""
        try:
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model_name,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                    image_generation_config=types.ImageGenerationConfig(
                        aspect_ratio=aspect_ratio,
                        image_size=size,
                    ),
                ),
            )
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    return part.inline_data.data
            logger.warning("Resposta sense dades d'imatge")
            return None
        except Exception as e:
            logger.error(f"Error SDK: {e}")
            return None

    def generate_image_rest(self, prompt: str, aspect_ratio: str = "16:9",
                            size: str = "2K") -> bytes | None:
        """Genera imatge via REST API directe (fallback sense SDK)."""
        try:
            url = f"{API_BASE}/models/{self.model_name}:generateContent"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseModalities": ["TEXT", "IMAGE"],
                    "imageConfig": {
                        "aspectRatio": aspect_ratio,
                        "imageSize": size,
                    },
                },
            }
            headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            for part in data["candidates"][0]["content"]["parts"]:
                if "inlineData" in part:
                    return base64.b64decode(part["inlineData"]["data"])
            logger.warning("Resposta REST sense imatge")
            return None
        except Exception as e:
            logger.error(f"Error REST: {e}")
            return None

    def generate_image(self, prompt: str, **kwargs) -> bytes | None:
        """Genera imatge usant el mètode disponible (SDK o REST)."""
        if USE_SDK:
            return self.generate_image_sdk(prompt, **kwargs)
        return self.generate_image_rest(prompt, **kwargs)

    def generate_all_campaign_images(self, lang: str = "ca",
                                      output_dir: Path = OUTPUT_DIR) -> dict:
        """Genera totes les imatges de la campanya en l'idioma especificat."""
        output_dir.mkdir(parents=True, exist_ok=True)
        results = {"success": [], "errors": [], "skipped": []}
        total = len(CAMPAIGN_IMAGES)

        logger.info(f"═══ Generant {total} imatges en '{lang}' ═══")

        for idx, (name, config) in enumerate(CAMPAIGN_IMAGES.items(), 1):
            prompt_text = config["prompt"].get(lang, config["prompt"]["ca"])
            aspect = config.get("aspect_ratio", "16:9")
            size = config.get("size", "2K")
            category = config.get("category", "misc")

            cat_dir = output_dir / category
            cat_dir.mkdir(parents=True, exist_ok=True)
            filepath = cat_dir / f"{name}_{lang}.png"

            # Salt si ja existeix
            if filepath.exists():
                logger.info(f"[{idx}/{total}] ⏭ Ja existeix: {filepath.name}")
                results["skipped"].append(str(filepath))
                continue

            logger.info(f"[{idx}/{total}] Generant: {name} ({aspect}, {size})")
            logger.info(f"  Prompt: {prompt_text[:80]}...")

            image_data = self.generate_image(
                prompt=prompt_text,
                aspect_ratio=aspect,
                size=size,
            )

            if image_data:
                filepath.write_bytes(image_data)
                file_size_kb = len(image_data) / 1024
                logger.info(f"  ✓ Desat: {filepath} ({file_size_kb:.1f} KB)")
                results["success"].append({
                    "name": name,
                    "path": str(filepath),
                    "size_kb": round(file_size_kb, 1),
                    "category": category,
                })
            else:
                logger.error(f"  ✗ Error generant: {name}")
                results["errors"].append(name)

            # Rate limiting: 0.5s entre peticions
            if idx < total:
                time.sleep(0.5)

        return results

    def generate_multilingual(self, output_dir: Path = OUTPUT_DIR) -> dict:
        """Genera imatges en els 3 idiomes: CA, ES, EU."""
        all_results = {}
        for lang in ["ca", "es", "eu"]:
            logger.info(f"\n{'═'*60}")
            logger.info(f"  IDIOMA: {lang.upper()}")
            logger.info(f"{'═'*60}")
            all_results[lang] = self.generate_all_campaign_images(
                lang=lang,
                output_dir=output_dir / lang,
            )
        return all_results


# ─────────────────────────────────────────────────────────────────────────────
# GENERADOR DE MANIFEST / INVENTARI
# ─────────────────────────────────────────────────────────────────────────────

def generate_manifest(results: dict, output_dir: Path) -> Path:
    """Genera un manifest JSON amb l'inventari de totes les imatges."""
    manifest = {
        "generated_at": datetime.now().isoformat(),
        "total_images": sum(
            len(r.get("success", []))
            for r in (results.values() if isinstance(list(results.values())[0], dict) else [results])
        ),
        "languages": list(results.keys()) if isinstance(list(results.values())[0], dict) else ["single"],
        "results": results,
        "campaign": "Impulsa el teu Negoci Digital",
        "model_used": None,  # S'omple en runtime
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    logger.info(f"Manifest desat a: {manifest_path}")
    return manifest_path


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generador d'imatges de campanya via Nano Banana API"
    )
    parser.add_argument(
        "--model", choices=["flash", "pro"], default="flash",
        help="Model a usar: flash (ràpid) o pro (alta qualitat 4K)"
    )
    parser.add_argument(
        "--lang", choices=["ca", "es", "eu", "all"], default="ca",
        help="Idioma dels prompts (default: ca, 'all' per tots)"
    )
    parser.add_argument(
        "--output", type=str, default="generated_images",
        help="Directori de sortida"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Mostra els prompts sense generar imatges"
    )
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        logger.error("ERROR: Cal definir GEMINI_API_KEY")
        logger.error("  export GEMINI_API_KEY='la_teva_clau'")
        logger.error("  Aconsegueix-la a: https://aistudio.google.com/apikey")
        sys.exit(1)

    output_dir = Path(args.output)

    if args.dry_run:
        logger.info("═══ MODE DRY-RUN: Mostrant prompts ═══\n")
        lang = args.lang if args.lang != "all" else "ca"
        for name, config in CAMPAIGN_IMAGES.items():
            prompt = config["prompt"].get(lang, config["prompt"]["ca"])
            print(f"📷 {name}")
            print(f"   Aspect: {config['aspect_ratio']} | Size: {config['size']}")
            print(f"   Category: {config['category']}")
            print(f"   Prompt ({lang}): {prompt[:120]}...")
            print()
        print(f"Total: {len(CAMPAIGN_IMAGES)} imatges a generar")
        return

    generator = NanoBananaImageGenerator(api_key=api_key, model=args.model)

    if args.lang == "all":
        results = generator.generate_multilingual(output_dir)
    else:
        results = generator.generate_all_campaign_images(args.lang, output_dir)

    manifest = generate_manifest(results, output_dir)

    # Resum final
    print(f"\n{'═'*60}")
    print(f"  RESUM DE GENERACIÓ D'IMATGES")
    print(f"{'═'*60}")
    if isinstance(list(results.values())[0], dict) and "success" in list(results.values())[0]:
        s = len(results.get("success", []))
        e = len(results.get("errors", []))
        print(f"  Generades: {s} | Errors: {e}")
    else:
        for lang, r in results.items():
            s = len(r.get("success", []))
            e = len(r.get("errors", []))
            print(f"  [{lang.upper()}] Generades: {s} | Errors: {e}")
    print(f"  Manifest: {manifest}")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
