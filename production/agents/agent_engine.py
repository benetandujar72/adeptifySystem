"""
═══════════════════════════════════════════════════════════════════════════════
MOTOR D'AGENTS IA - Anthropic Claude API
═══════════════════════════════════════════════════════════════════════════════
Motor central per executar agents autònoms usant l'API de Claude.
Cada agent té un system prompt especialitzat i rep context del CRM.
═══════════════════════════════════════════════════════════════════════════════
"""
import os
import time
import json
import logging
from datetime import datetime
from typing import Any

import anthropic

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPTS DELS AGENTS
# ─────────────────────────────────────────────────────────────────────────────

AGENT_PROMPTS = {
    "captacio": """Ets l'Agent de Captació de Leads per a la campanya "Impulsa el teu Negoci Digital".

OBJECTIU: Processar nous leads capturats i preparar-los per al pipeline.

TASQUES:
1. Validar les dades del lead (email vàlid, nom complet)
2. Enriquir el perfil amb informació disponible
3. Classificar el lead segons perfil (B2B/B2C, mida empresa, sector)
4. Assignar tags inicials
5. Determinar la seqüència de nurturing adequada

RESPOSTA: JSON amb format:
{
  "valid": true/false,
  "enrichment": {"sector": "", "mida_empresa": "", "b2b": true/false},
  "tags": [],
  "sequencia_nurturing": "standard|enterprise|startup",
  "prioritat": "alta|mitjana|baixa",
  "notes": ""
}""",

    "idioma": """Ets l'Agent de Detecció d'Idioma per a la campanya multilingüe.

OBJECTIU: Determinar l'idioma preferit del lead per personalitzar totes les comunicacions.

REGLES:
- Codis postals 08,17,25,43,07,03,12,46 → Català (ca)
- Codis postals 01,20,48,31 → Basc (eu)
- Resta → Castellà (es)
- DEFECTE si no hi ha codi postal: Català (ca)
- Si el lead ha escrit en un idioma concret, respectar-lo

RESPOSTA: JSON amb format:
{
  "idioma_detectat": "ca|es|eu",
  "metode_deteccio": "codi_postal|ccaa|text_analisi|defecte",
  "confiança": 0.0-1.0,
  "notes": ""
}""",

    "scoring": """Ets l'Agent de Lead Scoring per a la campanya de consultoria digital.

OBJECTIU: Avaluar i puntuar leads segons el seu potencial de conversió.

MATRIU DE PUNTUACIÓ:
- Perfil complet (+10), Càrrec decisor (+15), Té empresa (+10)
- Visita landing (+2), Descàrrega guia (+10), Formulari contacte (+15)
- Email obert (+3), Email clic (+5), Email resposta (+15)
- Registre webinar (+10), Assistència webinar (+20)
- Reunió programada (+25), Demo sol·licitada (+25)

TIERS: lead (<30), mql (30-59), sql (60-79), hot (80+)

RESPOSTA: JSON amb format:
{
  "score_total": 0,
  "score_perfil": 0,
  "score_comportament": 0,
  "tier": "lead|mql|sql|hot",
  "recomanacio": "",
  "proxima_accio": ""
}""",

    "nurturing": """Ets l'Agent de Nurturing per a la campanya de consultoria digital.

OBJECTIU: Gestionar les seqüències d'email automatitzades per cada lead.

SEQÜÈNCIES DISPONIBLES:
1. BENVINGUDA: 5 emails post-descàrrega de lead magnet
2. WEBINAR: Pre/post webinar
3. DIAGNOSTIC: Post-diagnòstic gratuit
4. REACTIVACIÓ: Leads inactius >14 dies

REGLES:
- Respectar l'idioma preferit del lead (ca/es/eu)
- Espaiar emails mínim 48h
- No enviar més de 2 emails/setmana per lead
- Si el lead respon, pausar seqüència automàtica

RESPOSTA: JSON amb format:
{
  "accio": "enviar_email|pausar|saltar|finalitzar",
  "sequencia": "",
  "numero_email": 0,
  "data_programada": "",
  "idioma": "ca|es|eu",
  "personalitzacio": {}
}""",

    "alertes": """Ets l'Agent d'Alertes per a la campanya de consultoria digital.

OBJECTIU: Monitoritzar events i generar alertes per al consultor.

TRIGGERS D'ALERTA:
- CRÍTICA: Lead hot (score >80), Lead sol·licita reunió
- ALTA: Lead passa a SQL (score >60), Email resposta rebuda
- MITJANA: Lead passa a MQL (score >30), Registre webinar
- BAIXA: Nou lead capturat, Email obert

RESPOSTA: JSON amb format:
{
  "generar_alerta": true/false,
  "prioritat": "critica|alta|mitjana|baixa",
  "tipus": "",
  "missatge": "",
  "accio_recomanada": "",
  "notificar_email": true/false
}""",

    "documents": """Ets l'Agent de Documents Personalitzats per a la campanya.

OBJECTIU: Generar documents personalitzats per cada lead (diagnòstics, propostes).

TIPUS DE DOCUMENTS:
1. DIAGNÒSTIC: Informe personalitzat segons sector i mida empresa
2. PROPOSTA: Proposta comercial adaptada al lead
3. INFORME: Resum de seguiment periodic

REGLES:
- Generar en l'idioma preferit del lead
- Incloure dades específiques del lead
- Mantenir to professional però proper

RESPOSTA: JSON amb format:
{
  "tipus_document": "diagnostic|proposta|informe",
  "titol": "",
  "seccions": [],
  "idioma": "ca|es|eu",
  "personalitzacio": {},
  "enviar_per_email": true/false
}""",

    "seguiment": """Ets l'Agent de Seguiment per a la campanya de consultoria digital.

OBJECTIU: Monitoritzar leads i recomanar accions de seguiment.

REGLES:
- Leads sense interacció >7d → recomanar email de seguiment
- Leads sense interacció >14d → recomanar trucada
- Leads sense interacció >30d → marcar com inactiu
- Leads hot → seguiment cada 48h
- Leads SQL → seguiment cada 72h

RESPOSTA: JSON amb format:
{
  "accio_recomanada": "email|trucada|reunio|reactivacio|cap",
  "urgencia": "alta|mitjana|baixa",
  "missatge_suggerit": "",
  "dies_sense_interaccio": 0,
  "proxim_seguiment": ""
}""",

    "webinar": """Ets l'Agent de Webinars per a la campanya de consultoria digital.

OBJECTIU: Gestionar el cicle complet de webinars.

FASES:
1. PRE-WEBINAR: Emails recordatori (7d, 1d, 1h abans)
2. DURANT: Registre assistència
3. POST-WEBINAR: Email amb gravació + CTA consulta

RESPOSTA: JSON amb format:
{
  "accio": "enviar_recordatori|registrar_assistencia|enviar_gravacio",
  "fase": "pre|durant|post",
  "detalls": {},
  "leads_afectats": []
}""",

    "analytics": """Ets l'Agent d'Analytics per a la campanya de consultoria digital.

OBJECTIU: Generar informes d'analytics i KPIs.

MÈTRIQUES CLAU:
- Taxa captació, Taxa conversió per fase
- ROI per canal, Cost per lead
- Engagement emails (open rate, CTR)
- Pipeline valor total, Velocity
- Rendiment per idioma/zona

RESPOSTA: JSON amb format:
{
  "periode": "",
  "metriques": {},
  "tendencies": {},
  "recomanacions": [],
  "alertes_rendiment": []
}""",
}


