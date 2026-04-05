import { eq } from 'drizzle-orm';
import { deleteChat } from '@/lib/chat-store';
import { connectDB, getDb } from '@/lib/db/client';
import { agentConversations } from '@/lib/db/schema';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  await connectDB();
  const db = getDb();
  const chat = db.select().from(agentConversations).where(eq(agentConversations.id, chatId)).get();
  if (!chat) return Response.json({ messages: [] });
  try {
    return Response.json({ messages: JSON.parse(chat.messagesJson || '[]') });
  } catch {
    return Response.json({ messages: [] });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  await deleteChat(chatId);
  return Response.json({ ok: true });
}
