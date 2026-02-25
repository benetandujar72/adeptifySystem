import { supabase } from './supabaseClient';

export type AiUsagePurpose =
  | 'dynamic_question'
  | 'proposal'
  | 'chat'
  | 'official_document'
  | 'tasks_intelligence'
  | 'dafo'
  | 'center_report'
  | 'custom_proposal'
  | 'other';

export type AiUsageEntry = {
  id: string;
  createdAt: string;
  provider: 'gemini';
  model: string;
  purpose: AiUsagePurpose;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costEur?: number;
};

type GeminiUsageMetadataLike = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `u-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function computeCostEur(opts: {
  promptTokens?: number;
  outputTokens?: number;
  eurPer1MInput?: number;
  eurPer1MOutput?: number;
}): number | undefined {
  const { promptTokens, outputTokens, eurPer1MInput, eurPer1MOutput } = opts;
  if (!eurPer1MInput && !eurPer1MOutput) return undefined;

  const inT = typeof promptTokens === 'number' && Number.isFinite(promptTokens) ? promptTokens : undefined;
  const outT = typeof outputTokens === 'number' && Number.isFinite(outputTokens) ? outputTokens : undefined;

  if (!inT && !outT) return undefined;

  const cost =
    (inT && eurPer1MInput ? (inT / 1_000_000) * eurPer1MInput : 0) +
    (outT && eurPer1MOutput ? (outT / 1_000_000) * eurPer1MOutput : 0);

  return round4(cost);
}

export const aiUsageService = {
  recordGeminiUsage: async (args: {
    model: string;
    purpose?: AiUsagePurpose;
    usageMetadata?: GeminiUsageMetadataLike;
    eurPer1MInput?: number;
    eurPer1MOutput?: number;
  }): Promise<AiUsageEntry> => {
    const promptTokens = args.usageMetadata?.promptTokenCount;
    const outputTokens = args.usageMetadata?.candidatesTokenCount;
    const totalTokens = args.usageMetadata?.totalTokenCount;

    const entry: AiUsageEntry = {
      id: uuid(),
      createdAt: new Date().toISOString(),
      provider: 'gemini',
      model: args.model,
      purpose: args.purpose || 'other',
      promptTokens: typeof promptTokens === 'number' ? promptTokens : undefined,
      outputTokens: typeof outputTokens === 'number' ? outputTokens : undefined,
      totalTokens: typeof totalTokens === 'number' ? totalTokens : undefined,
      costEur: computeCostEur({
        promptTokens: typeof promptTokens === 'number' ? promptTokens : undefined,
        outputTokens: typeof outputTokens === 'number' ? outputTokens : undefined,
        eurPer1MInput: args.eurPer1MInput,
        eurPer1MOutput: args.eurPer1MOutput,
      }),
    };

    if (!supabase) {
      console.error('Supabase client not available. Cannot log AI usage.');
      return entry;
    }

    try {
      const { error } = await supabase.from('ai_usage_logs').insert([{
        id: entry.id,
        created_at: entry.createdAt,
        provider: entry.provider,
        model: entry.model,
        purpose: entry.purpose,
        prompt_tokens: entry.promptTokens ?? null,
        output_tokens: entry.outputTokens ?? null,
        total_tokens: entry.totalTokens ?? null,
        cost_eur: entry.costEur ?? null,
      }]);

      if (error) {
        console.error('Error recording AI usage to Supabase:', error.message);
      }
    } catch (e: any) {
      console.error('Network error recording AI usage:', e.message);
    }

    return entry;
  },

  list: async (limit = 200): Promise<AiUsageEntry[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (data) {
        return data.map(dbItem => ({
          id: dbItem.id,
          createdAt: dbItem.created_at,
          provider: dbItem.provider as 'gemini',
          model: dbItem.model,
          purpose: dbItem.purpose as AiUsagePurpose,
          promptTokens: dbItem.prompt_tokens ?? undefined,
          outputTokens: dbItem.output_tokens ?? undefined,
          totalTokens: dbItem.total_tokens ?? undefined,
          costEur: dbItem.cost_eur ?? undefined
        }));
      }
      return [];
    } catch (e: any) {
      console.error('Error loading AI usage list:', e.message);
      return [];
    }
  },

  totals: async (): Promise<{
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    costEur: number;
    count: number;
  }> => {
    if (!supabase) {
      return { promptTokens: 0, outputTokens: 0, totalTokens: 0, costEur: 0, count: 0 };
    }

    try {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('prompt_tokens, output_tokens, total_tokens, cost_eur');

      if (error) throw error;

      let promptTokens = 0;
      let outputTokens = 0;
      let totalTokens = 0;
      let costEur = 0;
      let count = 0;

      if (data) {
        count = data.length;
        for (const e of data) {
          if (typeof e.prompt_tokens === 'number') promptTokens += e.prompt_tokens;
          if (typeof e.output_tokens === 'number') outputTokens += e.output_tokens;
          if (typeof e.total_tokens === 'number') totalTokens += e.total_tokens;
          if (typeof e.cost_eur === 'number') costEur += e.cost_eur;
        }
      }

      return {
        promptTokens,
        outputTokens,
        totalTokens,
        costEur: round4(costEur),
        count,
      };
    } catch (e: any) {
      console.error('Error calculating AI usage totals:', e.message);
      return { promptTokens: 0, outputTokens: 0, totalTokens: 0, costEur: 0, count: 0 };
    }
  },

  clear: async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('ai_usage_logs')
        .delete()
        .neq('id', 'placeholder__delete_all');

      if (error) throw error;
      console.log('AI usage logs cleared.');
    } catch (e: any) {
      console.error('Error clearing AI usage logs:', e.message);
    }
  },

  exportJson: async () => {
    const list = await aiUsageService.list(10000);
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adeptify_ai_usage_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