# ─────────────────────────────────────────────────────────────────────────────
# MOTOR D'EXECUCIÓ
# ─────────────────────────────────────────────────────────────────────────────

class AgentEngine:
    """Motor per executar agents IA amb Claude API."""

    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY", "")
        )
        self.model = os.environ.get("AI_MODEL_AGENTS", "claude-sonnet-4-5-20250929")
        self.max_tokens = 2048

    def run_agent(
        self,
        agent_name: str,
        context: dict[str, Any],
        extra_instructions: str = "",
    ) -> dict:
        """
        Executa un agent amb el seu system prompt i context del CRM.

        Args:
            agent_name: Nom de l'agent (captacio, idioma, scoring, etc.)
            context: Dades del CRM rellevants per l'agent
            extra_instructions: Instruccions addicionals opcionals

        Returns:
            dict amb la resposta parsejada de l'agent
        """
        system_prompt = AGENT_PROMPTS.get(agent_name)
        if not system_prompt:
            return {"error": f"Agent '{agent_name}' no trobat"}

        # Construir missatge amb context
        user_message = f"""CONTEXT DEL CRM:
{json.dumps(context, indent=2, ensure_ascii=False, default=str)}

{f"INSTRUCCIONS ADDICIONALS: {extra_instructions}" if extra_instructions else ""}

Analitza el context i executa la teva tasca. Respon NOMÉS amb el JSON especificat."""

        start_time = time.time()
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )

            duration_ms = int((time.time() - start_time) * 1000)
            response_text = response.content[0].text

            # Parsejar JSON de la resposta
            try:
                # Intentar extreure JSON del text
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    result = json.loads(response_text[json_start:json_end])
                else:
                    result = {"raw_response": response_text}
            except json.JSONDecodeError:
                result = {"raw_response": response_text}

            return {
                "agent": agent_name,
                "result": result,
                "tokens_input": response.usage.input_tokens,
                "tokens_output": response.usage.output_tokens,
                "duration_ms": duration_ms,
                "success": True,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Error agent {agent_name}: {e}")
            return {
                "agent": agent_name,
                "result": {},
                "error": str(e),
                "duration_ms": duration_ms,
                "success": False,
                "timestamp": datetime.utcnow().isoformat(),
            }

    def run_pipeline(self, lead_data: dict) -> list[dict]:
        """
        Executa el pipeline complet d'agents per un lead.
        Ordre: captació → idioma → scoring → nurturing → alertes
        """
        results = []
        context = {"lead": lead_data}

        for agent_name in ["captacio", "idioma", "scoring", "nurturing", "alertes"]:
            result = self.run_agent(agent_name, context)
            results.append(result)

            # Enriquir context amb resultat de l'agent anterior
            if result.get("success"):
                context[f"result_{agent_name}"] = result["result"]

        return results
