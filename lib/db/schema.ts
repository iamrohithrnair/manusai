import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  linkedinUrl: text('linkedin_url'),
  instagramUrl: text('instagram_url'),
  websiteUrl: text('website_url'),
  industry: text('industry'),
  size: text('size'),
  description: text('description'),
  followerCount: integer('follower_count'),
  socialLinksJson: text('social_links_json').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const researchNodes = sqliteTable('research_nodes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nodeType: text('node_type').notNull(),
  content: text('content').notNull().default(''),
  isOurCompany: integer('is_our_company', { mode: 'boolean' }).notNull().default(false),
  rootCompanyId: text('root_company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const researchEdges = sqliteTable(
  'research_edges',
  {
    id: text('id').primaryKey(),
    fromNodeId: text('from_node_id')
      .notNull()
      .references(() => researchNodes.id, { onDelete: 'cascade' }),
    toNodeId: text('to_node_id')
      .notNull()
      .references(() => researchNodes.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    label: text('label'),
  },
  (t) => [uniqueIndex('edge_unique').on(t.fromNodeId, t.toNodeId, t.type)]
);

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title'),
  role: text('role'),
  linkedinUrl: text('linkedin_url').notNull().unique(),
  instagramUrl: text('instagram_url'),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  linkedinSummary: text('linkedin_summary'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const contentAnalyses = sqliteTable('content_analyses', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: 'cascade' }),
  themesJson: text('themes_json').notNull().default('[]'),
  postingFrequency: text('posting_frequency'),
  avgEngagement: integer('avg_engagement'),
  topPostsJson: text('top_posts_json').notNull().default('[]'),
  gapsJson: text('gaps_json').notNull().default('[]'),
  summary: text('summary').notNull().default(''),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const contentPlans = sqliteTable('content_plans', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const contentItems = sqliteTable('content_items', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => contentPlans.id, { onDelete: 'set null' }),
  planItemId: text('plan_item_id'),
  platform: text('platform').notNull().default('linkedin'),
  contentType: text('content_type').notNull().default('text_post'),
  textContent: text('text_content').notNull().default(''),
  carouselImagesJson: text('carousel_images_json'),
  slideUrlsJson: text('slide_urls_json'),
  videoUrl: text('video_url'),
  thumbnailUrl: text('thumbnail_url'),
  blogContent: text('blog_content'),
  status: text('status').notNull().default('draft'),
  manusTaskId: text('manus_task_id'),
  publishedUrl: text('published_url'),
  publishedAt: integer('published_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const planItems = sqliteTable('plan_items', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => contentPlans.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  platform: text('platform').notNull().default('linkedin'),
  contentType: text('content_type').notNull().default('text_post'),
  status: text('status').notNull().default('planned'),
  manusTaskId: text('manus_task_id'),
  contentItemId: text('content_item_id').references(() => contentItems.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const voiceProfiles = sqliteTable('voice_profiles', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: 'cascade' }),
  audioFileId: text('audio_file_id'),
  toneDescription: text('tone_description').notNull().default(''),
  styleNotes: text('style_notes').notNull().default(''),
  keyPhrasesJson: text('key_phrases_json').notNull().default('[]'),
  personality: text('personality').notNull().default(''),
  /** Topics, themes, and explicit content asks from the voice recording (drives drafts). */
  contentBrief: text('content_brief').notNull().default(''),
  manusTaskId: text('manus_task_id'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const manusTasks = sqliteTable('manus_tasks', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().unique(),
  type: text('type').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').notNull().default('pending'),
  result: text('result'),
  connectorsJson: text('connectors_json'),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
  /** When set, research task is tied to this chat; completion is synced when the user opens this session. */
  chatId: text('chat_id'),
  /** Content plan Manus tasks merge JSON items into this plan instead of creating a new plan. */
  targetPlanId: text('target_plan_id'),
  /** `company_bootstrap` = onboarding research (must not be claimed by chat sync). */
  taskSource: text('task_source').notNull().default('chat'),
  completedAt: integer('completed_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const agentConversations = sqliteTable('agent_conversations', {
  id: text('id').primaryKey(),
  agentType: text('agent_type').notNull(),
  messagesJson: text('messages_json').notNull().default('[]'),
  rootCompany: text('root_company'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export type EdgeType =
  | 'competitor_of'
  | 'has_employee'
  | 'works_at'
  | 'has_strategy'
  | 'authored'
  | 'related_to';
