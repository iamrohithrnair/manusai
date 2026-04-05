import { randomUUID } from 'crypto';
import { after } from 'next/server';
import { connectDB, getDb } from '@/lib/db/client';
import { companies } from '@/lib/db/schema';
import { runManusResearchForCompany } from '@/lib/agents/research/run-manus-research';

export async function POST(req: Request) {
  const body = await req.json();
  const {
    name,
    linkedinUrl,
    instagramUrl,
    websiteUrl,
    industry,
    socialLinks,
  }: {
    name: string;
    linkedinUrl?: string;
    instagramUrl?: string;
    websiteUrl?: string;
    industry?: string;
    socialLinks?: { platform: string; url: string }[];
  } = body;

  if (!name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 });
  }

  await connectDB();
  const db = getDb();
  const id = randomUUID();
  const t = Date.now();
  db.insert(companies)
    .values({
      id,
      name: name.trim(),
      linkedinUrl: linkedinUrl || null,
      instagramUrl: instagramUrl || null,
      websiteUrl: websiteUrl || null,
      industry: industry?.trim() || null,
      socialLinksJson: JSON.stringify(socialLinks || []),
      createdAt: t,
      updatedAt: t,
    })
    .run();

  after(async () => {
    try {
      await runManusResearchForCompany(id);
    } catch (e) {
      console.error('[companies/create] background research failed', e);
    }
  });

  return Response.json({
    company: {
      _id: id,
      name: name.trim(),
      linkedinUrl,
      instagramUrl,
    },
  });
}
