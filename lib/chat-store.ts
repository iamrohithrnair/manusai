import type { UIMessage } from 'ai';
import { eq } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { agentConversations } from '@/lib/db/schema';

export async function saveChat({
  chatId,
  agentType,
  messages,
  rootCompanyId,
}: {
  chatId: string;
  agentType: 'research' | 'content';
  messages: UIMessage[];
  rootCompanyId?: string;
}) {
  try {
    await connectDB();
    const db = getDb();
    const t = Date.now();
    const existing = db.select().from(agentConversations).where(eq(agentConversations.id, chatId)).get();
    if (existing) {
      db.update(agentConversations)
        .set({
          agentType,
          messagesJson: JSON.stringify(messages),
          rootCompany: rootCompanyId ?? null,
          updatedAt: t,
        })
        .where(eq(agentConversations.id, chatId))
        .run();
    } else {
      db.insert(agentConversations)
        .values({
          id: chatId,
          agentType,
          messagesJson: JSON.stringify(messages),
          rootCompany: rootCompanyId ?? null,
          createdAt: t,
          updatedAt: t,
        })
        .run();
    }
  } catch (err) {
    console.error(`[Session] Failed to save session ${chatId}:`, err);
  }
}

export async function loadChat(chatId: string): Promise<UIMessage[]> {
  await connectDB();
  const db = getDb();
  const row = db.select().from(agentConversations).where(eq(agentConversations.id, chatId)).get();
  if (!row?.messagesJson) return [];
  try {
    return JSON.parse(row.messagesJson) as UIMessage[];
  } catch {
    return [];
  }
}

export async function deleteChat(chatId: string) {
  await connectDB();
  const db = getDb();
  db.delete(agentConversations).where(eq(agentConversations.id, chatId)).run();
}
