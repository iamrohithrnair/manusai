import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb, getSqlite } from '@/lib/db/client';
import { companies, researchNodes, employees, contentAnalyses, type EdgeType } from '@/lib/db/schema';
import type { ResearchResultParsed } from '@/lib/agents/research/result-parser';

function now() {
  return Date.now();
}

function insertEdgeIgnore(fromId: string, toId: string, type: string, label?: string | null) {
  const sqlite = getSqlite();
  const id = randomUUID();
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO research_edges (id, from_node_id, to_node_id, type, label) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, fromId, toId, type, label ?? null);
}

function addBidirectional(aId: string, bId: string, aToB: EdgeType, bToA: EdgeType) {
  insertEdgeIgnore(aId, bId, aToB);
  insertEdgeIgnore(bId, aId, bToA);
}

export async function applyCompanyFromResearch(
  companyId: string,
  parsed: ResearchResultParsed
) {
  const c = parsed.company;
  const db = getDb();
  db.update(companies)
    .set({
      name: c.name,
      industry: c.industry ?? null,
      size: c.size ?? null,
      description: c.description ?? null,
      followerCount: c.linkedinFollowers ?? c.instagramFollowers ?? null,
      updatedAt: now(),
    })
    .where(eq(companies.id, companyId))
    .run();
}

