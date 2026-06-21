export const spec = {
  openapi: "3.0.3",
  info: {
    title: "Store Support Agent API",
    description: "API for a tool-using customer support agent with persistent memory for retail store management.",
    version: "1.0.0",
  },
  servers: [{ url: "http://localhost:3000", description: "Local dev server" }],
  paths: {
    "/api/conversations": {
      get: {
        tags: ["Conversations"],
        summary: "List all conversations",
        operationId: "listConversations",
        responses: {
          "200": {
            description: "List of conversations with preview",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      created_at: { type: "string", format: "date-time" },
                      preview: { type: "string", nullable: true, example: "Hello, can you help me?" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Conversations"],
        summary: "Create a new conversation",
        operationId: "createConversation",
        responses: {
          "200": {
            description: "Conversation created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/conversations/{id}": {
      delete: {
        tags: ["Conversations"],
        summary: "Delete a conversation and all its data",
        operationId: "deleteConversation",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Conversation ID",
          },
        ],
        responses: {
          "200": {
            description: "Conversation deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { deleted: { type: "boolean", example: true } },
                },
              },
            },
          },
          "404": {
            description: "Conversation not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/conversations/{id}/messages": {
      get: {
        tags: ["Conversations"],
        summary: "Get all messages in a conversation",
        operationId: "getMessages",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Conversation ID",
          },
        ],
        responses: {
          "200": {
            description: "List of messages",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      role: { type: "string", enum: ["user", "assistant", "tool"] },
                      content: { type: "string" },
                      tool_call_id: { type: "string", nullable: true },
                      tool_name: { type: "string", nullable: true },
                      created_at: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Conversation not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/conversations/{id}/chat": {
      post: {
        tags: ["Chat"],
        summary: "Send a message and receive a streamed response (SSE)",
        description: "Sends a user message to the agent and streams the response back via Server-Sent Events. Each SSE event is a JSON object with `type` (chunk | done | error) and optional `content`.",
        operationId: "chat",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Conversation ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message: { type: "string", example: "Check order ORD-001 for me" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "SSE stream of agent response chunks",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  description: "Each line: `data: {\"type\":\"chunk\",\"content\":\"...\"}`\nFinal line: `data: {\"type\":\"done\"}`",
                  example: "data: {\"type\":\"chunk\",\"content\":\"Hello\"}\n\ndata: {\"type\":\"done\"}\n\n",
                },
              },
            },
          },
          "400": {
            description: "Invalid request (missing message)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Conversation not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/conversations/{id}/memory": {
      get: {
        tags: ["Memory"],
        summary: "Get long-term memory facts for a conversation",
        operationId: "getMemory",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Conversation ID",
          },
        ],
        responses: {
          "200": {
            description: "List of extracted memory facts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string", example: "customer_name" },
                      value: { type: "string", example: "David" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/simulate-failure": {
      post: {
        tags: ["Debug"],
        summary: "Toggle tool failure simulation",
        description: "When enabled, tool calls will throw simulated errors to test graceful failure handling.",
        operationId: "toggleFailure",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["enabled"],
                properties: {
                  enabled: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Failure simulation status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    simulateFailure: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Conversation not found" },
        },
      },
    },
  },
};
