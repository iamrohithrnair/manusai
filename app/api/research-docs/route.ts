import { listResearchNodesForApi } from '@/lib/research-graph';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId') ?? undefined;
  const nodes = listResearchNodesForApi(companyId);
  return Response.json({ nodes });
}
