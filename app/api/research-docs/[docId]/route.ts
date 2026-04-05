import { getResearchNodeDetail } from '@/lib/research-graph';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  const node = getResearchNodeDetail(docId);
  if (!node) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ node });
}
