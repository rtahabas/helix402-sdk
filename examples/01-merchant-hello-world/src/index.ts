// Minimal Helix402 merchant: one endpoint, priced at 0.01 USDC per call.
//
// On first request the middleware returns HTTP 402 with the payment requirements.
// An agent (see ../02-agent-autopay) then pays via the gateway and retries with
// a JWT receipt — the middleware verifies and hands control to the handler.

import express from "express";
import { createPaymentRequiredMiddleware } from "@helix402/merchant-sdk";

const PORT = Number(process.env.PORT ?? 4000);
const WALLET = process.env.MERCHANT_WALLET;
const JWT_KEY = process.env.GATEWAY_JWT_SECRET;
const FACILITATOR = process.env.FACILITATOR_URL ?? "https://api.rtahabas.com";

if (!WALLET || !JWT_KEY) {
  console.error(
    "Set MERCHANT_WALLET and GATEWAY_JWT_SECRET — see .env.example.",
  );
  process.exit(1);
}

const app = express();

app.get(
  "/premium/quote",
  createPaymentRequiredMiddleware({
    price: "0.01",
    wallet: WALLET,
    network: "base-sepolia",
    gatewayPublicKey: JWT_KEY,
    facilitatorUrl: FACILITATOR,
  }),
  (req, res) => {
    res.json({
      quote: 42.17,
      paidBy: req.paymentReceipt?.sub,
      ts: new Date().toISOString(),
    });
  },
);

app.listen(PORT, () => {
  console.log(`merchant listening on port ${PORT}`);
  console.log(`  GET /premium/quote  -> 402 Payment Required (0.01 USDC)`);
});
