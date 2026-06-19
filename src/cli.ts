import "dotenv/config";
import * as readline from "readline";
import { createConversation, conversationExists } from "./db/queries";
import { runTurn, setSimulateFailure } from "./agent";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function main() {
  console.log("=".repeat(50));
  console.log("  Store Support Agent");
  console.log("=".repeat(50));
  console.log("  /new          — Start a new conversation");
  console.log("  /resume <id>  — Resume an existing conversation");
  console.log("  /fail on/off  — Toggle tool failure simulation");
  console.log("  /quit         — Exit");
  console.log("=".repeat(50));

  let conversationId: string | null = null;

  while (true) {
    const prefix = conversationId ? `[${conversationId.slice(0, 8)}]` : "[no session]";
    const input = await prompt(`\n${prefix} You: `);
    const trimmed = input.trim();

    if (!trimmed) continue;

    if (trimmed === "/quit") {
      console.log("Goodbye!");
      break;
    }

    if (trimmed === "/new") {
      conversationId = await createConversation();
      console.log(`New session created: ${conversationId}`);
      continue;
    }

    if (trimmed.startsWith("/resume ")) {
      const id = trimmed.slice(8).trim();
      if (await conversationExists(id)) {
        conversationId = id;
        console.log(`Resumed session: ${conversationId}`);
      } else {
        console.log("Session not found.");
      }
      continue;
    }

    if (trimmed === "/fail on") {
      setSimulateFailure(true);
      console.log("Simulate failure: ON — tool calls will fail.");
      continue;
    }

    if (trimmed === "/fail off") {
      setSimulateFailure(false);
      console.log("Simulate failure: OFF — normal operation.");
      continue;
    }

    if (!conversationId) {
      console.log("Start a new session (/new) or resume an existing one (/resume <id>) first.");
      continue;
    }

    try {
      process.stdout.write("\nAssistant: ");
      await runTurn(conversationId, trimmed);
    } catch (err) {
      console.error("\nError:", err instanceof Error ? err.message : err);
    }
  }

  rl.close();
  process.exit(0);
}

main();
