import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { planItems } from '@/lib/db/schema';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  const { planItemId, decision } = await req.json();
  if (!planItemId || !decision) {
    return NextResponse.json({ error: 'planItemId and decision required' }, { status: 400 });
  }

  await connectDB();
  const db = getDb();
  const status = decision === 'approved' ? 'approved' : 'rejected';
  db.update(planItems)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(planItems.id, planItemId), eq(planItems.planId, planId)))
    .run();

  return NextResponse.json({ ok: true, status });
}
