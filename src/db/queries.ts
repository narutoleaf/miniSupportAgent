import { db } from "./client";

// ── Conversations ─────────────────────────────────────────────────────────────

export async function createConversation(metadata: Record<string, unknown> = {}) {
  const res = await db.query<{ id: string }>(
    "INSERT INTO conversations (metadata) VALUES ($1) RETURNING id",
    [JSON.stringify(metadata)]
  );
  return res.rows[0].id;
}

export async function listConversations() {
  const res = await db.query<{ id: string; created_at: Date; preview: string | null }>(
    `SELECT c.id, c.created_at,
       (SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) AS preview
     FROM conversations c ORDER BY c.created_at DESC LIMIT 50`
  );
  return res.rows;
}

export async function deleteConversation(conversationId: string) {
  await db.query("DELETE FROM conversations WHERE id = $1", [conversationId]);
}

export async function conversationExists(conversationId: string) {
  const res = await db.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM conversations WHERE id = $1) AS exists",
    [conversationId]
  );
  return res.rows[0].exists;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export type DBMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: Date;
};

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant" | "tool",
  content: string,
  toolCallId?: string,
  toolName?: string
) {
  await db.query(
    `INSERT INTO messages (conversation_id, role, content, tool_call_id, tool_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [conversationId, role, content, toolCallId ?? null, toolName ?? null]
  );
}

export async function getMessages(conversationId: string): Promise<DBMessage[]> {
  const res = await db.query<DBMessage>(
    `SELECT id, role, content, tool_call_id, tool_name, created_at
     FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return res.rows;
}

// ── Long-term memory ──────────────────────────────────────────────────────────

export type MemoryFact = { key: string; value: string };

export async function upsertMemory(conversationId: string, key: string, value: string) {
  await db.query(
    `INSERT INTO long_term_memory (conversation_id, key, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [conversationId, key, value]
  );
}

export async function getMemory(conversationId: string): Promise<MemoryFact[]> {
  const res = await db.query<MemoryFact>(
    "SELECT key, value FROM long_term_memory WHERE conversation_id = $1 ORDER BY created_at ASC",
    [conversationId]
  );
  return res.rows;
}

// ── Tool call logs ────────────────────────────────────────────────────────────

export async function logToolCall(
  conversationId: string,
  toolName: string,
  input: unknown,
  output: unknown | null,
  error: string | null,
  durationMs: number
) {
  await db.query(
    `INSERT INTO tool_call_logs (conversation_id, tool_name, input, output, error, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      conversationId,
      toolName,
      JSON.stringify(input),
      output !== null ? JSON.stringify(output) : null,
      error,
      durationMs,
    ]
  );
}

// ── Turn metrics ──────────────────────────────────────────────────────────────

export async function logTurnMetrics(
  conversationId: string,
  latencyMs: number,
  inputTokens: number,
  outputTokens: number
) {
  await db.query(
    `INSERT INTO turn_metrics (conversation_id, latency_ms, input_tokens, output_tokens)
     VALUES ($1, $2, $3, $4)`,
    [conversationId, latencyMs, inputTokens, outputTokens]
  );
}
