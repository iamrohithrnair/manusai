import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { contentItems, planItems } from '@/lib/db/schema';
import { createTask, pollUntilComplete, extractAssistantText, listConnectors } from '@/lib/manus-client';
import { getManusApiKeyFromRequest } from '@/lib/manus-api-key';

export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string; itemId: string }> }
) {
  const manusApiKey = getManusApiKeyFromRequest(req);
  const { planId, itemId } = await params;
  const { platform } = await req.json();
  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 });

  await connectDB();
  const db = getDb();
  const item = db
    .select()
    .from(planItems)
    .where(and(eq(planItems.id, itemId), eq(planItems.planId, planId)))
    .get();
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const content = item.contentItemId
    ? db.select().from(contentItems).where(eq(contentItems.id, item.contentItemId)).get()
    : null;
  const text = content?.textContent || '';
  if (!text) return NextResponse.json({ error: 'No content to publish' }, { status: 400 });

  const connectors = (await listConnectors(manusApiKey)) as Array<{
    id?: string;
    uuid?: string;
    type?: string;
    name?: string;
  }>;
  const want = String(platform).toLowerCase();
  const match = connectors.find((c) => {
    const t = `${c.type || ''} ${c.name || ''}`.toLowerCase();
    return t.includes(want) || want.includes(String(c.type || '').toLowerCase());
  });
  const connectorId = match?.id || match?.uuid;

  const prompt = `Publish the following content to ${platform}. Use the connected account. After publishing, reply with ONLY the public URL of the post in a JSON block: \`\`\`json {"url":"..."}\`\`\`\n\n---\n\n${text.slice(0, 8000)}`;

  const { taskId } = await createTask(prompt, {
    connectors: connectorId ? [connectorId] : undefined,
    apiKey: manusApiKey,
  });
  const { messages } = await pollUntilComplete(taskId, { timeoutMs: null, apiKey: manusApiKey });
  const resultText = extractAssistantText(messages);

  let publishedUrl = '';
  const m = /"url"\s*:\s*"([^"]+)"/.exec(resultText);
  if (m) publishedUrl = m[1];

  if (content) {
    const tt = Date.now();
    db.update(contentItems)
      .set({
        status: 'published',
        publishedUrl,
        publishedAt: tt,
        manusTaskId: taskId,
        updatedAt: tt,
      })
      .where(eq(contentItems.id, content.id))
      .run();
  }

  db.update(planItems)
    .set({ status: 'published', updatedAt: Date.now() })
    .where(eq(planItems.id, itemId))
    .run();

  return NextResponse.json({ ok: true, publishedUrl, taskId });
}
