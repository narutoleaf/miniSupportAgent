import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createTools, setSimulateFailure } from "./tools";
import { extractAndSaveMemory } from "./memory";
import { buildContext } from "./context";
import { saveMessage, logTurnMetrics } from "../db/queries";

export { setSimulateFailure };

export async function runTurn(
  conversationId: string,
  userMessage: string
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
    maxSteps: 5,
    temperature: 0.3,
  });

  let fullResponse = "";
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    fullResponse += chunk;
  }
  process.stdout.write("\n");

  const latencyMs = Date.now() - startTime;
  const usage = await result.usage;

  await saveMessage(conversationId, "assistant", fullResponse);

  await logTurnMetrics(
    conversationId,
    latencyMs,
    usage?.promptTokens ?? 0,
    usage?.completionTokens ?? 0
  );

  return fullResponse;
}
