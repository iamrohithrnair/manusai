import { randomUUID } from 'crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { generateId, type UIMessage } from 'ai';
import { connectDB, getDb } from '@/lib/db/client';
import { contentItems, contentPlans, manusTasks, planItems } from '@/lib/db/schema';
import {
  buildContentSystemPrompt,
  buildVoiceProfileBlock,
} from '@/lib/agents/content/system-prompt';
import { parseContentPlanJson } from '@/lib/agents/content/manus-content';
import { createTask, extractAssistantText, pollOneStep, type ManusApiKeyOverride } from '@/lib/manus-client';
import { loadChat, saveChat } from '@/lib/chat-store';
import { extractLastManusTaskIdFromMessages } from '@/lib/manus-chat-messages';
import type { VoiceProfileLike } from '@/lib/types/voice';

function ts() {
  return Date.now();
}

function buildDraftPrompt(
  userPrompt: string,
  researchContext: string,
  voice: VoiceProfileLike | null
): string {
  const voiceBlock = buildVoiceProfileBlock(voice);
  const chat = userPrompt.trim();
  const hasBrief = !!voice?.contentBrief?.trim();

  let taskSection: string;
  if (hasBrief && chat) {
    taskSection = `## Task
**Primary (voice recording):** Follow the spoken content brief in Brand voice above.

**Also from chat:** ${chat}`;
  } else if (hasBrief) {
    taskSection = `## Task
Follow the **spoken content brief** in Brand voice above as the main creative brief. Deliver finished draft copy.`;
  } else if (chat) {
    taskSection = `## Task\n${chat}`;
  } else {
    taskSection = `## Task
Write marketing content aligned with research context and brand voice.`;
  }

  return `${buildContentSystemPrompt(voiceBlock)}

## Research context
${researchContext.slice(0, 14_000)}

${taskSection}`;
}

function buildPlanPrompt(
  instruction: string,
  researchContext: string,
  voice: VoiceProfileLike | null
): string {
  const voiceBlock = buildVoiceProfileBlock(voice);
  const instr = instruction.trim();
  const voiceBrief = voice?.contentBrief?.trim();

  let userBlock: string;
  if (voiceBrief && instr) {
    userBlock = `**Priorities from voice recording:**\n${voiceBrief}\n\n**Additional chat instruction:**\n${instr}`;
  } else if (voiceBrief) {
    userBlock = voiceBrief;
  } else {
    userBlock = instr;
  }

  const system = buildContentSystemPrompt(voiceBlock);
  return `${system}

## Research context
${researchContext}

## User instruction
${userBlock || 'Propose a content calendar aligned with research and brand voice.'}

Return a content plan as JSON inside a \`\`\`json block:
{
  "title": "Plan title",
  "items": [
    { "topic": "...", "platform": "linkedin|instagram|blog|other", "contentType": "text_post|carousel|reel|story|video|blog|slides" }
  ]
}
Use 4–10 items. If the user did not specify platforms or formats, **spread items across LinkedIn, Instagram, blog, and short-form video** (carousel/reel/story as appropriate). Each topic must tie to **competitors, post examples, themes, or gaps** in the research context — differentiated angles, not generic filler.`;
}

export async function startContentDraftManusTask(params: {
  companyId: string;
  chatId: string;
  userPrompt: string;
  researchContext: string;
  voice: VoiceProfileLike | null;
  apiKey?: ManusApiKeyOverride;
}): Promise<{ taskId: string }> {
  const prompt = buildDraftPrompt(params.userPrompt, params.researchContext, params.voice);
  const { taskId } = await createTask(prompt, { apiKey: params.apiKey });

  await connectDB();
  const db = getDb();
  const id = randomUUID();
  const t0 = ts();
  db.insert(manusTasks)
    .values({
      id,
      taskId,
      type: 'content_draft',
      prompt: params.userPrompt.slice(0, 50000),
      status: 'running',
      companyId: params.companyId,
      chatId: params.chatId,
      taskSource: 'chat',
      createdAt: t0,
      updatedAt: t0,
    })
    .run();

  return { taskId };
}

export async function startContentPlanManusTask(params: {
  companyId: string;
  chatId: string;
  instruction: string;
  researchContext: string;
  voice: VoiceProfileLike | null;
  /** Merge resulting plan items into this workspace plan (sidebar) instead of creating a new plan row. */
  targetPlanId?: string | null;
  apiKey?: ManusApiKeyOverride;
}): Promise<{ taskId: string }> {
  const prompt = buildPlanPrompt(params.instruction, params.researchContext, params.voice);
  const { taskId } = await createTask(prompt, { apiKey: params.apiKey });

  await connectDB();
  const db = getDb();
  const id = randomUUID();
  const t0 = ts();
  db.insert(manusTasks)
    .values({
      id,
      taskId,
      type: 'content_plan',
      prompt: params.instruction.slice(0, 50000),
      status: 'running',
      companyId: params.companyId,
      chatId: params.chatId,
      targetPlanId: params.targetPlanId ?? null,
      taskSource: 'chat',
      createdAt: t0,
      updatedAt: t0,
    })
    .run();

  return { taskId };
}

