import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  validateUIMessages,
  type UIMessage,
} from 'ai';
import { eq } from 'drizzle-orm';
import { saveChat } from '@/lib/chat-store';
import { connectDB, getDb } from '@/lib/db/client';
import { companies, voiceProfiles } from '@/lib/db/schema';
import {
  formatContentDraftStartedMessage,
  formatContentPlanStartedMessage,
  startContentDraftManusTask,
  startContentPlanManusTask,
} from '@/lib/agents/content/content-chat-background';
import { buildContentResearchPack } from '@/lib/agents/content/research-context';
import { getLastUserText } from '@/lib/messages';
import type { VoiceProfileLike } from '@/lib/types/voice';

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, chatId, rootCompanyId, contentPlanId } = body as {
    messages: UIMessage[];
    chatId?: string;
    rootCompanyId?: string;
    /** Active sidebar plan — Manus plan JSON merges into this plan. */
    contentPlanId?: string;
  };

  const validated = await validateUIMessages({ messages: messages ?? [] });

  if (!rootCompanyId) {
    return new Response(JSON.stringify({ error: 'Select a company first.' }), { status: 400 });
  }

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Missing chat session id.' }), { status: 400 });
  }

  await connectDB();
  const db = getDb();
  const company = db.select().from(companies).where(eq(companies.id, rootCompanyId)).get();
  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found.' }), { status: 404 });
  }

  const userText = getLastUserText(validated);
  const lower = userText.toLowerCase();
  const wantsPlan =
    /\b(plan|calendar|schedule|pipeline|content ideas|topics for|content plan|generate (a )?plan)\b/i.test(
      userText
    ) ||
    /\b(ideas|topics)\b.*\b(plan|calendar|post|content)\b/i.test(lower);
  const stream = createUIMessageStream({
    originalMessages: validated,
    execute: async ({ writer }) => {
      const messageId = generateId();
      const textId = generateId();
      writer.write({ type: 'start', messageId });
      writer.write({ type: 'text-start', id: textId });
      const push = (s: string) => {
        writer.write({ type: 'text-delta', id: textId, delta: s });
      };

      const researchContext = buildContentResearchPack(db, rootCompanyId, 14_000);

      const vRow = db.select().from(voiceProfiles).where(eq(voiceProfiles.companyId, rootCompanyId)).get();
      const voice: VoiceProfileLike | null = vRow
        ? {
            toneDescription: vRow.toneDescription,
            styleNotes: vRow.styleNotes,
            keyPhrases: JSON.parse(vRow.keyPhrasesJson || '[]'),
            personality: vRow.personality,
            contentBrief: vRow.contentBrief,
          }
        : null;

      if (wantsPlan) {
        push('📋 Generating a **content plan** with Manus...\n\n');
        const { taskId } = await startContentPlanManusTask({
          companyId: rootCompanyId,
          chatId,
          instruction: getLastUserText(validated),
          researchContext: researchContext || 'No research nodes yet — infer general best practices.',
          voice,
          targetPlanId: contentPlanId || null,
        });
        push('\n\n');
        push(formatContentPlanStartedMessage(taskId));
      } else {
        push('✍️ Generating content with Manus...\n\n');
        const { taskId } = await startContentDraftManusTask({
          companyId: rootCompanyId,
          chatId,
          userPrompt: getLastUserText(validated).slice(0, 500),
          researchContext: researchContext || '',
          voice,
        });
        push('\n\n');
        push(formatContentDraftStartedMessage(taskId));
      }

      writer.write({ type: 'text-end', id: textId });
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
    onFinish: async ({ messages: all }) => {
      if (chatId) {
        await saveChat({
          chatId,
          agentType: 'content',
          messages: all,
          rootCompanyId,
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
