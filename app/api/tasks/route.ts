import { desc, eq } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { manusTasks } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  await connectDB();
  const db = getDb();
  const rows = companyId
    ? db
        .select()
        .from(manusTasks)
        .where(eq(manusTasks.companyId, companyId))
        .orderBy(desc(manusTasks.createdAt))
        .limit(50)
        .all()
    : db.select().from(manusTasks).orderBy(desc(manusTasks.createdAt)).limit(50).all();

  return Response.json({ tasks: rows });
}
