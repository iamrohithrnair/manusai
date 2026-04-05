import { eq } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { agentConversations, companies } from '@/lib/db/schema';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  await connectDB();
  const db = getDb();
  const c = db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
  const { socialLinksJson, ...rest } = c;
  return Response.json({
    company: {
      _id: c.id,
      ...rest,
      socialLinks: JSON.parse(socialLinksJson || '[]'),
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const data = (await req.json()) as Record<string, unknown>;
  await connectDB();
  const db = getDb();
  const t = Date.now();
  db.update(companies)
    .set({
      ...(typeof data.name === 'string' ? { name: data.name } : {}),
      ...(data.linkedinUrl !== undefined ? { linkedinUrl: data.linkedinUrl as string | null } : {}),
      ...(data.instagramUrl !== undefined ? { instagramUrl: data.instagramUrl as string | null } : {}),
      ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl as string | null } : {}),
      ...(data.industry !== undefined ? { industry: data.industry as string | null } : {}),
      ...(Array.isArray(data.socialLinks)
        ? { socialLinksJson: JSON.stringify(data.socialLinks) }
        : {}),
      updatedAt: t,
    })
    .where(eq(companies.id, companyId))
    .run();

  const c = db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
  const { socialLinksJson, ...rest } = c;
  return Response.json({
    company: { _id: c.id, ...rest, socialLinks: JSON.parse(socialLinksJson || '[]') },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  await connectDB();
  const db = getDb();
  const exists = db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!exists) return Response.json({ error: 'Not found' }, { status: 404 });
  db.delete(agentConversations).where(eq(agentConversations.rootCompany, companyId)).run();
  db.delete(companies).where(eq(companies.id, companyId)).run();
  return Response.json({ ok: true });
}
