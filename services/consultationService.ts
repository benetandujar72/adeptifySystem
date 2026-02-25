import { Consultation, DiagnosisState, ProposalData, ChatMessage } from '../types';
import { supabase } from './supabaseClient';

const normalizeCenterKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * CONSULTATION SERVICE - DIRECT DB ONLY
 */
export const consultationService = {

  saveConsultation: async (diagnosis: DiagnosisState, proposal: ProposalData, tenantSlug?: string): Promise<Consultation> => {
    const consultationId = `CONS-${Date.now()}`;

    if (!supabase) {
      throw new Error('La conexión a la base de datos no está disponible. No se puede guardar la consulta.');
    }

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

    try {
      let { error } = await supabase.from('consultations').insert([rowWithTenant]);

      // Backward-compat: if production schema is not yet migrated, retry without tenant_slug.
      if (error && typeof error.message === 'string' && error.message.toLowerCase().includes('tenant_slug')) {
        ({ error } = await supabase.from('consultations').insert([baseRow]));
      }

      if (error) throw error;

      console.log(`ÈXIT: Consulta ${consultationId} persistida al núvol.`);
      return newConsultation;
    } catch (error: any) {
      console.error("ERROR SUPABASE:", error.message);
      throw new Error(`Error crítico al guardar la consulta en la base de datos: ${error.message}`);
    }
  },

  getAll: async (tenantSlug?: string): Promise<Consultation[]> => {
    if (!supabase) {
      console.error('La conexión a la base de datos no está disponible.');
      return [];
    }

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

      if (error) throw error;

      if (data) {
        return data.map((dbItem: any) => ({
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
      }
      return [];
    } catch (error: any) {
      console.error("ERROR EN RECUPERACIÓ NÚVOL:", error.message);
      return [];
    }
  },

  getChatHistory: async (centerId: string): Promise<ChatMessage[]> => {
    if (!supabase) {
      console.error('La conexión a la base de datos no está disponible.');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('center_id', centerId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        return data.map(msg => ({
          role: msg.role as 'user' | 'model',
          text: msg.content,
          timestamp: msg.created_at
        }));
      }
      return [];
    } catch (e: any) {
      console.error("Error recuperant historial de xat del núvol:", e.message);
      return [];
    }
  },

  saveChatMessage: async (centerId: string, message: ChatMessage) => {
    if (!supabase) {
      throw new Error('La conexión a la base de datos no está disponible. No se pudo guardar el chat.');
    }

    // Normalitzem centerId per evitar errors de referència
    const id = centerId || 'general';

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          center_id: id,
          role: message.role,
          content: message.text
        }]);

      if (error) throw error;
    } catch (e: any) {
      console.error("Error guardant missatge al núvol:", e.message);
      throw new Error(`Error en guardar missatge: ${e.message}`);
    }
  }
};
