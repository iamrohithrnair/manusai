import { randomUUID } from 'crypto';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { generateId, type UIMessage } from 'ai';
import { connectDB, getDb } from '@/lib/db/client';
import { companies, manusTasks, researchNodes } from '@/lib/db/schema';
import {
  buildResearchPrompt,
  type ResearchCompanyProfile,
} from '@/lib/agents/research/system-prompt';
import { parseResearchResult } from '@/lib/agents/research/result-parser';
import { saveResearchGraph } from '@/lib/agents/research/db-helpers';
import { createTask, extractAssistantText, pollOneStep, pollUntilComplete } from '@/lib/manus-client';
import { loadChat, saveChat } from '@/lib/chat-store';
import { extractLastManusTaskIdFromMessages } from '@/lib/manus-chat-messages';

function ts() {
  return Date.now();
}

function normalizeUrlKey(url: string): string {
  const t = url.trim();
  if (!t) return '';
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return t.toLowerCase();
  }
}

/** Merge column URLs + JSON social links; dedupe by URL. */
function collectSocialLinks(company: typeof companies.$inferSelect): { platform: string; url: string }[] {
  const raw: { platform: string; url: string }[] = [
    ...(company.linkedinUrl ? [{ platform: 'linkedin', url: company.linkedinUrl }] : []),
    ...(company.instagramUrl ? [{ platform: 'instagram', url: company.instagramUrl }] : []),
    ...(company.websiteUrl ? [{ platform: 'website', url: company.websiteUrl }] : []),
    ...(JSON.parse(company.socialLinksJson || '[]') as { platform: string; url: string }[]).map((s) => ({
      platform: (s.platform || 'link').toLowerCase(),
      url: s.url,
    })),
  ];
  const seen = new Set<string>();
  const out: { platform: string; url: string }[] = [];
  for (const l of raw) {
    const key = normalizeUrlKey(l.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ platform: l.platform, url: l.url.trim() });
  }
  return out;
}

function rowToProfile(company: typeof companies.$inferSelect): ResearchCompanyProfile {
  return {
    name: company.name,
    industry: company.industry,
    size: company.size,
    description: company.description,
    followerCount: company.followerCount,
    socialLinks: collectSocialLinks(company),
  };
}

const DEFAULT_INSTRUCTIONS =
  'Run the full competitive intelligence pipeline. Use the workspace company profile and every URL as ground truth to verify on the live web, then enrich with competitors, people, posts, and strategy.';

async function buildPrompt(companyId: string, userInstructions: string): Promise<string> {
  await connectDB();
  const db = getDb();
  const company = db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!company) throw new Error('Company not found');

  const existingRows = db
    .select({ id: researchNodes.id, name: researchNodes.name, nodeType: researchNodes.nodeType })
    .from(researchNodes)
    .where(eq(researchNodes.rootCompanyId, companyId))
    .limit(80)
    .all();

  const existingForPrompt = existingRows.map((n) => ({
    name: n.name,
    nodeType: n.nodeType,
    id: n.id,
  }));

  const effectiveUser = userInstructions.trim() || DEFAULT_INSTRUCTIONS;
  return buildResearchPrompt(rowToProfile(company), existingForPrompt, effectiveUser);
}

/**
 * Create a Manus research task and persist a running row (optionally linked to a chat).
 * Does not poll — use syncPendingResearchTask from the UI or pollUntilComplete for blocking flows.
 */
export async function startManusResearchTask(
  companyId: string,
  userInstructions: string,
  chatId?: string,
  taskSource: 'chat' | 'company_bootstrap' = 'chat'
): Promise<{ taskId: string }> {
  const prompt = await buildPrompt(companyId, userInstructions);
  const { taskId } = await createTask(prompt, { interactiveMode: false });

  await connectDB();
  const db = getDb();
  const mtId = randomUUID();
  const t0 = ts();
  db.insert(manusTasks)
    .values({
      id: mtId,
      taskId,
      type: 'research',
      prompt: prompt.slice(0, 50000),
      status: 'running',
      companyId,
      chatId: chatId ?? null,
      taskSource,
      createdAt: t0,
      updatedAt: t0,
    })
    .run();

  return { taskId };
}

/**
 * Resolve the running research Manus row for this session: exact chat binding,
 * task id embedded in saved messages (legacy / repaired rows), or a claimable orphan.
 */
export async function findRunningResearchTaskForChat(
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
        eq(manusTasks.type, 'research'),
        eq(manusTasks.status, 'running')
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
          eq(manusTasks.type, 'research'),
          eq(manusTasks.status, 'running')
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
        eq(manusTasks.type, 'research'),
        eq(manusTasks.status, 'running'),
        ne(manusTasks.taskSource, 'company_bootstrap')
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

export function formatResearchStartedMessage(taskId: string): string {
  return `**Manus task** \`${taskId}\` is running in the background.

You can switch sessions or leave this page. When you open this chat again, results will load automatically. If you stay on this chat, it will update when the task finishes (while this tab is visible).`;
}

export function formatResearchFollowupMessage(r: {
  taskId: string;
  summary: string;
  parsed: boolean;
  resultText: string;
}): string {
  let text = `\n✅ Task \`${r.taskId}\` complete. ${r.summary}\n\n---\n\n`;
  const parsedDoc = parseResearchResult(r.resultText);
  if (parsedDoc) {
    text += '### Results (excerpt)\n\n';
    text += r.resultText.slice(0, 12000);
    if (r.resultText.length > 12000) text += '\n\n_(truncated)_\n';
  } else {
    text += 'Raw output (parse failed):\n\n';
    text += r.resultText.slice(0, 16000);
  }
  return text;
}

function messageAlreadyHasTaskCompletion(messages: UIMessage[], taskId: string): boolean {
  const marker = `\`${taskId}\` complete`;
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      m.parts?.some((p) => p.type === 'text' && (p.text?.includes(marker) ?? false))
  );
}

