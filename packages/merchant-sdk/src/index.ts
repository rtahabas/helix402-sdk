/**
 * @module @helix402/merchant-sdk
 *
 * x402 payment middleware for Express.
 * Returns 402 with PAYMENT-REQUIRED header for unpaid requests.
 * Validates JWT receipts for paid requests.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { PaymentRequiredOptions, PaymentReceipt, PaidRequest, isValidAddress } from "./types";

const USDC_DECIMALS = 6;

/** Convert human-readable USDC to smallest units. "0.10" → "100000" */
function parseUSDCPrice(amount: string): string {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  const result = BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(frac);
  if (result <= 0n) throw new Error(`Invalid price: "${amount}"`);
  return result.toString();
}

/**
 * Creates Express middleware that requires x402 payment.
 *
 * @example
 * ```typescript
 * app.get("/api/data",
 *   createPaymentRequiredMiddleware({
 *     price: "0.10",          // 0.1 USDC
 *     wallet: "0xYourWallet",
 *     gatewayPublicKey: process.env.JWT_SECRET,
 *     network: "base",
 *   }),
 *   (req, res) => res.json({ data: "premium" })
 * );
 * ```
 */
export function createPaymentRequiredMiddleware(options: PaymentRequiredOptions) {
  const {
    price,
    wallet,
    currency = "USDC",
    asset,
    network,
    gatewayPublicKey,
    facilitatorUrl,
    audience = "402-merchant",
    maxTimeoutSeconds = 300,
    resourceResolver = (req: Request) => req.originalUrl,
  } = options;

  // ─── Validate ───────────────────────────────────────────

  if (!price) throw new Error("PaymentRequiredMiddleware: price is required");
  if (!network)
    throw new Error("PaymentRequiredMiddleware: network is required (e.g. 'base', 'base-sepolia')");
  if (!wallet) throw new Error("PaymentRequiredMiddleware: wallet is required");
  if (!isValidAddress(wallet))
    throw new Error(`PaymentRequiredMiddleware: invalid wallet "${wallet}"`);
  if (!gatewayPublicKey) throw new Error("PaymentRequiredMiddleware: gatewayPublicKey is required");

  // Convert human-readable price to smallest units
  const priceSmallestUnits = parseUSDCPrice(String(price));
  const normalizedWallet = wallet.toLowerCase();

  return function paymentRequired(req: PaidRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const resource = resourceResolver(req);

    if (!token) {
      const paymentRequired = {
        x402Version: "1",
        resource,
        accepts: [
          {
            scheme: "exact",
            network,
            amount: priceSmallestUnits,
            asset: asset || "",
            payTo: wallet,
            maxTimeoutSeconds,
            facilitatorUrl: facilitatorUrl || undefined,
            extra: { currency, resource },
          },
        ],
      };

      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
      res.set("payment-required", encoded);
      if (facilitatorUrl) res.set("x-payment-facilitator", facilitatorUrl);

      return res.status(402).json({
        error: "Payment required",
        price: priceSmallestUnits,
        wallet,
        currency,
        quoteId: randomUUID(),
        resource,
        x402Version: "1",
        scheme: "exact",
        network,
        asset: asset || "",
        maxTimeoutSeconds,
        facilitatorUrl: facilitatorUrl || undefined,
      });
    }

    // ─── Verify JWT receipt ─────────────────────────────

    try {
      const payload = jwt.verify(token, gatewayPublicKey, { audience }) as PaymentReceipt;

      if (String(payload.sub).toLowerCase() !== normalizedWallet) {
        return res.status(403).json({ error: "Receipt merchant mismatch" });
      }

      try {
        if (BigInt(payload.amount) !== BigInt(priceSmallestUnits)) {
          return res.status(403).json({ error: "Receipt amount mismatch" });
        }
      } catch {
        return res.status(403).json({ error: "Receipt amount invalid" });
      }

      if (String(payload.resource) !== resource) {
        return res.status(403).json({ error: "Receipt resource mismatch" });
      }

      req.paymentReceipt = payload;
      return next();
    } catch (error: unknown) {
      const isExpired = error instanceof jwt.TokenExpiredError;
      return res.status(403).json({ error: isExpired ? "Receipt expired" : "Invalid receipt" });
    }
  };
}

export { PaymentRequiredOptions, PaymentReceipt, PaidRequest, isValidAddress } from "./types";
