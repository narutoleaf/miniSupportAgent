# Notes

## Design Decisions

- **Vercel AI SDK v6**: Uses the latest stable AI SDK (`ai@6.0.2`) with `inputSchema` for tool definitions, `stepCountIs()` for tool chaining, and `fullStream` for streaming tool call events.
- **GPT-4o-mini for memory extraction**: The main agent uses GPT-4o, but fact extraction is a simple JSON task. Using gpt-4o-mini reduces latency, cost, and rate-limit pressure without sacrificing quality.
- **Token estimation via char count**: Uses `ceil(text.length / 4)` instead of a tokenizer library. This is a reasonable approximation and avoids an extra dependency.
- **Simulated data instead of a real database**: Tools return hardcoded order/inventory/store data. This keeps the scope focused on the agent architecture rather than CRUD operations.
- **Memory parsing flexibility**: The extraction model sometimes returns `{key: value}` pairs instead of `{key, value}` objects. The parser handles both formats to be robust against LLM output variation.
- **Sequential eval execution**: Eval cases run sequentially to avoid OpenAI rate limits. Parallel execution would be faster but risks 429 errors on lower-tier API keys.
- **Express + vanilla HTML for Web UI**: Chose a simple static HTML page served by Express over a React/Next.js frontend. Keeps the project lean and avoids a separate build step for the frontend.
- **SSE for streaming**: Server-Sent Events over a POST response for real-time streaming. Simpler than WebSockets for a unidirectional stream, and natively supported by browsers.
- **Tool call visualization**: The `fullStream` API from Vercel AI SDK emits `tool-call` and `tool-result` events, which are forwarded as SSE events and rendered as visual indicators (spinner → checkmark) in the chat UI.
- **Markdown rendering with DOMPurify**: Assistant responses are rendered as markdown using `marked` and sanitized via `DOMPurify` to prevent XSS from model-generated content.
- **ts-node with --transpileOnly**: AI SDK v6 type definitions are large enough to cause out-of-memory errors in ts-node's type checker. All dev scripts use `--transpileOnly` to skip runtime type checking; type safety is verified separately via `npm run typecheck`.
- **Docker auto-migration**: `schema.sql` is mounted into Docker's `docker-entrypoint-initdb.d` directory, so the database schema is applied automatically on first container start — no separate migration step needed.

## Security Measures

- **SQL injection**: All Postgres queries use parameterized placeholders (`$1`, `$2`...) — no string concatenation.
- **XSS**: All user-controlled content (conversation previews, tool args, memory facts) is escaped via `textContent`-based helper before `innerHTML` insertion. Markdown output is sanitized via DOMPurify.
- **Input validation**: Route params validated as UUID format. Message length capped at 2000 chars. Request body limited to 16kb.
- **Prompt injection**: System prompt includes explicit guardrails — the agent is instructed to never reveal its instructions, never change role, and to treat memory facts as data (not instructions).

## Known Limitations

- **No authentication or multi-user support**: All conversations are accessible to anyone with the UUID. No user accounts or access control.
- **No semantic memory search**: Memory retrieval loads all facts for a conversation. For conversations with hundreds of facts, a vector-based search (pgvector) would be needed.
- **Token budget is approximate**: The `ceil(length/4)` heuristic can be off by 20-30%. A proper tokenizer like `tiktoken` would be more accurate.
- **No streaming in eval runner**: The eval runner captures full responses but doesn't validate streaming behavior itself.
- **Simulated tools only**: No real order management system, inventory database, or ticketing integration.
- **Single-process**: No horizontal scaling, no queue-based processing. The agent runs in a single Node.js process.
- **No rate limiting on API**: The Express server has no request rate limiting. In production, a middleware like `express-rate-limit` would be needed.

## What I'd Build Next

- **pgvector for memory**: Embed facts with OpenAI embeddings and do cosine-similarity retrieval for relevant memory, especially across conversations.
- **Real tool integrations**: Connect to Shopify/WooCommerce for orders, a real inventory system, and a ticketing system (Zendesk, Linear).
- **Conversation summarization on close**: When a conversation ends, generate and store a summary for faster future context loading.
- **Multi-tenant support**: User authentication, conversation ownership, and per-user memory isolation.
- **Observability**: OpenTelemetry integration with traces for each turn (LLM call, tool calls, memory extraction as child spans). Vercel AI SDK supports `experimental_telemetry` for this.
- **Retry with backoff for tool failures**: Instead of immediate failure, retry transient errors with exponential backoff before informing the user.
- **Rate limiting**: Add `express-rate-limit` middleware to protect against abuse.
- **Proper tokenizer**: Replace the char-count heuristic with `tiktoken` for accurate token budgeting.
- **React frontend**: Replace vanilla HTML with a React/Next.js app for better component reuse, state management, and mobile responsiveness.
