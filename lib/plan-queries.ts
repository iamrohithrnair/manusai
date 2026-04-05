import { desc, eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { contentItems, contentPlans, planItems } from '@/lib/db/schema';

type PlanItemRow = InferSelectModel<typeof planItems>;

function mapPlanItemRow(pi: PlanItemRow) {
  const db = getDb();
  const ci = pi.contentItemId
    ? db.select().from(contentItems).where(eq(contentItems.id, pi.contentItemId)).get()
    : null;
  return {
    _id: pi.id,
    topic: pi.topic,
    platform: pi.platform,
    contentType: pi.contentType,
    status: pi.status,
    contentItem: ci
      ? {
          _id: ci.id,
          textContent: ci.textContent,
          status: ci.status,
          carouselImages: ci.carouselImagesJson ? JSON.parse(ci.carouselImagesJson) : [],
        }
      : undefined,
  };
}

export function getPlanById(planId: string) {
  const db = getDb();
  const plan = db.select().from(contentPlans).where(eq(contentPlans.id, planId)).get();
  if (!plan) return null;
  const items = db.select().from(planItems).where(eq(planItems.planId, planId)).all();
  return {
    ...plan,
    _id: plan.id,
    items: items.map(mapPlanItemRow),
    createdAt: new Date(plan.createdAt).toISOString(),
  };
}

export function getPlansWithItems(companyId: string) {
  const db = getDb();
  const plans = db
    .select()
    .from(contentPlans)
    .where(eq(contentPlans.companyId, companyId))
    .orderBy(desc(contentPlans.createdAt))
    .all();

  return plans.map((plan) => {
    const items = db.select().from(planItems).where(eq(planItems.planId, plan.id)).all();
    return {
      ...plan,
      _id: plan.id,
      items: items.map(mapPlanItemRow),
      createdAt: new Date(plan.createdAt).toISOString(),
    };
  });
}
