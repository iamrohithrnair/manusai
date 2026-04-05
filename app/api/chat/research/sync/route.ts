import { syncPendingResearchTask } from '@/lib/agents/research/run-manus-research';

export async function POST(req: Request) {
  const body = (await req.json()) as { chatId?: string; rootCompanyId?: string };
  const { chatId, rootCompanyId } = body;
  if (!chatId || !rootCompanyId) {
    return Response.json({ error: 'chatId and rootCompanyId required' }, { status: 400 });
  }

  const result = await syncPendingResearchTask(chatId, rootCompanyId);
  return Response.json(result);
}
