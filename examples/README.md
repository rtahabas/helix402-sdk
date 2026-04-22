# Examples

Runnable examples for the Helix402 SDKs. Each folder is an independent
`npm` project — clone the repo, `cd` into one, `npm install && npm start`.

| #      | Folder                                                               | What it shows                                                                                                            | Requires                                                                   |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **01** | [`01-merchant-hello-world`](./01-merchant-hello-world)               | Express endpoint that returns HTTP 402 until a valid payment receipt arrives. Uses `@helix402/merchant-sdk`.             | A payout wallet on Base Sepolia + gateway JWT secret.                      |
| **02** | [`02-agent-autopay`](./02-agent-autopay)                             | Agent that auto-pays on 402 using managed-wallet mode, with client-side budget caps. Uses `@helix402/agent-sdk`.         | An agent API key from the dashboard + the merchant from 01.                |
| **03** | [`03-multi-agent-pipeline-budget`](./03-multi-agent-pipeline-budget) | **The core Helix402 demo** — three agents sharing one pipeline budget. When the ceiling trips, all three pause together. | Three agent API keys assigned to the same pipeline + the merchant from 01. |

## Suggested order

1. Start with **01** — prove the 402 wire format works for you with `curl`.
2. Add **02** — your first real settlement on testnet.
3. Run **03** — watch the pipeline-level enforcement that the rest of the
   product is built on.

## Common setup

All examples assume Node 20+ and a Helix402 dashboard account. If you
don't have one yet, see the [main repo](https://github.com/rtahabas/helix402)
for a self-host Docker Compose setup, or use the hosted gateway at
`https://api.rtahabas.com`.

Every example ships a `.env.example` — copy to `.env` and fill in the
values it lists. No example reads secrets from anywhere else.
