import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getMessages, type DBMessage } from "../db/queries";
import { retrieveMemory } from "./memory";

const TOKEN_BUDGET = Number(process.env.TOKEN_BUDGET ?? 3000);
const RECENT_TURNS = Number(process.env.RECENT_TURNS_VERBATIM ?? 6);

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type CoreMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are a customer support assistant for a retail store chain.
You help customers look up orders, check inventory, get store info, and escalate issues to human agents when needed.
Always respond in Vietnamese, in a friendly and professional tone.
When an order is lost or has a serious issue, automatically call the escalateToHuman tool.
If a tool call fails, inform the customer politely and suggest trying again later.
When a tool parameter is optional, call the tool immediately without asking for clarification.`;

async function summarizeOldTurns(messages: DBMessage[]): Promise<string> {
  if (messages.length === 0) return "";
  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const { text } = await generateText({
    model: openai("gpt-4o"),
    system: "Summarize this conversation excerpt in 2-3 sentences in Vietnamese. Focus on key requests, decisions, and outcomes.",
    prompt: transcript,
    temperature: 0,
    maxTokens: 200,
  });
  return text;
}

export async function buildContext(
  conversationId: string
): Promise<{ system: string; messages: CoreMessage[] }> {
  const allMessages = await getMessages(conversationId);
  const memoryBlock = await retrieveMemory(conversationId);

  const system = SYSTEM_PROMPT + memoryBlock;
  const systemTokens = estimateTokens(system);
  let remaining = TOKEN_BUDGET - systemTokens;

  const conversationMessages = allMessages.filter((m) => m.role !== "tool");
  const recentStart = Math.max(0, conversationMessages.length - RECENT_TURNS);
  const oldTurns = conversationMessages.slice(0, recentStart);
  const recentTurns = conversationMessages.slice(recentStart);

  const result: CoreMessage[] = [];

  if (oldTurns.length > 0) {
    const summary = await summarizeOldTurns(oldTurns);
    const summaryMsg: CoreMessage = {
      role: "user",
      content: `[Previous conversation summary: ${summary}]`,
    };
    remaining -= estimateTokens(summaryMsg.content);
    result.push(summaryMsg);
  }

  for (const msg of recentTurns) {
    const tokens = estimateTokens(msg.content);
    if (tokens > remaining) break;
    remaining -= tokens;
    result.push({ role: msg.role as "user" | "assistant", content: msg.content });
  }

  return { system, messages: result };
}
