import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { planItems } from '@/lib/db/schema';

const ALLOWED = [
  'planned',
  'researching',
  'generating',
  'drafted',
  'approved',
  'rejected',
  'published',
] as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string; itemId: string }> }
) {
  const { planId, itemId } = await params;
  const { status } = await req.json();
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await connectDB();
  const db = getDb();
  db.update(planItems)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(planItems.id, itemId), eq(planItems.planId, planId)))
    .run();

  return NextResponse.json({ ok: true });
}
