import { desc } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { companies } from '@/lib/db/schema';

export async function GET() {
  await connectDB();
  const db = getDb();
  const rows = db.select().from(companies).orderBy(desc(companies.updatedAt)).all();
  return Response.json({
    companies: rows.map((c) => ({
      _id: c.id,
      name: c.name,
      linkedinUrl: c.linkedinUrl,
      instagramUrl: c.instagramUrl,
      websiteUrl: c.websiteUrl,
      industry: c.industry,
      size: c.size,
      description: c.description,
      metadata: {
        linkedinUrl: c.linkedinUrl,
        industry: c.industry,
      },
    })),
  });
}
