import { desc, eq, inArray } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { contentItems, contentPlans } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  await connectDB();
  const db = getDb();

  if (!companyId) {
    const items = db.select().from(contentItems).orderBy(desc(contentItems.createdAt)).limit(30).all();
    return Response.json({ items });
  }

  const plans = db.select().from(contentPlans).where(eq(contentPlans.companyId, companyId)).all();
  const planIds = plans.map((p) => p.id);
  if (planIds.length === 0) return Response.json({ items: [] });

  const items = db
    .select()
    .from(contentItems)
    .where(inArray(contentItems.planId, planIds))
    .orderBy(desc(contentItems.createdAt))
    .limit(30)
    .all();

  return Response.json({ items });
}
