import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { contentPlans, planItems } from '@/lib/db/schema';
import { getPlanById } from '@/lib/plan-queries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  await connectDB();
  const plan = getPlanById(planId);
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  const data = (await req.json()) as { title?: string; status?: string };
  await connectDB();
  const db = getDb();
  const t = Date.now();
  db.update(contentPlans)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: t,
    })
    .where(eq(contentPlans.id, planId))
    .run();

  const plan = getPlanById(planId);
  return NextResponse.json({ plan });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  await connectDB();
  const db = getDb();
  db.delete(planItems).where(eq(planItems.planId, planId)).run();
  db.delete(contentPlans).where(eq(contentPlans.id, planId)).run();
  return NextResponse.json({ ok: true });
}
