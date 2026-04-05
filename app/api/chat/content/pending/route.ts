import { hasPendingContentTask } from '@/lib/agents/content/content-chat-background';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');
  const companyId = searchParams.get('companyId');
  if (!chatId || !companyId) {
    return Response.json({ error: 'chatId and companyId required' }, { status: 400 });
  }

  const pending = await hasPendingContentTask(chatId, companyId);
  return Response.json({ pending });
}
