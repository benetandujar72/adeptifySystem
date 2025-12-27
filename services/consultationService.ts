
import { Consultation, DiagnosisState, ProposalData, ChatMessage } from '../types';
import { supabase } from './supabaseClient';

const LOCAL_STORAGE_KEY = 'adeptify_fallback_consultations';
const LOCAL_CHAT_KEY = 'adeptify_fallback_chats';

const normalizeCenterKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * CONSULTATION SERVICE - HÍBRID (Supabase Cloud + LocalStorage Redundancy)
 */
export const consultationService = {
  
  saveConsultation: async (diagnosis: DiagnosisState, proposal: ProposalData, tenantSlug?: string): Promise<Consultation> => {
    const consultationId = `CONS-${Date.now()}`;

    const normalizedProposal: ProposalData = {
      ...proposal,
      meta: {
        ...(proposal?.meta || {}),
        generatedAt: proposal?.meta?.generatedAt || new Date().toISOString(),
      },
    };

    const newConsultation: Consultation = {
      ...diagnosis,
      tenantSlug: tenantSlug ?? diagnosis.tenantSlug,
      id: consultationId,
      date: new Date().toISOString(),
      proposal: normalizedProposal
    };

    if (supabase) {
      const baseRow: Record<string, any> = {
        id: consultationId,
        center_name: diagnosis.centerName,
        center_key: normalizeCenterKey(diagnosis.centerName || ''),
        contact_email: diagnosis.contactEmail,
        contact_name: diagnosis.contactName ?? null,
        product_type: diagnosis.selectedProduct,
        audit_history: diagnosis.consultationHistory,
        proposal_data: normalizedProposal,
      };

      const rowWithTenant = {
        ...baseRow,
        tenant_slug: tenantSlug ?? diagnosis.tenantSlug ?? null,
      };

      let { error } = await supabase.from('consultations').insert([rowWithTenant]);

      // Backward-compat: if production schema is not yet migrated, retry without tenant_slug.
      if (error && typeof error.message === 'string' && error.message.toLowerCase().includes('tenant_slug')) {
        ({ error } = await supabase.from('consultations').insert([baseRow]));
      }

      if (!error) {
        console.log(`ÈXIT: Consulta ${consultationId} persistida al núvol.`);
        return newConsultation;
      }
      
      console.error("ERROR SUPABASE:", error.message);
      console.warn("Activant redundància local per fallada de sincronització.");
    }

    // Fallback a LocalStorage
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      existing.push(newConsultation);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
      return newConsultation;
    } catch (localError) {
      console.error("Error crític en el motor de persistència local:", localError);
      return newConsultation;
    }
  },

  getAll: async (tenantSlug?: string): Promise<Consultation[]> => {
    if (supabase) {
      try {
        const query = supabase
          .from('consultations')
          .select('*')
          .order('created_at', { ascending: false });

        let data: any = null;
        let error: any = null;

        if (tenantSlug) {
          ({ data, error } = await query.eq('tenant_slug', tenantSlug));
          // Backward-compat: if tenant_slug column doesn't exist, retry unscoped.
          if (error && typeof error.message === 'string' && error.message.toLowerCase().includes('tenant_slug')) {
            ({ data, error } = await query);
          }
        } else {
          ({ data, error } = await query);
        }

        if (!error && data) {
          return data.map(dbItem => ({
            id: dbItem.id,
            tenantSlug: dbItem.tenant_slug ?? undefined,
            centerName: dbItem.center_name,
            contactName: dbItem.contact_name ?? undefined,
            contactEmail: dbItem.contact_email,
            selectedProduct: dbItem.product_type,
            consultationHistory: Array.isArray(dbItem.audit_history)
              ? dbItem.audit_history.map((h: any) => ({
                  question: String(h?.question ?? ''),
                  answer: Array.isArray(h?.answer)
                    ? h.answer.map((x: any) => String(x))
                    : [String(h?.answer ?? '')].filter(Boolean),
                }))
              : [],
            proposal: dbItem.proposal_data,
            date: dbItem.created_at
          }));
        } else if (error) {
          console.error("ERROR EN RECUPERACIÓ NÚVOL:", error.message);
        }
      } catch (e) {
        console.error("Error de xarxa en accedir a Supabase.");
      }
    }

    // Fallback LocalStorage
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const all = Array.isArray(raw)
        ? raw.map((c: any) => ({
            ...c,
            consultationHistory: Array.isArray(c?.consultationHistory)
              ? c.consultationHistory.map((h: any) => ({
                  question: String(h?.question ?? ''),
                  answer: Array.isArray(h?.answer)
                    ? h.answer.map((x: any) => String(x))
                    : [String(h?.answer ?? '')].filter(Boolean),
                }))
              : [],
          }))
        : [];

      if (!tenantSlug) return all;
      return all.filter((c: any) => String(c?.tenantSlug ?? '').toLowerCase() === tenantSlug.toLowerCase());
    } catch {
      return [];
    }
  },

  getChatHistory: async (centerId: string): Promise<ChatMessage[]> => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('center_id', centerId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map(msg => ({
            role: msg.role as 'user' | 'model',
            text: msg.content,
            timestamp: msg.created_at
          }));
        }
      } catch (e) {
        console.error("Error recuperant historial de xat del núvol.");
      }
    }

    const localChats = JSON.parse(localStorage.getItem(LOCAL_CHAT_KEY) || '{}');
    return localChats[centerId] || [];
  },

  saveChatMessage: async (centerId: string, message: ChatMessage) => {
    // Normalitzem centerId per evitar errors de referència
    const id = centerId || 'general';

    if (supabase) {
      try {
        const { error } = await supabase
          .from('chat_messages')
          .insert([{
            center_id: id,
            role: message.role,
            content: message.text
          }]);
        
        if (!error) return;
        console.error("Error guardant missatge al núvol:", error.message);
      } catch (e) {
        console.error("Error de xarxa en guardar missatge.");
      }
    }

    const localChats = JSON.parse(localStorage.getItem(LOCAL_CHAT_KEY) || '{}');
    if (!localChats[id]) localChats[id] = [];
    localChats[id].push(message);
    localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(localChats));
  }
};
