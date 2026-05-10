-- Tripzi AI Chat History Schema (Cloudflare D1 / SQLite)
-- Retention: 30 days (enforced by scheduled cleanup)

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_conv_user_updated
  ON ai_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_msg_conversation_created
  ON ai_messages(conversation_id, created_at ASC);

-- Index for 30-day cleanup queries
CREATE INDEX IF NOT EXISTS idx_conv_updated
  ON ai_conversations(updated_at);