export function formatContentDraftStartedMessage(taskId: string): string {
  return `**Manus task** \`${taskId}\` is generating your draft in the background.

You can leave this tab or start another session; when you return here, the draft will sync automatically while this tab is visible.`;
}

export function formatContentPlanStartedMessage(taskId: string): string {
  return `**Manus task** \`${taskId}\` is building your content plan in the background.

You can leave this tab or start another session; when you return here, the plan will sync automatically while this tab is visible.`;
}

function messageAlreadyHasContentFollowup(messages: UIMessage[], taskId: string): boolean {
  const marker = `Content task \`${taskId}\` complete`;
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      m.parts?.some((p) => p.type === 'text' && (p.text?.includes(marker) ?? false))
  );
}

async function finalizeDraftTask(
  taskId: string,
  companyId: string,
  messages: unknown[],
  chatId: string,
  rootCompanyId: string
): Promise<void> {
  await connectDB();
  const db = getDb();
  const still = db
    .select()
    .from(manusTasks)
    .where(and(eq(manusTasks.taskId, taskId), eq(manusTasks.status, 'running'), eq(manusTasks.type, 'content_draft')))
    .get();
  if (!still) return;

  const resultText = extractAssistantText(messages);
  const t = ts();
  const ciId = randomUUID();
  db.insert(contentItems)
    .values({
      id: ciId,
      platform: 'linkedin',
      contentType: 'text_post',
      textContent: resultText,
      status: 'draft',
      manusTaskId: taskId,
      createdAt: t,
      updatedAt: t,
    })
    .run();

  const run = db
    .update(manusTasks)
    .set({
      type: 'content',
      status: 'completed',
      result: resultText.slice(0, 20000),
      completedAt: t,
      updatedAt: t,
    })
    .where(
      and(eq(manusTasks.taskId, taskId), eq(manusTasks.status, 'running'), eq(manusTasks.type, 'content_draft'))
    )
    .run();
  if (run.changes === 0) return;

  const body = `✅ Content task \`${taskId}\` complete.

Draft saved as content item \`${ciId}\`.

---

${resultText.slice(0, 14000)}`;

  const existing = await loadChat(chatId);
  if (messageAlreadyHasContentFollowup(existing, taskId)) return;

  const follow: UIMessage = {
    id: generateId(),
    role: 'assistant',
    parts: [{ type: 'text', text: body }],
  };
  await saveChat({ chatId, agentType: 'content', messages: [...existing, follow], rootCompanyId });
}

async function finalizePlanTask(
  taskId: string,
  companyId: string,
  messages: unknown[],
  chatId: string,
  rootCompanyId: string
): Promise<void> {
  await connectDB();
  const db = getDb();
  const still = db
    .select()
    .from(manusTasks)
    .where(and(eq(manusTasks.taskId, taskId), eq(manusTasks.status, 'running'), eq(manusTasks.type, 'content_plan')))
    .get();
  if (!still) return;

  const resultText = extractAssistantText(messages);
  const plan = parseContentPlanJson(resultText);
  const t = Date.now();

  if (plan?.items?.length) {
    let planId: string | null = still.targetPlanId ?? null;
    if (planId) {
      const existingPlan = db.select().from(contentPlans).where(eq(contentPlans.id, planId)).get();
      if (!existingPlan || existingPlan.companyId !== companyId) {
        planId = null;
      }
    }
    if (!planId) {
      planId = randomUUID();
      db.insert(contentPlans)
        .values({
          id: planId,
          companyId,
          title: plan.title,
          status: 'draft',
          createdAt: t,
          updatedAt: t,
        })
        .run();
    } else {
      db.update(contentPlans)
        .set({ title: plan.title, updatedAt: t })
        .where(eq(contentPlans.id, planId))
        .run();
    }

    for (const it of plan.items) {
      const piId = randomUUID();
      db.insert(planItems)
        .values({
          id: piId,
          planId,
          topic: it.topic,
          platform: it.platform,
          contentType: it.contentType,
          status: 'planned',
          createdAt: t,
          updatedAt: t,
        })
        .run();
    }
  }

  const run = db
    .update(manusTasks)
    .set({
      type: 'content',
      status: 'completed',
      result: resultText.slice(0, 20000),
      completedAt: t,
      updatedAt: t,
    })
    .where(
      and(eq(manusTasks.taskId, taskId), eq(manusTasks.status, 'running'), eq(manusTasks.type, 'content_plan'))
    )
    .run();
  if (run.changes === 0) return;

  let intro = '';
  if (plan?.items?.length) {
    intro = still.targetPlanId
      ? `Added **${plan.items.length}** topics to your open plan (*${plan.title}*).\n\n`
      : `Created plan **${plan.title}** with ${plan.items.length} items.\n\n`;
  }

  const body = `✅ Content task \`${taskId}\` complete.

${intro}${resultText.slice(0, 14000)}`;

  const existing = await loadChat(chatId);
  if (messageAlreadyHasContentFollowup(existing, taskId)) return;

  const follow: UIMessage = {
    id: generateId(),
    role: 'assistant',
    parts: [{ type: 'text', text: body }],
  };
  await saveChat({ chatId, agentType: 'content', messages: [...existing, follow], rootCompanyId });
}

