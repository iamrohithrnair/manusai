import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { contentPlans, planItems, voiceProfiles } from '@/lib/db/schema';

const PLATFORMS = ['linkedin', 'instagram', 'blog', 'linkedin', 'instagram', 'blog', 'other'] as const;

function topicsFromBrief(brief: string): string[] {
  const t = brief.trim();
  if (!t) return [];
  const chunks = t
    .split(/[\n;]+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 400);
  const out = [...new Set(chunks)];
  return out.slice(0, 8);
}

const DEFAULT_TOPICS = [
  'Brand positioning & POV (thought leadership)',
  'Customer story or proof point',
  'Educational insight for our audience',
  'Product or launch moment',
  'Industry trend + our take',
];

/**
 * Adds **planned** pipeline rows from the saved voice profile (`contentBrief`), or sensible defaults.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await connectDB();
  const db = getDb();

  const plan = db.select().from(contentPlans).where(eq(contentPlans.id, planId)).get();
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  const voice = db.select().from(voiceProfiles).where(eq(voiceProfiles.companyId, plan.companyId)).get();
  const brief = voice?.contentBrief?.trim() || '';

  let topics = topicsFromBrief(brief);
  if (topics.length === 0) {
    topics = [...DEFAULT_TOPICS];
  }

  const t = Date.now();
  const added: string[] = [];
  topics.forEach((topic, i) => {
    const id = randomUUID();
    const platform = PLATFORMS[i % PLATFORMS.length];
    db.insert(planItems)
      .values({
        id,
        planId,
        topic,
        platform,
        contentType: 'text_post',
        status: 'planned',
        createdAt: t,
        updatedAt: t,
      })
      .run();
    added.push(id);
  });

  db.update(contentPlans).set({ updatedAt: t }).where(eq(contentPlans.id, planId)).run();

  return NextResponse.json({
    ok: true,
    added: added.length,
    message: `Added ${added.length} items to your plan (planned). Use **Generate drafts** when ready.`,
  });
}
