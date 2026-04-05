import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { getPlansWithItems } from '@/lib/plan-queries';
import { contentPlans } from '@/lib/db/schema';

export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

  await connectDB();
  const plans = getPlansWithItems(companyId);
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const { companyId, title } = await req.json();
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

  await connectDB();
  const db = getDb();
  const id = randomUUID();
  const t = Date.now();
  db.insert(contentPlans)
    .values({
      id,
      companyId,
      title: title || `Content plan — ${new Date().toLocaleDateString()}`,
      status: 'draft',
      createdAt: t,
      updatedAt: t,
    })
    .run();

  const plan = db.select().from(contentPlans).where(eq(contentPlans.id, id)).get();
  return NextResponse.json({ plan: { ...plan, _id: plan!.id, items: [] } });
}
