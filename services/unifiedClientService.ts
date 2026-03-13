import { supabase } from './supabaseClient';

/* ================================================================
   Unified Client Service
   Bridges leads, cat_education_centers, consultations, interactions,
   notes, and artifacts into a single client view.
   ================================================================ */

export interface UnifiedClient {
  lead_id: string;
  tenant_slug: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  lead_status: string;
  source: string | null;
  tags: string[] | null;
  ai_needs_analysis: any;
  codi_centre_ref: string | null;
  campaign_id: string | null;
  region: string | null;
  pais: string | null;
  open_count: number | null;
  click_count: number | null;
  conversion_score: number | null;
  last_contacted_at: string | null;
  nurturing_stage: string | null;
  lead_created_at: string;
  lead_updated_at: string;
  // Center fields
  center_name: string | null;
  center_type: string | null;
  center_municipi: string | null;
  center_comarca: string | null;
  center_address: string | null;
  center_postal: string | null;
  center_phone: string | null;
  center_email: string | null;
  center_web: string | null;
  center_lon: number | null;
  center_lat: number | null;
  ai_opportunity_score: number | null;
  ai_custom_pitch: string | null;
  ai_reason_similarity: string | null;
  vikor_s: number | null;
  vikor_r: number | null;
  vikor_q: number | null;
  vikor_rank: number | null;
  // Aggregates
  interaction_count: number;
  consultation_count: number;
  last_interaction_at: string | null;
  display_name: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  interaction_type: string;
  content_summary: string | null;
  payload_json: any;
  metadata_json: any;
  created_at: string;
}

