import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { contentItems, contentPlans, planItems, voiceProfiles } from '@/lib/db/schema';
import { buildContentResearchPack } from '@/lib/agents/content/research-context';
import { buildContentSystemPrompt, buildVoiceProfileBlock } from '@/lib/agents/content/system-prompt';
import type { VoiceProfileLike } from '@/lib/types/voice';
import { createTask, pollUntilComplete, extractAssistantText } from '@/lib/manus-client';

export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  await connectDB();
  const db = getDb();

  const plan = db.select().from(contentPlans).where(eq(contentPlans.id, planId)).get();
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  const items = db
    .select()
    .from(planItems)
    .where(eq(planItems.planId, planId))
    .all()
    .filter((i) => i.status === 'planned');

  if (items.length === 0) {
    return NextResponse.json({ error: 'No planned items to generate' }, { status: 400 });
  }

  const researchContext = buildContentResearchPack(db, plan.companyId, 16_000);

  const voiceRow = db.select().from(voiceProfiles).where(eq(voiceProfiles.companyId, plan.companyId)).get();
  const voice: VoiceProfileLike | null = voiceRow
    ? {
        toneDescription: voiceRow.toneDescription,
        styleNotes: voiceRow.styleNotes,
        keyPhrases: JSON.parse(voiceRow.keyPhrasesJson || '[]'),
        personality: voiceRow.personality,
        contentBrief: voiceRow.contentBrief,
      }
    : null;
  const voiceBlock = buildVoiceProfileBlock(voice);

  const t = Date.now();
  db.update(contentPlans).set({ status: 'active', updatedAt: t }).where(eq(contentPlans.id, planId)).run();

  const generated: string[] = [];

  for (const item of items.slice(0, 8)) {
    db.update(planItems)
      .set({ status: 'generating', updatedAt: Date.now() })
      .where(eq(planItems.id, item.id))
      .run();

    const prompt = `${buildContentSystemPrompt(voiceBlock)}

## Research context
${researchContext.slice(0, 16_000)}

## Deliverable
Platform: ${item.platform}
Format: ${item.contentType}
Topic: ${item.topic}

${voice?.contentBrief?.trim() ? `Honor the **spoken content brief** in Brand voice when choosing angle, emphasis, and CTA.\n\n` : ''}Write the final marketing copy in plain text or markdown as appropriate.`;

    try {
      const { taskId } = await createTask(prompt);
      const { messages } = await pollUntilComplete(taskId, { timeoutMs: null });
      const text = extractAssistantText(messages);

      const ciId = randomUUID();
      const tt = Date.now();
      db.insert(contentItems)
        .values({
          id: ciId,
          planId: plan.id,
          planItemId: item.id,
          platform: item.platform,
          contentType: item.contentType,
          textContent: text,
          status: 'draft',
          manusTaskId: taskId,
          createdAt: tt,
          updatedAt: tt,
        })
        .run();

      db.update(planItems)
        .set({
          status: 'drafted',
          contentItemId: ciId,
          manusTaskId: taskId,
          updatedAt: tt,
        })
        .where(eq(planItems.id, item.id))
        .run();
      generated.push(item.id);
    } catch (e) {
      db.update(planItems)
        .set({ status: 'planned', updatedAt: Date.now() })
        .where(eq(planItems.id, item.id))
        .run();
      console.error(e);
    }
  }

  return NextResponse.json({
    success: true,
    generated,
    message: `Generated ${generated.length} drafts.`,
  });
}