async function persistResearchFromMessagesWithRaceGuard(
  taskId: string,
  companyId: string,
  messages: unknown[]
): Promise<{ summary: string; parsed: boolean; resultText: string } | 'duplicate'> {
  await connectDB();
  const db = getDb();
  const stillRunning = db
    .select()
    .from(manusTasks)
    .where(and(eq(manusTasks.taskId, taskId), eq(manusTasks.status, 'running')))
    .get();
  if (!stillRunning) return 'duplicate';

  const resultText = extractAssistantText(messages);
  const parsed = parseResearchResult(resultText);
  const t1 = ts();

  let summary: string;
  if (parsed) {
    const s = await saveResearchGraph(companyId, parsed);
    summary = `Saved graph: ${s.competitorCount} competitors.`;
  } else {
    summary = 'Completed without parseable JSON.';
  }

  const run = db
    .update(manusTasks)
    .set({
      status: 'completed',
      result: resultText.slice(0, 50000),
      completedAt: t1,
      updatedAt: t1,
    })
    .where(and(eq(manusTasks.taskId, taskId), eq(manusTasks.status, 'running')))
    .run();

  if (run.changes === 0) return 'duplicate';
  return { summary, parsed: !!parsed, resultText };
}

/**
 * Advance one Manus poll step for the running research task tied to this chat.
 * Call from the client while the session is visible, or when reopening the chat.
 */
export async function syncPendingResearchTask(
  chatId: string,
  rootCompanyId: string
): Promise<
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'completed'; messages: UIMessage[] }
  | { status: 'failed'; messages: UIMessage[]; error: string }
> {
  await connectDB();
  const db = getDb();
  const row = await findRunningResearchTaskForChat(chatId, rootCompanyId);
  if (!row) return { status: 'idle' };

  const step = await pollOneStep(row.taskId);

  if (step.kind === 'continue') {
    db.update(manusTasks).set({ updatedAt: ts() }).where(eq(manusTasks.id, row.id)).run();
    return { status: 'running' };
  }

  if (step.kind === 'error') {
    const t = ts();
    db.update(manusTasks)
      .set({
        status: 'failed',
        result: step.message.slice(0, 50000),
        updatedAt: t,
      })
      .where(and(eq(manusTasks.taskId, row.taskId), eq(manusTasks.status, 'running')))
      .run();

    const existing = await loadChat(chatId);
    const errMsg: UIMessage = {
      id: generateId(),
      role: 'assistant',
      parts: [{ type: 'text', text: `Research task failed: ${step.message}` }],
    };
    const merged = [...existing, errMsg];
    await saveChat({ chatId, agentType: 'research', messages: merged, rootCompanyId });
    return { status: 'failed', messages: merged, error: step.message };
  }

  const persisted = await persistResearchFromMessagesWithRaceGuard(row.taskId, rootCompanyId, step.messages);
  if (persisted === 'duplicate') {
    const messages = await loadChat(chatId);
    return { status: 'completed', messages };
  }

  const existing = await loadChat(chatId);
  if (messageAlreadyHasTaskCompletion(existing, row.taskId)) {
    return { status: 'completed', messages: existing };
  }

  const followup = formatResearchFollowupMessage({
    taskId: row.taskId,
    summary: persisted.summary,
    parsed: persisted.parsed,
    resultText: persisted.resultText,
  });

  const followMsg: UIMessage = {
    id: generateId(),
    role: 'assistant',
    parts: [{ type: 'text', text: followup }],
  };
  const merged = [...existing, followMsg];
  await saveChat({ chatId, agentType: 'research', messages: merged, rootCompanyId });
  return { status: 'completed', messages: merged };
}

export async function hasPendingResearchTask(chatId: string, rootCompanyId: string): Promise<boolean> {
  const row = await findRunningResearchTaskForChat(chatId, rootCompanyId);
  return !!row;
}

/** Blocking run (e.g. company onboarding after()) — no timeout. */
export async function runManusResearchForCompany(
  companyId: string,
  userInstructions = '',
  options?: { onStatus?: (status: string, elapsedMs: number) => void }
): Promise<{
  taskId: string;
  summary: string;
  parsed: boolean;
  resultText: string;
}> {
  const { taskId } = await startManusResearchTask(companyId, userInstructions, undefined, 'company_bootstrap');

  const { messages } = await pollUntilComplete(taskId, {
    intervalMs: 5000,
    timeoutMs: null,
    onStatus: options?.onStatus,
  });

  const resultText = extractAssistantText(messages);
  const parsed = parseResearchResult(resultText);
  const t1 = ts();
  await connectDB();
  const db = getDb();
  if (parsed) {
    const s = await saveResearchGraph(companyId, parsed);
    db.update(manusTasks)
      .set({
        status: 'completed',
        result: resultText.slice(0, 50000),
        completedAt: t1,
        updatedAt: t1,
      })
      .where(eq(manusTasks.taskId, taskId))
      .run();
    return {
      taskId,
      summary: `Saved graph: ${s.competitorCount} competitors.`,
      parsed: true,
      resultText,
    };
  }

  db.update(manusTasks)
    .set({
      status: 'completed',
      result: resultText.slice(0, 50000),
      completedAt: t1,
      updatedAt: t1,
    })
    .where(eq(manusTasks.taskId, taskId))
    .run();
  return { taskId, summary: 'Completed without parseable JSON.', parsed: false, resultText };
}