export interface CrmNote {
  id: string;
  lead_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface ClientDetail {
  client: UnifiedClient;
  interactions: LeadInteraction[];
  notes: CrmNote[];
  consultations: any[];
  artifacts: any[];
}

const PAGE_SIZE = 200;

export const unifiedClientService = {

  /**
   * Fetch all clients with activity (leads), ordered by most recent.
   * Uses the v_unified_clients SQL view.
   */
  fetchActiveClients: async (tenantSlug?: string): Promise<UnifiedClient[]> => {
    if (!supabase) return [];

    try {
      let query = supabase
        .from('v_unified_clients')
        .select('*')
        .order('lead_updated_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (tenantSlug) {
        query = query.eq('tenant_slug', tenantSlug);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching unified clients:', error.message);
        // Fallback: query leads table directly if view doesn't exist yet
        return unifiedClientService._fallbackFetchLeads(tenantSlug);
      }
      return (data ?? []) as UnifiedClient[];
    } catch (e) {
      console.error('Error in fetchActiveClients:', e);
      return [];
    }
  },

  /**
   * Search clients by name, email, or municipality.
   */
  searchClients: async (query: string, tenantSlug?: string): Promise<UnifiedClient[]> => {
    if (!supabase || !query.trim()) return [];

    try {
      const q = query.trim().toLowerCase();
      // Supabase doesn't support OR on views easily, so we do an ilike on display_name
      let sb = supabase
        .from('v_unified_clients')
        .select('*')
        .or(`display_name.ilike.%${q}%,email.ilike.%${q}%,center_municipi.ilike.%${q}%`)
        .order('lead_updated_at', { ascending: false })
        .limit(50);

      if (tenantSlug) {
        sb = sb.eq('tenant_slug', tenantSlug);
      }

      const { data, error } = await sb;
      if (error) {
        console.error('Error searching clients:', error.message);
        return [];
      }
      return (data ?? []) as UnifiedClient[];
    } catch (e) {
      console.error('Error in searchClients:', e);
      return [];
    }
  },

  /**
   * Fetch full detail for a single client by lead_id.
   * Returns the client record plus all interactions, notes, consultations, artifacts.
   */
  fetchClientDetail: async (leadId: string): Promise<ClientDetail | null> => {
    if (!supabase) return null;

    try {
      // 1. Get the client record
      const { data: clientData, error: clientErr } = await supabase
        .from('v_unified_clients')
        .select('*')
        .eq('lead_id', leadId)
        .single();

      if (clientErr || !clientData) {
        // Fallback: try fetching lead directly
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .single();
        if (!lead) return null;
        // Build minimal client
        const minimalClient: UnifiedClient = {
          lead_id: lead.id,
          tenant_slug: lead.tenant_slug,
          email: lead.email,
          full_name: lead.full_name,
          company_name: lead.company_name,
          phone: lead.phone,
          lead_status: lead.status,
          source: lead.source,
          tags: lead.tags,
          ai_needs_analysis: lead.ai_needs_analysis,
          codi_centre_ref: lead.codi_centre_ref,
          campaign_id: lead.campaign_id,
          region: lead.region,
          pais: lead.pais,
          open_count: lead.open_count,
          click_count: lead.click_count,
          conversion_score: lead.conversion_score,
          last_contacted_at: lead.last_contacted_at,
          nurturing_stage: lead.nurturing_stage,
          lead_created_at: lead.created_at,
          lead_updated_at: lead.updated_at,
          center_name: null, center_type: null, center_municipi: null,
          center_comarca: null, center_address: null, center_postal: null,
          center_phone: null, center_email: null, center_web: null,
          center_lon: null, center_lat: null,
          ai_opportunity_score: null, ai_custom_pitch: null, ai_reason_similarity: null,
          vikor_s: null, vikor_r: null, vikor_q: null, vikor_rank: null,
          interaction_count: 0, consultation_count: 0, last_interaction_at: null,
          display_name: lead.company_name || lead.email,
        };
        return {
          client: minimalClient,
          interactions: [],
          notes: [],
          consultations: [],
          artifacts: [],
        };
      }

      const client = clientData as UnifiedClient;

      // 2. Fetch related data in parallel
      const [interactionsRes, notesRes, consultationsRes, artifactsRes] = await Promise.all([
        supabase
          .from('lead_interactions')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('crm_notes')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(50),
        // Match consultations by email
        supabase
          .from('consultations')
          .select('*')
          .ilike('contact_email', client.email)
          .order('created_at', { ascending: false })
          .limit(50),
        // Match artifacts by center key (codi_centre_ref or normalized name)
        client.codi_centre_ref
          ? supabase
              .from('center_artifacts')
              .select('*')
              .eq('center_key', client.codi_centre_ref)
              .order('created_at', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
      ]);

      return {
        client,
        interactions: (interactionsRes.data ?? []) as LeadInteraction[],
        notes: (notesRes.data ?? []) as CrmNote[],
        consultations: consultationsRes.data ?? [],
        artifacts: artifactsRes.data ?? [],
      };
    } catch (e) {
      console.error('Error in fetchClientDetail:', e);
      return null;
    }
  },

  /**
   * Fallback: if the v_unified_clients view doesn't exist yet,
   * query leads directly and build compatible objects.
   */
  _fallbackFetchLeads: async (tenantSlug?: string): Promise<UnifiedClient[]> => {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (tenantSlug) {
        query = query.eq('tenant_slug', tenantSlug);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Fallback leads query error:', error.message);
        return [];
      }

      return (data ?? []).map((l: any) => ({
        lead_id: l.id,
        tenant_slug: l.tenant_slug,
        email: l.email,
        full_name: l.full_name,
        company_name: l.company_name,
        phone: l.phone,
        lead_status: l.status,
        source: l.source,
        tags: l.tags,
        ai_needs_analysis: l.ai_needs_analysis,
        codi_centre_ref: l.codi_centre_ref,
        campaign_id: l.campaign_id,
        region: l.region ?? 'Catalunya',
        pais: l.pais ?? 'ES-CT',
        open_count: l.open_count ?? 0,
        click_count: l.click_count ?? 0,
        conversion_score: l.conversion_score ?? 0,
        last_contacted_at: l.last_contacted_at,
        nurturing_stage: l.nurturing_stage,
        lead_created_at: l.created_at,
        lead_updated_at: l.updated_at,
        center_name: null,
        center_type: null,
        center_municipi: null,
        center_comarca: null,
        center_address: null,
        center_postal: null,
        center_phone: null,
        center_email: null,
        center_web: null,
        center_lon: null,
        center_lat: null,
        ai_opportunity_score: null,
        ai_custom_pitch: null,
        ai_reason_similarity: null,
        vikor_s: null,
        vikor_r: null,
        vikor_q: null,
        vikor_rank: null,
        interaction_count: 0,
        consultation_count: 0,
        last_interaction_at: null,
        display_name: l.company_name || l.email,
      }));
    } catch (e) {
      console.error('Fallback error:', e);
      return [];
    }
  },
};
