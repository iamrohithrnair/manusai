import { listConnectors } from '@/lib/manus-client';

export async function GET() {
  try {
    const connectors = await listConnectors();
    return Response.json({ connectors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to list connectors';
    return Response.json({ connectors: [], error: msg }, { status: 200 });
  }
}
