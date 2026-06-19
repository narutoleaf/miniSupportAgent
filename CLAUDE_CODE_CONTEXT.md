# Context Prompt — Paste this into Claude Code

I'm doing a 3-day challenge to build a **Tool-Using Support Agent with Persistent Memory**. Help me build this from scratch, in TypeScript, following the spec below exactly. Don't add scope beyond what's listed — if something is ambiguous, ask me or make the simplest reasonable choice and note the assumption in NOTES.md.

## Goal

Build a support agent that:
- Holds multi-turn conversations
- Calls tools
- Remembers facts across turns — **including after the process restarts**
- Degrades gracefully when things fail

## Hard Stack Constraints

- **TypeScript** throughout (no JS files)
- **Postgres** for ALL persistence (conversation history, memory, logs). `pgvector` extension is allowed if needed for semantic memory retrieval, but **no external vector database** (no Pinecone, Weaviate, Qdrant, etc.)
- **Vercel AI SDK** for model calls, tool orchestration, and streaming — don't hand-roll a separate orchestration layer

## Functional Scope (must all be satisfied)

1. **Multi-turn conversation persistence**
   - Conversations tied to a `conversation_id`
   - Full message history persisted in Postgres (not in-memory, not in a file)
   - Resuming a conversation after restart should work seamlessly

2. **Tool calling — at least 3 tools, including one multi-step chain**
   - Implement at least 3 distinct tools
   - At least one tool *chain* where one tool's output triggers another, e.g. `lookupOrderStatus` → `escalateToHuman`
   - Use Vercel AI SDK's tool-calling primitives for this

3. **Long-term memory extraction & retrieval**
   - Extract facts/preferences mentioned mid-conversation (e.g. "I prefer email over phone", "my order number is X")
   - Store them in Postgres as long-term memory (separate from raw message history)
   - Retrieve and apply them in later turns
   - Must survive a process/server restart — memory is not allowed to live only in process memory

4. **Context reconstruction within a token budget**
   - When resuming a long-running conversation, don't just dump the entire history into the prompt
   - Implement a strategy to reconstruct relevant context within a defined token budget (e.g. summarization of older turns + recent verbatim turns + relevant long-term memory facts)

5. **Graceful tool failure handling**
   - Simulate/detect a failing tool call
   - Must NOT crash the agent or the conversation
   - Log the failure (to Postgres, queryable)
   - Inform the user in a natural way
   - Conversation must recover and continue afterward

6. **Latency & token usage logging**
   - Log latency (ms) and token usage (input/output) **per turn**
   - Stored in Postgres in a queryable form (a proper table, not just console logs)

7. **Eval suite**
   - Self-authored suite of 5–10 eval cases
   - A runner script that executes them
   - Output a pass/fail summary

## Deliverables / Submission Artifacts (I need all of these by the end)

- [ ] GitHub repository (public or invite-based) — initialize git from the start, commit incrementally
- [ ] `README.md` — setup/run instructions (env setup, DB migration, how to start, how to chat with the agent)
- [ ] Database schema as SQL migration files (or a single `schema.sql`)
- [ ] `.env.example` listing all required environment variables
- [ ] Eval test cases + runner script, with a results output / pass-fail summary
- [ ] Architecture diagram — image or text-based (e.g. Mermaid) is fine
- [ ] Short demo video (≤5 min) showing:
  - a multi-turn conversation with memory recall
  - a tool-chain triggering escalation logic
  - at least one gracefully handled tool failure
- [ ] `NOTES.md` (or a section in README) — known limitations + what you'd build next with more time

## How I want to work with you (Claude Code)

1. First, propose a concrete architecture (folder structure, Postgres schema sketch, which AI SDK primitives we'll use for tools/streaming/memory) — keep it as lean as possible while still satisfying every item above. Don't over-engineer.
2. Then scaffold the project: package.json, tsconfig, Postgres connection/migration setup, `.env.example`.
3. Build the Postgres schema first (conversations, messages, long_term_memory/facts, tool_call_logs, turn_metrics) since everything else depends on it.
4. Implement tools (incl. the chain) using the Vercel AI SDK.
5. Implement memory extraction + retrieval + context reconstruction within a token budget.
6. Implement failure handling for a tool call (deliberately simulate a failure path) with logging + graceful recovery.
7. Add latency/token logging per turn.
8. Write the 5–10 eval cases + runner script.
9. Write README.md, NOTES.md, and the architecture diagram (Mermaid is fine, inline in README or its own file).
10. Tell me clearly when it's time for me to record the demo video and what 3 things the demo needs to show.

Stay strictly within this scope — no extra features, no swapping out Postgres or the Vercel AI SDK for anything else. Confirm you understand the full spec before writing any code, and ask me anything that's genuinely ambiguous (e.g. which LLM provider/model to call through the AI SDK, if I haven't told you).
