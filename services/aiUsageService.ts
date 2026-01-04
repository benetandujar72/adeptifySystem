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

const STORAGE_KEY = 'adeptify_ai_usage_log_v1';

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function readAll(): AiUsageEntry[] {
  if (typeof window === 'undefined') return [];
  return safeParseJson<AiUsageEntry[]>(localStorage.getItem(STORAGE_KEY), []).filter(Boolean);
}

function writeAll(entries: AiUsageEntry[]) {
  safeWriteJson(STORAGE_KEY, entries);
}

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

  // If we don't have a split, do not guess.
  if (!inT && !outT) return undefined;

  const cost =
    (inT && eurPer1MInput ? (inT / 1_000_000) * eurPer1MInput : 0) +
    (outT && eurPer1MOutput ? (outT / 1_000_000) * eurPer1MOutput : 0);

  return round4(cost);
}

export const aiUsageService = {
  recordGeminiUsage: (args: {
    model: string;
    purpose?: AiUsagePurpose;
    usageMetadata?: GeminiUsageMetadataLike;
    eurPer1MInput?: number;
    eurPer1MOutput?: number;
  }): AiUsageEntry => {
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

    const all = readAll();
    all.push(entry);

    // Keep last N to prevent unbounded growth.
    const MAX = 2000;
    const trimmed = all.length > MAX ? all.slice(all.length - MAX) : all;
    writeAll(trimmed);

    return entry;
  },

  list: (limit = 200): AiUsageEntry[] => {
    const all = readAll();
    return all.slice(Math.max(0, all.length - limit));
  },

  totals: (): {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    costEur: number;
    count: number;
  } => {
    const all = readAll();
    let promptTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let costEur = 0;
    for (const e of all) {
      if (typeof e.promptTokens === 'number') promptTokens += e.promptTokens;
      if (typeof e.outputTokens === 'number') outputTokens += e.outputTokens;
      if (typeof e.totalTokens === 'number') totalTokens += e.totalTokens;
      if (typeof e.costEur === 'number') costEur += e.costEur;
    }
    return {
      promptTokens,
      outputTokens,
      totalTokens,
      costEur: round4(costEur),
      count: all.length,
    };
  },

  clear: () => {
    writeAll([]);
  },

  exportJson: () => {
    const all = readAll();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adeptify_ai_usage_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
