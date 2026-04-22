# 03 — Multi-Agent Pipeline Budget

The core Helix402 demo: three agents sharing a single pipeline budget. When
the aggregate spend hits the pipeline ceiling, **every** agent in that
pipeline gets blocked on its next call — not just the one that tripped it.

This is the mechanism the landing copy calls "breach once, everyone pauses."

## Prerequisites

1. The merchant from [`../01-merchant-hello-world`](../01-merchant-hello-world) running.
2. In the Helix402 dashboard:
   - Create a pipeline. Set `daily_limit` low enough that 20-30 calls will
     exceed it (e.g. `"0.20"` USDC at `0.01` USDC per call).
   - Create three agents. Assign all three to the pipeline you just made.
   - Copy each agent's API key into `.env`.
3. A small balance of test USDC on Base Sepolia for the managed wallets.

## Run it

```bash
cp .env.example .env
# paste the three agent keys + MERCHANT_URL
npm install
npm start
```

## Expected output

```
three agents hammering <merchant-url>, shared pipeline budget...
[researcher] call 1: ok
[writer]     call 1: ok
[reviewer]   call 1: ok
[researcher] call 2: ok
...
[writer]     call 7: ok
[researcher] call 8: BLOCKED — pipeline budget exceeded
[writer]     call 8: BLOCKED — pipeline budget exceeded
[reviewer]   call 8: BLOCKED — pipeline budget exceeded

finished in 4213ms
```

The exact call-count differs each run (depending on interleaving), but
all three agents block within milliseconds of one another — the
gateway enforces the ceiling atomically.

## What this proves

Any single agent could have stopped itself with a client-side counter.
What _can't_ be done client-side is **stopping the other two when the
first one trips the limit** — their processes have no knowledge of
each other. Only a shared primitive at the gateway layer can do that.
That shared primitive is `pipeline`.

## What's next

- Watch `pipeline_events` on the dashboard — you'll see a `budget_exceeded`
  event and a webhook delivery if one was configured.
- Resume the pipeline from the dashboard (status → `active`) and the
  agents' next calls flow again.
- Try `cycle_threshold` on the pipeline for the loop-detection cousin
  of this demo.
