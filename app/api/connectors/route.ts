import { listConnectors } from '@/lib/manus-client';
import { getManusApiKeyFromRequest } from '@/lib/manus-api-key';

export async function GET(req: Request) {
  try {
    const connectors = await listConnectors(getManusApiKeyFromRequest(req));
    return Response.json({ connectors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to list connectors';
    return Response.json({ connectors: [], error: msg }, { status: 200 });
  }
}
