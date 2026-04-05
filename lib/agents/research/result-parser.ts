import { z } from 'zod';

const ContentStrategySchema = z.object({
  themes: z.array(z.string()).default([]),
  postingFrequency: z.string().optional(),
  platformBreakdown: z.record(z.string(), z.string()).optional(),
  formatMix: z.record(z.string(), z.string()).optional(),
  avgEngagement: z.number().optional(),
  gaps: z.array(z.string()).default([]),
  summary: z.string().optional(),
});

/** Manus often omits `text` or uses `content` / numeric engagement as strings. */
const TopPostSchema = z.object({
  authorName: z.string().optional(),
  text: z.union([z.string(), z.number()]).optional().transform((v) => (v == null ? '' : String(v))),
  platform: z.string().optional(),
  format: z.string().optional(),
  likes: z.union([z.number(), z.string()]).optional().transform((v) => (typeof v === 'string' ? Number(v) || undefined : v)),
  comments: z.union([z.number(), z.string()]).optional().transform((v) => (typeof v === 'string' ? Number(v) || undefined : v)),
  shares: z.union([z.number(), z.string()]).optional().transform((v) => (typeof v === 'string' ? Number(v) || undefined : v)),
  whyItWorked: z.string().optional(),
});

const EmployeeSchema = z.object({
  name: z.union([z.string(), z.number()]).transform((v) => String(v).trim() || 'Unknown'),
  title: z.string().optional(),
  linkedinUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
});

const CompetitorSchema = z.object({
  name: z.union([z.string(), z.number()]).transform((v) => String(v).trim() || 'Unknown'),
  industry: z.string().optional(),
  linkedinUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  employees: z.array(EmployeeSchema).default([]),
  topPosts: z.array(TopPostSchema).default([]),
  contentStrategy: ContentStrategySchema.optional(),
});

const CompanyBlockSchema = z.object({
  name: z.union([z.string(), z.number()]).transform((v) => String(v).trim() || 'Unknown'),
  industry: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  linkedinFollowers: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v == null) return undefined;
    if (typeof v === 'number') return v;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }),
  instagramFollowers: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v == null) return undefined;
    if (typeof v === 'number') return v;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }),
  contentSummary: z.string().optional(),
});

export const ResearchResultSchema = z.object({
  company: CompanyBlockSchema,
  competitors: z.array(CompetitorSchema).default([]),
});

export type ResearchResultParsed = z.infer<typeof ResearchResultSchema>;

/** Extract first top-level JSON object starting at `start` (quote-aware brace matching). */
export function extractBalancedJsonObject(text: string, start = 0): string | null {
  const i0 = text.indexOf('{', start);
  if (i0 < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = i0; i < text.length; i++) {
    const c = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\' && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(i0, i + 1);
    }
  }
  return null;
}

/**
 * Collect JSON strings to try: fenced ```json``` blocks (last block first — often the final answer),
 * then balanced `{...}` slices from each `{` that looks like the research payload.
 */
export function extractJsonCandidates(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (s: string | null | undefined) => {
    const t = s?.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    if (m[1]?.trim()) blocks.push(m[1].trim());
  }
  for (let i = blocks.length - 1; i >= 0; i--) push(blocks[i]);

  let pos = 0;
  while (pos < text.length) {
    const slice = extractBalancedJsonObject(text, pos);
    if (!slice) break;
    if (slice.includes('"company"') && (slice.includes('"competitors"') || slice.includes('"competitor"'))) {
      push(slice);
    }
    pos = text.indexOf('{', pos + 1);
    if (pos < 0) break;
  }

  const fallback = extractBalancedJsonObject(text, 0);
  if (fallback) push(fallback);

  return out;
}

/** @deprecated Prefer extractJsonCandidates */
export function extractJsonFromManusText(text: string): string | null {
  const c = extractJsonCandidates(text);
  return c[0] ?? null;
}

/** Map common Manus shape drift into something Zod can accept. */
function normalizeResearchPayload(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const j = input as Record<string, unknown>;

  let company = j.company;
  if (!company || typeof company !== 'object') {
    company = { name: 'Unknown company' };
  } else {
    const c = company as Record<string, unknown>;
    if (c.name == null || String(c.name).trim() === '') c.name = 'Unknown company';
  }
  j.company = company;

  let comps = j.competitors;
  if (!Array.isArray(comps)) {
    const alt = j.competitor;
    comps = Array.isArray(alt) ? alt : typeof alt === 'object' && alt ? [alt] : [];
  }
  j.competitors = (comps as unknown[]).map((comp) => {
    if (!comp || typeof comp !== 'object') return { name: 'Unknown', employees: [], topPosts: [] };
    const c = comp as Record<string, unknown>;
    if (c.name == null || String(c.name).trim() === '') c.name = 'Unknown';
    if (!Array.isArray(c.employees)) c.employees = [];
    else {
      c.employees = (c.employees as unknown[]).filter((e) => e && typeof e === 'object' && (e as Record<string, unknown>).name != null);
    }
    if (!Array.isArray(c.topPosts)) c.topPosts = [];
    else {
      c.topPosts = (c.topPosts as unknown[]).map((p) => {
        if (!p || typeof p !== 'object') return { text: '' };
        const pp = p as Record<string, unknown>;
        const txt = pp.text ?? pp.content ?? pp.body ?? pp.excerpt ?? pp.summary ?? '';
        return { ...pp, text: txt };
      });
    }
    return c;
  });

  return j;
}

export function parseResearchResult(text: string): ResearchResultParsed | null {
  const candidates = extractJsonCandidates(text);
  for (const raw of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const tryParse = (obj: unknown) => {
      const direct = ResearchResultSchema.safeParse(obj);
      if (direct.success) return direct.data;
      const norm = normalizeResearchPayload(obj);
      const second = ResearchResultSchema.safeParse(norm);
      return second.success ? second.data : null;
    };
    const result = tryParse(parsed);
    if (result) return result;
  }
  return null;
}