export async function saveResearchGraph(companyId: string, parsed: ResearchResultParsed) {
  const db = getDb();
  await applyCompanyFromResearch(companyId, parsed);

  let our = db
    .select()
    .from(researchNodes)
    .where(
      and(
        eq(researchNodes.rootCompanyId, companyId),
        eq(researchNodes.nodeType, 'company'),
        eq(researchNodes.isOurCompany, true)
      )
    )
    .get();

  const companyMd = `# ${parsed.company.name}\n\n${parsed.company.description || ''}\n\n## Summary\n${parsed.company.contentSummary || ''}`;
  const metaOur = JSON.stringify({
    industry: parsed.company.industry,
    size: parsed.company.size,
    followerCount: parsed.company.linkedinFollowers,
    instagramFollowers: parsed.company.instagramFollowers,
  });

  if (!our) {
    const id = randomUUID();
    const t = now();
    db.insert(researchNodes)
      .values({
        id,
        name: parsed.company.name,
        nodeType: 'company',
        isOurCompany: true,
        rootCompanyId: companyId,
        content: companyMd,
        metadataJson: metaOur,
        createdAt: t,
        updatedAt: t,
      })
      .run();
    our = db.select().from(researchNodes).where(eq(researchNodes.id, id)).get()!;
  } else {
    db.update(researchNodes)
      .set({
        name: parsed.company.name,
        content: companyMd,
        metadataJson: metaOur,
        updatedAt: now(),
      })
      .where(eq(researchNodes.id, our.id))
      .run();
  }

  const ourId = our.id;

  for (const comp of parsed.competitors) {
    let compRow = db
      .select()
      .from(researchNodes)
      .where(
        and(
          eq(researchNodes.rootCompanyId, companyId),
          eq(researchNodes.nodeType, 'competitor'),
          eq(researchNodes.name, comp.name)
        )
      )
      .get();

    const compMd = `## ${comp.name}\n\n${comp.description || ''}\n\n**Industry:** ${comp.industry || 'n/a'}\n`;
    const compMeta = JSON.stringify({
      industry: comp.industry,
      size: comp.size,
      linkedinUrl: comp.linkedinUrl,
      instagramUrl: comp.instagramUrl,
    });

    if (!compRow) {
      const id = randomUUID();
      const t = now();
      db.insert(researchNodes)
        .values({
          id,
          name: comp.name,
          nodeType: 'competitor',
          isOurCompany: false,
          rootCompanyId: companyId,
          content: compMd,
          metadataJson: compMeta,
          createdAt: t,
          updatedAt: t,
        })
        .run();
      compRow = db.select().from(researchNodes).where(eq(researchNodes.id, id)).get()!;
    } else {
      db.update(researchNodes)
        .set({ content: compMd, metadataJson: compMeta, updatedAt: now() })
        .where(eq(researchNodes.id, compRow.id))
        .run();
    }

    const compId = compRow.id;
    addBidirectional(ourId, compId, 'competitor_of', 'competitor_of');

    for (const emp of comp.employees) {
      const linkedinUrl =
        emp.linkedinUrl ||
        `urn:graphluence:employee:${companyId}:${comp.name}:${emp.name}`.replace(/\s+/g, '-');

      const existingEmp = db.select().from(employees).where(eq(employees.linkedinUrl, linkedinUrl)).get();
      const t = now();
      if (existingEmp) {
        db.update(employees)
          .set({
            name: emp.name,
            title: emp.title ?? null,
            instagramUrl: emp.instagramUrl ?? null,
            updatedAt: t,
          })
          .where(eq(employees.id, existingEmp.id))
          .run();
      } else {
        db.insert(employees)
          .values({
            id: randomUUID(),
            name: emp.name,
            title: emp.title ?? null,
            linkedinUrl,
            instagramUrl: emp.instagramUrl ?? null,
            companyId,
            createdAt: t,
            updatedAt: t,
          })
          .run();
      }

      let empRow = db
        .select()
        .from(researchNodes)
        .where(
          and(
            eq(researchNodes.rootCompanyId, companyId),
            eq(researchNodes.nodeType, 'employee'),
            eq(researchNodes.name, emp.name)
          )
        )
        .get();

      const empMd = `### ${emp.name}\n${emp.title || ''}\n`;
      const empMeta = JSON.stringify({
        title: emp.title,
        linkedinUrl,
        instagramUrl: emp.instagramUrl,
      });

      if (!empRow) {
        const id = randomUUID();
        const tt = now();
        db.insert(researchNodes)
          .values({
            id,
            name: emp.name,
            nodeType: 'employee',
            isOurCompany: false,
            rootCompanyId: companyId,
            content: empMd,
            metadataJson: empMeta,
            createdAt: tt,
            updatedAt: tt,
          })
          .run();
        empRow = db.select().from(researchNodes).where(eq(researchNodes.id, id)).get()!;
      }
      addBidirectional(compId, empRow.id, 'has_employee', 'works_at');
    }

    if (comp.contentStrategy) {
      const stratName = `${comp.name} — strategy`;
      let stratRow = db
        .select()
        .from(researchNodes)
        .where(
          and(
            eq(researchNodes.rootCompanyId, companyId),
            eq(researchNodes.nodeType, 'content_strategy'),
            eq(researchNodes.name, stratName)
          )
        )
        .get();

      const stratMd =
        comp.contentStrategy.summary || JSON.stringify(comp.contentStrategy.themes);
      const stratMeta = JSON.stringify({
        themes: comp.contentStrategy.themes,
        postingFrequency: comp.contentStrategy.postingFrequency,
        avgEngagement: comp.contentStrategy.avgEngagement,
      });

      if (!stratRow) {
        const id = randomUUID();
        const t = now();
        db.insert(researchNodes)
          .values({
            id,
            name: stratName,
            nodeType: 'content_strategy',
            isOurCompany: false,
            rootCompanyId: companyId,
            content: stratMd,
            metadataJson: stratMeta,
            createdAt: t,
            updatedAt: t,
          })
          .run();
        stratRow = db.select().from(researchNodes).where(eq(researchNodes.id, id)).get()!;
      }
      addBidirectional(compId, stratRow.id, 'has_strategy', 'related_to');
    }

    let pi = 0;
    for (const post of comp.topPosts) {
      pi += 1;
      const postName = `${comp.name} — post ${pi}`;
      let postRow = db
        .select()
        .from(researchNodes)
        .where(
          and(
            eq(researchNodes.rootCompanyId, companyId),
            eq(researchNodes.nodeType, 'post'),
            eq(researchNodes.name, postName)
          )
        )
        .get();

      const postMd = post.text;
      const postMeta = JSON.stringify({
        platform: post.platform,
        contentFormat: post.format,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        engagement: (post.likes || 0) + (post.comments || 0),
        authorName: post.authorName,
        whyItWorked: post.whyItWorked,
      });

      if (!postRow) {
        const id = randomUUID();
        const t = now();
        db.insert(researchNodes)
          .values({
            id,
            name: postName,
            nodeType: 'post',
            isOurCompany: false,
            rootCompanyId: companyId,
            content: postMd,
            metadataJson: postMeta,
            createdAt: t,
            updatedAt: t,
          })
          .run();
        postRow = db.select().from(researchNodes).where(eq(researchNodes.id, id)).get()!;
      }
      addBidirectional(compId, postRow.id, 'related_to', 'related_to');
    }
  }

  const themes = parsed.competitors.flatMap((c) => c.contentStrategy?.themes || []);
  const gaps = parsed.competitors.flatMap((c) => c.contentStrategy?.gaps || []);
  const summary =
    parsed.competitors.map((c) => c.contentStrategy?.summary).filter(Boolean).join('\n\n') ||
    parsed.company.contentSummary ||
    '';

  const topPosts = parsed.competitors.flatMap((c) =>
    c.topPosts.slice(0, 3).map((p) => ({
      text: p.text.slice(0, 500),
      engagement: (p.likes || 0) + (p.comments || 0),
      platform: p.platform,
    }))
  );

  const existingCa = db.select().from(contentAnalyses).where(eq(contentAnalyses.companyId, companyId)).get();
  const t = now();
  if (existingCa) {
    db.update(contentAnalyses)
      .set({
        themesJson: JSON.stringify([...new Set(themes)].slice(0, 20)),
        gapsJson: JSON.stringify([...new Set(gaps)].slice(0, 20)),
        summary,
        topPostsJson: JSON.stringify(topPosts),
        updatedAt: t,
      })
      .where(eq(contentAnalyses.id, existingCa.id))
      .run();
  } else {
    db.insert(contentAnalyses)
      .values({
        id: randomUUID(),
        companyId,
        themesJson: JSON.stringify([...new Set(themes)].slice(0, 20)),
        gapsJson: JSON.stringify([...new Set(gaps)].slice(0, 20)),
        summary,
        topPostsJson: JSON.stringify(topPosts),
        createdAt: t,
        updatedAt: t,
      })
      .run();
  }

  return { ourNodeId: ourId, competitorCount: parsed.competitors.length };
}
