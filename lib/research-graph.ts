import { eq, or, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { researchNodes, researchEdges } from '@/lib/db/schema';

/** Shape expected by KnowledgeGraph / node modal (Mongo-style population). */
export function listResearchNodesForApi(companyId?: string) {
  const db = getDb();
  const nodes = companyId
    ? db.select().from(researchNodes).where(eq(researchNodes.rootCompanyId, companyId)).all()
    : db.select().from(researchNodes).all();

  if (nodes.length === 0) return [];

  const ids = new Set(nodes.map((n) => n.id));
  const idList = [...ids];
  const edges = db
    .select()
    .from(researchEdges)
    .where(
      or(inArray(researchEdges.fromNodeId, idList), inArray(researchEdges.toNodeId, idList))
    )
    .all()
    .filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId));

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return nodes.map((n) => ({
    _id: n.id,
    name: n.name,
    nodeType: n.nodeType,
    isOurCompany: n.isOurCompany,
    content: n.content,
    metadata: JSON.parse(n.metadataJson || '{}') as Record<string, unknown>,
    updatedAt: new Date(n.updatedAt).toISOString(),
    edges: edges
      .filter((e) => e.fromNodeId === n.id)
      .map((e) => {
        const t = nodeById.get(e.toNodeId);
        if (!t) return null;
        return {
          type: e.type,
          label: e.label ?? undefined,
          target: {
            _id: t.id,
            name: t.name,
            nodeType: t.nodeType,
            metadata: JSON.parse(t.metadataJson || '{}') as Record<string, unknown>,
          },
        };
      })
      .filter(Boolean),
  }));
}

export function getResearchNodeDetail(docId: string) {
  const db = getDb();
  const n = db.select().from(researchNodes).where(eq(researchNodes.id, docId)).get();
  if (!n) return null;

  const outgoing = db.select().from(researchEdges).where(eq(researchEdges.fromNodeId, docId)).all();
  const edges = outgoing
    .map((e) => {
      const t = db.select().from(researchNodes).where(eq(researchNodes.id, e.toNodeId)).get();
      if (!t) return null;
      return {
        type: e.type,
        label: e.label ?? undefined,
        target: {
          _id: t.id,
          name: t.name,
          nodeType: t.nodeType,
          metadata: JSON.parse(t.metadataJson || '{}') as Record<string, unknown>,
        },
      };
    })
    .filter(Boolean);

  return {
    _id: n.id,
    name: n.name,
    nodeType: n.nodeType,
    isOurCompany: n.isOurCompany,
    content: n.content,
    metadata: JSON.parse(n.metadataJson || '{}') as Record<string, unknown>,
    edges,
    createdAt: new Date(n.createdAt).toISOString(),
    updatedAt: new Date(n.updatedAt).toISOString(),
  };
}
