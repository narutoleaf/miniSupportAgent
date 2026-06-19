import "dotenv/config";
import { evalCases, type EvalCase } from "./cases";
import { createConversation } from "../db/queries";
import { runTurn, setSimulateFailure } from "../agent";
import { db } from "../db/client";

type Result = {
  name: string;
  passed: boolean;
  failures: string[];
  durationMs: number;
};

async function checkAssertions(
  evalCase: EvalCase,
  responses: string[],
  conversationId: string
): Promise<string[]> {
  const failures: string[] = [];
  const allText = responses.join(" ");

  if (evalCase.assertions.responseContainsAny) {
    for (const group of evalCase.assertions.responseContainsAny) {
      const found = group.some((kw) => allText.toLowerCase().includes(kw.toLowerCase()));
      if (!found) {
        failures.push(`Response missing one of: [${group.join(", ")}]`);
      }
    }
  }

  if (evalCase.assertions.toolsCalled) {
    const { rows } = await db.query<{ tool_name: string }>(
      "SELECT DISTINCT tool_name FROM tool_call_logs WHERE conversation_id = $1",
      [conversationId]
    );
    const calledTools = rows.map((r) => r.tool_name);
    for (const expected of evalCase.assertions.toolsCalled) {
      if (!calledTools.includes(expected)) {
        failures.push(`Tool "${expected}" was not called (called: ${calledTools.join(", ") || "none"})`);
      }
    }
  }

  if (evalCase.assertions.memoryKeysExist) {
    const { rows } = await db.query<{ key: string }>(
      "SELECT key FROM long_term_memory WHERE conversation_id = $1",
      [conversationId]
    );
    const keys = rows.map((r) => r.key);
    for (const expected of evalCase.assertions.memoryKeysExist) {
      const found = keys.some((k) => k.toLowerCase().includes(expected.toLowerCase()));
      if (!found) {
        failures.push(`Memory key "${expected}" not found (keys: ${keys.join(", ") || "none"})`);
      }
    }
  }

  if (evalCase.assertions.toolErrorLogged) {
    const { rows } = await db.query(
      "SELECT 1 FROM tool_call_logs WHERE conversation_id = $1 AND error IS NOT NULL LIMIT 1",
      [conversationId]
    );
    if (rows.length === 0) {
      failures.push("No tool error was logged");
    }
  }

  return failures;
}

async function runEvalCase(evalCase: EvalCase): Promise<Result> {
  const start = Date.now();
  const failures: string[] = [];

  try {
    const conversationId = await createConversation();

    if (evalCase.simulateFailure) setSimulateFailure(true);
    else setSimulateFailure(false);

    const responses: string[] = [];
    for (const turn of evalCase.turns) {
      const response = await runTurn(conversationId, turn);
      responses.push(response);
    }

    setSimulateFailure(false);

    const assertionFailures = await checkAssertions(evalCase, responses, conversationId);
    failures.push(...assertionFailures);
  } catch (err) {
    if (evalCase.simulateFailure) {
      // Failure case should NOT crash — if it does, that's a real failure
      failures.push(`Agent crashed on simulated failure: ${err instanceof Error ? err.message : err}`);
    } else {
      failures.push(`Unexpected error: ${err instanceof Error ? err.message : err}`);
    }
  }

  return {
    name: evalCase.name,
    passed: failures.length === 0,
    failures,
    durationMs: Date.now() - start,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Store Support Agent — Eval Suite");
  console.log("=".repeat(60));
  console.log(`Running ${evalCases.length} test cases...\n`);

  const results: Result[] = [];

  for (const evalCase of evalCases) {
    process.stdout.write(`  [RUN] ${evalCase.name} — ${evalCase.description}...`);
    const result = await runEvalCase(evalCase);
    results.push(result);

    if (result.passed) {
      console.log(` PASS (${result.durationMs}ms)`);
    } else {
      console.log(` FAIL (${result.durationMs}ms)`);
      for (const f of result.failures) {
        console.log(`        -> ${f}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`  Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log("=".repeat(60));

  await db.end();
  process.exit(failed > 0 ? 1 : 0);
}

main();
