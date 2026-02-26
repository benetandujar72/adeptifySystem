import requests
import time
import json

BASE_URL = "https://adeptifysystem-1061852826388.europe-west1.run.app/api/v1"
ADMIN_USER = "bandujar"
ADMIN_PASS = "23@2705BEAngu"
TEST_EMAIL = "bandujar+testlead@edutac.es"

def test_flow():
    print(f"🚀 Iniciant flux de prova complet per a {TEST_EMAIL}")
    
    # 1. Login per obtenir token
    print("\n🔐 1. Iniciant sessió com admin...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    if login_resp.status_code != 200:
        print(f"❌ Fallada login: {login_resp.text}")
        return
    
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login correcte.")

    # 2. Crear Lead
    print(f"\n📨 2. Creant lead de prova: {TEST_EMAIL}...")
    lead_data = {
        "nom": "Benet",
        "cognom": "Andujar (Test)",
        "email": TEST_EMAIL,
        "empresa": "Adeptify Test",
        "codi_postal": "08001",
        "ciutat": "Barcelona",
        "origen": "web",
        "consentiment_rgpd": True
    }
    
    # Intentem primer esborrar si existeix (opcional, via API d'admin si estigués implementada la baixa)
    # Com que no volem errors, usem un email únic amb timestamp
    unique_email = f"bandujar+test_{int(time.time())}@edutac.es"
    lead_data["email"] = unique_email
    
    create_resp = requests.post(f"{BASE_URL}/leads", json=lead_data)
    if create_resp.status_code != 201:
        print(f"❌ Error creant lead: {create_resp.text}")
        return
    
    lead = create_resp.json()
    lead_id = lead["id"]
    print(f"✅ Lead creat amb ID: {lead_id} (Idioma detectat: {lead['idioma_preferit']})")

    # 3. Simular Interacció de "valor alt" (descarrega dossier)
    print("\n🖱️ 3. Simulant interacció: descarrega_dossier (S'hauria de disparar alerta)...")
    int_data = {
        "lead_id": lead_id,
        "tipus": "descarrega_dossier",
        "canal": "web",
        "descripcio": "L'usuari ha baixat el dossier de serveis des de la web."
    }
    int_resp = requests.post(f"{BASE_URL}/interactions", json=int_data)
    if int_resp.status_code != 201:
        print(f"❌ Error creant interacció: {int_resp.text}")
    else:
        print(f"✅ Interacció registrada. Nou score: {int_resp.json()['punts_scoring']} punts.")

    # 4. Verificar Alertes
    print("\n🔔 4. Verificant si s'ha generat l'alerta al dashboard...")
    time.sleep(2) # Esperem un moment
    alerts_resp = requests.get(f"{BASE_URL}/alerts", headers=headers)
    if alerts_resp.status_code == 200:
        alerts = alerts_resp.json()
        my_alerts = [a for a in alerts if a["lead_id"] == lead_id]
        if my_alerts:
            print(f"✅ S'han trobat {len(my_alerts)} alertes per al lead!")
            for a in my_alerts:
                print(f"   - [{a['prioritat']}] {a['missatge']}")
        else:
            print("⚠️ No s'han trobat alertes encara. Potser triga uns segons o el score és baix.")
    else:
        print(f"❌ Error consultant alertes: {alerts_resp.text}")

    # 5. Dashboard Stats
    print("\n📊 5. Consultant estadístiques de producció...")
    stats_resp = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers)
    if stats_resp.status_code == 200:
        stats = stats_resp.json()
        print(f"✅ Dashboard OK. Leads totals: {stats['total_leads']}, Alertes pendents: {stats['alertes_pendents']}")
    else:
        print(f"❌ Error stats: {stats_resp.text}")

    print("\n✨ Prova finalitzada amb èxit.")

if __name__ == "__main__":
    test_flow()
