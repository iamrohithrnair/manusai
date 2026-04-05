import { and, desc, eq } from 'drizzle-orm';
import { contentAnalyses, manusTasks, researchNodes } from '@/lib/db/schema';

type AppDb = ReturnType<typeof import('@/lib/db/client').getDb>;

export type ContentResearchNode = {
  name: string;
  nodeType: string;
  content: string;
  metadataJson?: string | null;
  isOurCompany?: boolean | null;
  updatedAt?: number | null;
};

/**
 * Rich prompt pack: competitors, post examples, aggregated themes/gaps from content_analyses,
 * and excerpts from completed Manus research tasks — so drafts/plans use the graph + research runs.
 */
export function buildRichContentResearchContext(params: {
  nodes: ContentResearchNode[];
  contentAnalysis?: {
    summary: string;
    themesJson?: string | null;
    gapsJson?: string | null;
    topPostsJson?: string | null;
  } | null;
  completedResearchTasks?: Array<{ prompt: string; result: string | null }>;
  maxChars?: number;
}): string {
  const maxChars = params.maxChars ?? 14_000;
  const parts: string[] = [];

  parts.push(`### How to use this research pack
- **Competitors:** Infer what works in-market (themes, formats, hooks). Your output must **differentiate** our brand — never copy competitor copy verbatim.
- **Post examples:** Use as **signals** (length, tone, structure); adapt to our positioning and gaps.
- **Themes & gaps:** Prioritize ideas that exploit **gaps** and reinforce differentiation.
- **Completed research excerpts:** Raw Manus research output — use for facts, quotes, and nuance.`);

  const ca = params.contentAnalysis;
  if (ca) {
    let themes: string[] = [];
    let gaps: string[] = [];
    let topPosts: Array<{ text?: string; platform?: string; engagement?: number }> = [];
    try {
      themes = JSON.parse(ca.themesJson || '[]') as string[];
    } catch {
      /* ignore */
    }
    try {
      gaps = JSON.parse(ca.gapsJson || '[]') as string[];
    } catch {
      /* ignore */
    }
    try {
      topPosts = JSON.parse(ca.topPostsJson || '[]') as Array<{
        text?: string;
        platform?: string;
        engagement?: number;
      }>;
    } catch {
      /* ignore */
    }

    const aggLines = [
      ca.summary?.trim() && `**Landscape summary:** ${ca.summary.trim()}`,
      themes.length > 0 &&
        `**Cross-competitor themes:** ${themes.slice(0, 18).map((t) => t.trim()).filter(Boolean).join('; ')}`,
      gaps.length > 0 &&
        `**Gaps & opportunities (prioritize these for ideas):** ${gaps.slice(0, 18).map((g) => g.trim()).filter(Boolean).join('; ')}`,
      topPosts.length > 0 &&
        `**Sample competitor post snippets:** ${topPosts
          .slice(0, 6)
          .map((p) => (p.text || '').slice(0, 220).replace(/\s+/g, ' '))
          .filter(Boolean)
          .join(' … ')}`,
    ].filter(Boolean) as string[];

    if (aggLines.length > 0) {
      parts.push(`## Aggregated competitive intelligence (from research)\n${aggLines.join('\n\n')}`);
    }
  }

  const byType = (t: string) => params.nodes.filter((n) => n.nodeType === t);

  const competitors = byType('competitor');
  if (competitors.length > 0) {
    const blocks = competitors.map((c) => {
      const body = (c.content || '').trim().slice(0, 4000);
      return `#### ${c.name}\n${body}`;
    });
    parts.push(`## Competitors in the knowledge graph (${competitors.length})\n${blocks.join('\n\n')}`);
  }

  const posts = byType('post').sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (posts.length > 0) {
    const show = posts.slice(0, 28);
    const blocks = show.map((p) => {
      let meta = '';
      try {
        const m = p.metadataJson ? (JSON.parse(p.metadataJson) as Record<string, unknown>) : {};
        const platform = m.platform as string | undefined;
        const format = m.contentFormat as string | undefined;
        const eng = m.engagement as number | undefined;
        meta = [platform, format, eng != null ? `engagement ${eng}` : ''].filter(Boolean).join(' · ');
      } catch {
        /* ignore */
      }
      const body = (p.content || '').trim().slice(0, 1400);
      return `#### ${p.name}${meta ? ` _(${meta})_` : ''}\n${body}`;
    });
    parts.push(
      `## Competitor / market post examples (${posts.length} in graph; showing ${show.length})\n${blocks.join('\n\n')}`
    );
  }

  const ourCompany = params.nodes.filter((n) => n.nodeType === 'company' && n.isOurCompany);
  const otherCompany = params.nodes.filter((n) => n.nodeType === 'company' && !n.isOurCompany);
  const strategies = byType('content_strategy');
  const employees = byType('employee').slice(0, 14);

  const brandBlock = [...ourCompany, ...otherCompany]
    .map((n) => `#### ${n.name}\n${(n.content || '').trim().slice(0, 3500)}`)
    .join('\n\n');
  if (brandBlock) {
    parts.push(`## Company profile(s)\n${brandBlock}`);
  }

  if (strategies.length > 0) {
    const sb = strategies.map((s) => `#### ${s.name}\n${(s.content || '').slice(0, 3000)}`).join('\n\n');
    parts.push(`## Content strategies (from research)\n${sb}`);
  }

  if (employees.length > 0) {
    const eb = employees.map((e) => `#### ${e.name}\n${(e.content || '').slice(0, 1200)}`).join('\n\n');
    parts.push(`## Key people (for voice / attribution context)\n${eb}`);
  }

  const tasks = (params.completedResearchTasks || []).filter((t) => (t.result || '').trim().length > 0).slice(0, 3);
  for (const t of tasks) {
    const excerpt = (t.result || '').trim().slice(0, 5500);
    const promptBit = t.prompt.trim().slice(0, 500);
    parts.push(
      `## Completed Manus research run (excerpt)\n**Task prompt (truncated):** ${promptBit}${t.prompt.length > 500 ? '…' : ''}\n\n${excerpt}${(t.result || '').length > 5500 ? '\n\n…' : ''}`
    );
  }

  if (parts.length <= 1) {
    return 'No structured research yet. Run **Research** for this company to populate competitors, posts, and themes — then ask for content again.';
  }

  let out = parts.join('\n\n');
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars - 120)}\n\n[Research context truncated for length — prioritize sections at the top.]`;
  }
  return out;
}

/** Load graph rows, aggregated analysis, and latest completed research tasks for content prompts. */
export function buildContentResearchPack(db: AppDb, companyId: string, maxChars?: number): string {
  const nodes = db
    .select()
    .from(researchNodes)
    .where(eq(researchNodes.rootCompanyId, companyId))
    .all();

  const contentAnalysis = db.select().from(contentAnalyses).where(eq(contentAnalyses.companyId, companyId)).get();

  const researchTasks = db
    .select({ prompt: manusTasks.prompt, result: manusTasks.result })
    .from(manusTasks)
    .where(
      and(
        eq(manusTasks.companyId, companyId),
        eq(manusTasks.type, 'research'),
        eq(manusTasks.status, 'completed')
      )
    )
    .orderBy(desc(manusTasks.completedAt))
    .limit(3)
    .all();

  return buildRichContentResearchContext({
    nodes: nodes.map((n) => ({
      name: n.name,
      nodeType: n.nodeType,
      content: n.content || '',
      metadataJson: n.metadataJson,
      isOurCompany: n.isOurCompany,
      updatedAt: n.updatedAt,
    })),
    contentAnalysis: contentAnalysis ?? null,
    completedResearchTasks: researchTasks.map((t) => ({ prompt: t.prompt, result: t.result })),
    maxChars,
  });
}
