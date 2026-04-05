import { hasPendingResearchTask } from '@/lib/agents/research/run-manus-research';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');
  const companyId = searchParams.get('companyId');
  if (!chatId || !companyId) {
    return Response.json({ error: 'chatId and companyId required' }, { status: 400 });
  }

  const pending = await hasPendingResearchTask(chatId, companyId);
  return Response.json({ pending });
}
