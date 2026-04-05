import { desc, eq } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { agentConversations } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentType = searchParams.get('agentType') || 'research';
  const companyId = searchParams.get('companyId');

  await connectDB();
  const db = getDb();
  const base = db
    .select()
    .from(agentConversations)
    .orderBy(desc(agentConversations.updatedAt))
    .all()
    .filter((c) => c.agentType === agentType);

  const chats = companyId ? base.filter((c) => c.rootCompany === companyId) : base;

  const items = chats.map((chat) => {
    let preview = 'New session';
    try {
      const msgs = JSON.parse(chat.messagesJson || '[]') as Array<{
        role: string;
        parts?: Array<{ type: string; text?: string }>;
      }>;
      const firstUser = msgs.find((m) => m.role === 'user');
      const textPart = firstUser?.parts?.find((p) => p.type === 'text');
      preview = textPart?.text?.slice(0, 80) || preview;
    } catch {
      /* ignore */
    }
    return {
      _id: chat.id,
      preview,
      updatedAt: new Date(chat.updatedAt).toISOString(),
    };
  });

  return Response.json({ items });
}
