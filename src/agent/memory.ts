import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { upsertMemory, getMemory, type MemoryFact } from "../db/queries";

const EXTRACTION_PROMPT = `Extract key facts from a customer support message. Return a JSON array of {key, value} objects.
Use these exact keys when applicable:
- customer_name (any name the user gives)
- preferred_contact (email, phone, etc.)
- order_number (e.g. ORD-001)
- preferred_store (e.g. store-hcm)
- complaint_topic (main issue)
Always extract a name if the user introduces themselves. Always extract contact preference if stated.
If nothing to extract, return [].
Return ONLY the JSON array.`;

export async function extractAndSaveMemory(
  conversationId: string,
  userMessage: string
): Promise<void> {
  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: EXTRACTION_PROMPT,
      prompt: userMessage,
      temperature: 0,
      maxTokens: 300,
    });

    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed: unknown[] = JSON.parse(cleaned);
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, string>;
      if (obj.key && obj.value) {
        await upsertMemory(conversationId, obj.key, obj.value);
      } else {
        const entries = Object.entries(obj);
        for (const [k, v] of entries) {
          if (k && v) await upsertMemory(conversationId, k, String(v));
        }
      }
    }
  } catch (err) {
    console.error("[memory] extraction error:", err instanceof Error ? err.message : err);
  }
}

export async function retrieveMemory(conversationId: string): Promise<string> {
  const facts = await getMemory(conversationId);
  if (facts.length === 0) return "";
  const lines = facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");
  return `\n## Known facts about this customer\n${lines}\n`;
}
