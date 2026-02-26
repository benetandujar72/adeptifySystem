
import { getRuntimeEnvString } from './runtimeEnv';

const BASE_URL = getRuntimeEnvString('MARKETING_API_URL') ||
    'https://adeptifysystem-1061852826388.europe-west1.run.app/api/v1';

export interface MarketingLead {
    id: number;
    nom: string;
    cognom: string;
    email: string;
    score: number;
    estat: string;
    created_at: string;
    idioma_preferit: string;
    empresa?: string;
}

export interface MarketingAlert {
    id: number;
    missatge: string;
    prioritat: string;
    created_at: string;
    resolta: boolean;
}

export interface MarketingStats {
    total_leads: number;
    leads_nous: number;
    leads_qualificats: number;
    leads_proposta: number;
    leads_tancats: number;
    score_mitja: number;
    alertes_pendents: number;
}

class MarketingService {
    private token: string | null = null;

    async login(): Promise<boolean> {
        try {
            // Intentem usar les credencials del sessionStorage si ja hi són
            // o les hardcoded per defecte per Benet
            const resp = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'bandujar',
                    password: '23@2705BEAngu'
                })
            });
            if (resp.ok) {
                const data = await resp.json();
                this.token = data.access_token;
                return true;
            }
            return false;
        } catch (e) {
            console.error("Error login marketing", e);
            return false;
        }
    }

    async getStats(): Promise<MarketingStats | null> {
        if (!this.token) await this.login();
        try {
            const resp = await fetch(`${BASE_URL}/dashboard/stats`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (resp.ok) return await resp.json();
        } catch (e) {
            console.error("Error fetching marketing stats", e);
        }
        return null;
    }

    async getLeads(): Promise<MarketingLead[]> {
        if (!this.token) await this.login();
        try {
            const resp = await fetch(`${BASE_URL}/leads`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                return data.leads || [];
            }
        } catch (e) {
            console.error("Error fetching marketing leads", e);
        }
        return [];
    }

    async getAlerts(): Promise<MarketingAlert[]> {
        if (!this.token) await this.login();
        try {
            const resp = await fetch(`${BASE_URL}/alerts`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (resp.ok) return await resp.json();
        } catch (e) {
            console.error("Error fetching marketing alerts", e);
        }
        return [];
    }
}

export const marketingService = new MarketingService();