/**
 * Resolve running content Manus row: exact chat, task id in messages, or claimable orphan (NULL chat_id).
 */
export async function findRunningContentTaskForChat(
  chatId: string,
  rootCompanyId: string
): Promise<(typeof manusTasks.$inferSelect & { chatId: string | null }) | null> {
  await connectDB();
  const db = getDb();

  const bound = db
    .select()
    .from(manusTasks)
    .where(
      and(
        eq(manusTasks.chatId, chatId),
        eq(manusTasks.companyId, rootCompanyId),
        eq(manusTasks.status, 'running'),
        inArray(manusTasks.type, ['content_draft', 'content_plan'])
      )
    )
    .orderBy(desc(manusTasks.updatedAt))
    .limit(1)
    .get();
  if (bound) return bound;

  const messages = await loadChat(chatId);
  const tid = extractLastManusTaskIdFromMessages(messages);
  if (tid) {
    const byTid = db
      .select()
      .from(manusTasks)
      .where(
        and(
          eq(manusTasks.taskId, tid),
          eq(manusTasks.companyId, rootCompanyId),
          eq(manusTasks.status, 'running'),
          inArray(manusTasks.type, ['content_draft', 'content_plan'])
        )
      )
      .get();
    if (byTid) {
      if (byTid.chatId !== chatId) {
        db.update(manusTasks)
          .set({ chatId, updatedAt: ts() })
          .where(eq(manusTasks.id, byTid.id))
          .run();
      }
      return { ...byTid, chatId };
    }
  }

  const orphan = db
    .select()
    .from(manusTasks)
    .where(
      and(
        isNull(manusTasks.chatId),
        eq(manusTasks.companyId, rootCompanyId),
        eq(manusTasks.status, 'running'),
        inArray(manusTasks.type, ['content_draft', 'content_plan'])
      )
    )
    .orderBy(desc(manusTasks.updatedAt))
    .limit(1)
    .get();
  if (orphan) {
    db.update(manusTasks)
      .set({ chatId, updatedAt: ts() })
      .where(eq(manusTasks.id, orphan.id))
      .run();
    return { ...orphan, chatId };
  }

  return null;
}

export async function hasPendingContentTask(chatId: string, rootCompanyId: string): Promise<boolean> {
  const row = await findRunningContentTaskForChat(chatId, rootCompanyId);
  return !!row;
}

export async function syncPendingContentTask(
  chatId: string,
  rootCompanyId: string,
  apiKey?: ManusApiKeyOverride
): Promise<
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'completed'; messages: UIMessage[] }
  | { status: 'failed'; messages: UIMessage[]; error: string }
> {
  await connectDB();
  const db = getDb();
  const row = await findRunningContentTaskForChat(chatId, rootCompanyId);

  if (!row) {
    return { status: 'idle' };
  }

  const step = await pollOneStep(row.taskId, apiKey);

  if (step.kind === 'continue') {
    db.update(manusTasks).set({ updatedAt: ts() }).where(eq(manusTasks.id, row.id)).run();
    return { status: 'running' };
  }

  if (step.kind === 'error') {
    const t = ts();
    db.update(manusTasks)
      .set({
        status: 'failed',
        result: step.message.slice(0, 20000),
        updatedAt: t,
      })
      .where(and(eq(manusTasks.taskId, row.taskId), eq(manusTasks.status, 'running')))
      .run();

    const existing = await loadChat(chatId);
    const errMsg: UIMessage = {
      id: generateId(),
      role: 'assistant',
      parts: [{ type: 'text', text: `Content task failed: ${step.message}` }],
    };
    const merged = [...existing, errMsg];
    await saveChat({ chatId, agentType: 'content', messages: merged, rootCompanyId });
    return { status: 'failed', messages: merged, error: step.message };
  }

  if (row.type === 'content_draft') {
    await finalizeDraftTask(row.taskId, rootCompanyId, step.messages, chatId, rootCompanyId);
  } else {
    await finalizePlanTask(row.taskId, rootCompanyId, step.messages, chatId, rootCompanyId);
  }

  const messages = await loadChat(chatId);
  return { status: 'completed', messages };
}
