import { streamText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createTools, setSimulateFailure } from "./tools";
import { extractAndSaveMemory } from "./memory";
import { buildContext } from "./context";
import { saveMessage, logTurnMetrics } from "../db/queries";

export { setSimulateFailure };

export type AgentEvent =
  | { type: "text-delta"; content: string }
  | { type: "tool-call"; toolName: string; args: Record<string, unknown> }
  | { type: "tool-result"; toolName: string; result: unknown };

export async function runTurn(
  conversationId: string,
  userMessage: string,
  onEvent?: (event: AgentEvent) => void
): Promise<string> {
  await saveMessage(conversationId, "user", userMessage);

  await extractAndSaveMemory(conversationId, userMessage);

  const { system, messages } = await buildContext(conversationId);

  const startTime = Date.now();

  const result = await streamText({
    model: openai("gpt-4o"),
    system,
    messages,
    tools: createTools(conversationId),
    stopWhen: stepCountIs(5),
    temperature: 0.3,
  });

  let fullResponse = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      if (onEvent) {
        onEvent({ type: "text-delta", content: part.text });
      } else {
        process.stdout.write(part.text);
      }
      fullResponse += part.text;
    } else if (part.type === "tool-call") {
      if (onEvent) {
        onEvent({ type: "tool-call", toolName: part.toolName, args: part.input as Record<string, unknown> });
      }
    } else if (part.type === "tool-result") {
      if (onEvent) {
        onEvent({ type: "tool-result", toolName: part.toolName, result: part.output });
      }
    }
  }

  if (!onEvent) process.stdout.write("\n");

  const latencyMs = Date.now() - startTime;
  const usage = await result.usage;

  await saveMessage(conversationId, "assistant", fullResponse);

  await logTurnMetrics(
    conversationId,
    latencyMs,
    usage?.inputTokens ?? 0,
    usage?.outputTokens ?? 0
  );

  return fullResponse;
}
