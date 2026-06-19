# Notes

## Design Decisions

- **GPT-4o-mini for memory extraction**: The main agent uses GPT-4o, but fact extraction is a simple JSON task. Using gpt-4o-mini reduces latency, cost, and rate-limit pressure without sacrificing quality.
- **Token estimation via char count**: Uses `ceil(text.length / 4)` instead of a tokenizer library. This is a reasonable approximation for mixed-language content and avoids an extra dependency.
- **Simulated data instead of a real database**: Tools return hardcoded order/inventory/store data. This keeps the scope focused on the agent architecture rather than CRUD operations.
- **Memory parsing flexibility**: The extraction model sometimes returns `{key: value}` pairs instead of `{key, value}` objects. The parser handles both formats to be robust against LLM output variation.
- **Sequential eval execution**: Eval cases run sequentially to avoid OpenAI rate limits. Parallel execution would be faster but risks 429 errors on lower-tier API keys.

## Known Limitations

- **No authentication or multi-user support**: All conversations are accessible to anyone with the UUID. No user accounts or access control.
- **No semantic memory search**: Memory retrieval loads all facts for a conversation. For conversations with hundreds of facts, a vector-based search (pgvector) would be needed.
- **Token budget is approximate**: The `ceil(length/4)` heuristic can be off by 20-30% for non-Latin scripts (Vietnamese, CJK). A proper tokenizer like `tiktoken` would be more accurate.
- **No streaming in eval runner**: The eval runner captures full responses but doesn't validate streaming behavior itself.
- **Simulated tools only**: No real order management system, inventory database, or ticketing integration.
- **Single-process**: No horizontal scaling, no queue-based processing. The agent runs in a single Node.js process.

## What I'd Build Next

- **Web UI**: Replace the CLI with a Next.js frontend with real-time streaming via Server-Sent Events.
- **pgvector for memory**: Embed facts with OpenAI embeddings and do cosine-similarity retrieval for relevant memory, especially across conversations.
- **Real tool integrations**: Connect to Shopify/WooCommerce for orders, a real inventory system, and a ticketing system (Zendesk, Linear).
- **Conversation summarization on close**: When a conversation ends, generate and store a summary for faster future context loading.
- **Multi-tenant support**: User authentication, conversation ownership, and per-user memory isolation.
- **Observability**: OpenTelemetry integration with traces for each turn (LLM call, tool calls, memory extraction as child spans).
- **Retry with backoff for tool failures**: Instead of immediate failure, retry transient errors with exponential backoff before informing the user.
