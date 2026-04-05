import type Database from 'better-sqlite3';

/** Idempotent schema creation for embedded SQLite (no drizzle-kit required). */
export function runMigrations(sqlite: Database.Database) {
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  linkedin_url TEXT,
  instagram_url TEXT,
  website_url TEXT,
  industry TEXT,
  size TEXT,
  description TEXT,
  follower_count INTEGER,
  social_links_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS research_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  node_type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_our_company INTEGER NOT NULL DEFAULT 0,
  root_company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS research_edges (
  id TEXT PRIMARY KEY NOT NULL,
  from_node_id TEXT NOT NULL REFERENCES research_nodes(id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES research_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS research_edges_unique ON research_edges(from_node_id, to_node_id, type);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  role TEXT,
  linkedin_url TEXT NOT NULL UNIQUE,
  instagram_url TEXT,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  linkedin_summary TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content_analyses (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  themes_json TEXT NOT NULL DEFAULT '[]',
  posting_frequency TEXT,
  avg_engagement INTEGER,
  top_posts_json TEXT NOT NULL DEFAULT '[]',
  gaps_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content_plans (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT REFERENCES content_plans(id) ON DELETE SET NULL,
  plan_item_id TEXT,
  platform TEXT NOT NULL DEFAULT 'linkedin',
  content_type TEXT NOT NULL DEFAULT 'text_post',
  text_content TEXT NOT NULL DEFAULT '',
  carousel_images_json TEXT,
  slide_urls_json TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  blog_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  manus_task_id TEXT,
  published_url TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'linkedin',
  content_type TEXT NOT NULL DEFAULT 'text_post',
  status TEXT NOT NULL DEFAULT 'planned',
  manus_task_id TEXT,
  content_item_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  audio_file_id TEXT,
  tone_description TEXT NOT NULL DEFAULT '',
  style_notes TEXT NOT NULL DEFAULT '',
  key_phrases_json TEXT NOT NULL DEFAULT '[]',
  personality TEXT NOT NULL DEFAULT '',
  content_brief TEXT NOT NULL DEFAULT '',
  manus_task_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS manus_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  connectors_json TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  agent_type TEXT NOT NULL,
  messages_json TEXT NOT NULL DEFAULT '[]',
  root_company TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

  const manusCols = sqlite.prepare(`PRAGMA table_info(manus_tasks)`).all() as { name: string }[];
  if (!manusCols.some((c) => c.name === 'chat_id')) {
    sqlite.exec(`ALTER TABLE manus_tasks ADD COLUMN chat_id TEXT`);
  }
  if (!manusCols.some((c) => c.name === 'task_source')) {
    sqlite.exec(`ALTER TABLE manus_tasks ADD COLUMN task_source TEXT NOT NULL DEFAULT 'chat'`);
  }
  if (!manusCols.some((c) => c.name === 'target_plan_id')) {
    sqlite.exec(`ALTER TABLE manus_tasks ADD COLUMN target_plan_id TEXT`);
  }

  const voiceCols = sqlite.prepare(`PRAGMA table_info(voice_profiles)`).all() as { name: string }[];
  if (!voiceCols.some((c) => c.name === 'content_brief')) {
    sqlite.exec(`ALTER TABLE voice_profiles ADD COLUMN content_brief TEXT NOT NULL DEFAULT ''`);
  }
}
