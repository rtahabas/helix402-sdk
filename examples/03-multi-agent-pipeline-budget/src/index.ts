// Three agents, one pipeline, one shared budget.
//
// Create three agents in the Helix402 dashboard, assign all three to the SAME
// pipeline, and set the pipeline's daily_limit low (e.g. "0.20" USDC). Paste
// each agent's API key into .env. Run this file — you'll see the agents
// drive the pipeline total up in parallel, then get blocked together as soon
// as one of them trips the ceiling. "Breach once, everyone pauses."

import { createPaymentClient, Helix402Error } from "@helix402/agent-sdk";

const GATEWAY = process.env.HELIX_GATEWAY_URL ?? "https://api.rtahabas.com";
const MERCHANT_URL = process.env.MERCHANT_URL;

const agents = [
  { name: "researcher", apiKey: process.env.AGENT_RESEARCHER_KEY },
  { name: "writer", apiKey: process.env.AGENT_WRITER_KEY },
  { name: "reviewer", apiKey: process.env.AGENT_REVIEWER_KEY },
];

if (!MERCHANT_URL || agents.some((a) => !a.apiKey)) {
  console.error(
    "Set MERCHANT_URL and all three AGENT_*_KEY values — see .env.example.",
  );
  process.exit(1);
}

const CALLS_PER_AGENT = 20;

function describeError(err: unknown): string {
  if (err instanceof Helix402Error) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

async function runAgent(name: string, apiKey: string): Promise<void> {
  const { client } = createPaymentClient({
    gatewayUrl: GATEWAY,
    apiKey,
    network: "base-sepolia",
  });

  for (let i = 1; i <= CALLS_PER_AGENT; i++) {
    try {
      await client.get(`${MERCHANT_URL}/premium/quote`);
      console.log(`[${name}] call ${i}: ok`);
    } catch (err) {
      console.log(`[${name}] call ${i}: BLOCKED — ${describeError(err)}`);
      return; // stop on first block — pipeline is paused for everyone
    }
  }
  console.log(
    `[${name}] done — no block hit (consider lowering the pipeline daily_limit).`,
  );
}

console.log(
  `three agents hammering ${MERCHANT_URL}, shared pipeline budget...`,
);
const started = Date.now();

await Promise.all(agents.map((a) => runAgent(a.name, a.apiKey!)));

console.log(`\nfinished in ${Date.now() - started}ms`);
