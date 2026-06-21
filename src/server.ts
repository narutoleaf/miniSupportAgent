import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { createConversation, conversationExists, listConversations, deleteConversation, getMessages, getMemory } from "./db/queries";
import { runTurn, setSimulateFailure } from "./agent";
import { spec } from "./openapi";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "../public")));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));

// List all conversations
app.get("/api/conversations", async (_req, res) => {
  const convs = await listConversations();
  res.json(convs);
});

// Create a new conversation
app.post("/api/conversations", async (_req, res) => {
  const id = await createConversation();
  res.json({ id });
});

// Delete a conversation
app.delete("/api/conversations/:id", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }
  if (!(await conversationExists(id))) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  await deleteConversation(id);
  res.json({ deleted: true });
});

// Get conversation messages
app.get("/api/conversations/:id/messages", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }
  if (!(await conversationExists(id))) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await getMessages(id);
  res.json(messages);
});

// Get conversation memory
app.get("/api/conversations/:id/memory", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }
  const facts = await getMemory(id);
  res.json(facts);
});

// Toggle failure simulation
app.post("/api/simulate-failure", (req, res) => {
  const { enabled } = req.body;
  setSimulateFailure(!!enabled);
  res.json({ simulateFailure: !!enabled });
});

// Chat endpoint with SSE streaming
app.post("/api/conversations/:id/chat", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!UUID_RE.test(id)) { res.status(400).json({ error: "Invalid conversation ID" }); return; }

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` });
    return;
  }

  if (!(await conversationExists(id))) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    await runTurn(id, message, (event) => {
      if (event.type === "text-delta") {
        res.write(`data: ${JSON.stringify({ type: "chunk", content: event.content })}\n\n`);
      } else if (event.type === "tool-call") {
        res.write(`data: ${JSON.stringify({ type: "tool-call", toolName: event.toolName, args: event.args })}\n\n`);
      } else if (event.type === "tool-result") {
        res.write(`data: ${JSON.stringify({ type: "tool-result", toolName: event.toolName, result: event.result })}\n\n`);
      }
    });
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ type: "error", content: errorMsg })}\n\n`);
  }

  res.end();
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API docs at http://localhost:${PORT}/api-docs`);
});
