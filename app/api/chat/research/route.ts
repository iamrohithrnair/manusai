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
import { companies } from '@/lib/db/schema';
import {
  formatResearchStartedMessage,
  startManusResearchTask,
} from '@/lib/agents/research/run-manus-research';
import { formatResearchWorkspacePreview } from '@/lib/agents/research/format-workspace-preview';
import { getAllUserResearchInstructions } from '@/lib/messages';
import { getManusApiKeyFromRequest } from '@/lib/manus-api-key';

export const maxDuration = 120;

export async function POST(req: Request) {
  const manusApiKey = getManusApiKeyFromRequest(req);
  const body = await req.json();
  const { messages, chatId, rootCompanyId } = body as {
    messages: UIMessage[];
    chatId?: string;
    rootCompanyId?: string;
  };

  const validated = await validateUIMessages({ messages: messages ?? [] });

  if (!rootCompanyId) {
    return new Response(JSON.stringify({ error: 'Select a company first.' }), { status: 400 });
  }

  await connectDB();
  const db = getDb();
  const company = db.select().from(companies).where(eq(companies.id, rootCompanyId)).get();
  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found.' }), { status: 404 });
  }

  const userInstructions = getAllUserResearchInstructions(validated);

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

      push(`🔍 Starting research for **${company.name}**...\n\n`);
      push(formatResearchWorkspacePreview(company, userInstructions));

      const { taskId } = await startManusResearchTask(rootCompanyId, userInstructions, {
        chatId,
        apiKey: manusApiKey,
      });
      push('\n\n');
      push(formatResearchStartedMessage(taskId));

      writer.write({ type: 'text-end', id: textId });
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
    onFinish: async ({ messages: all }) => {
      if (chatId) {
        await saveChat({
          chatId,
          agentType: 'research',
          messages: all,
          rootCompanyId,
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
