import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createPaymentRequiredMiddleware } from "../index";

const SECRET = "test-secret";
const WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const PRICE = "0.10"; // human-readable USDC
const PRICE_SMALLEST = "100000"; // smallest units (what JWT contains)
const RESOURCE = "/api/data";

function createApp() {
  const app = express();
  app.use(express.json());

  app.get(
    "/api/data",
    createPaymentRequiredMiddleware({
      price: PRICE,
      wallet: WALLET,
      gatewayPublicKey: SECRET,
      network: "base",
      resourceResolver: () => RESOURCE,
    }),
    (_req, res) => {
      res.json({ data: "premium content" });
    },
  );

  return app;
}

function makeToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      sub: WALLET,
      aud: "402-merchant",
      amount: PRICE_SMALLEST,
      resource: RESOURCE,
      jti: "test-jti",
      tx: "0x" + "b".repeat(64),
      quoteId: "test-quote",
      ...overrides,
    },
    SECRET,
    { issuer: "test-gateway", expiresIn: 60 },
  );
}

describe("PaymentRequired Middleware", () => {
  describe("no token", () => {
    it("should return 402 with payment metadata", async () => {
      const app = createApp();
      const res = await request(app).get("/api/data");

      expect(res.status).toBe(402);
      expect(res.body.error).toBe("Payment required");
      expect(res.body.price).toBe(PRICE_SMALLEST);
      expect(res.body.wallet).toBe(WALLET);
      expect(res.body.currency).toBe("USDC");
      expect(res.body.quoteId).toBeTruthy();
      expect(res.body.resource).toBe(RESOURCE);
    });
  });

  describe("valid token", () => {
    it("should pass through to handler", async () => {
      const app = createApp();
      const token = makeToken();
      const res = await request(app).get("/api/data").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBe("premium content");
    });
  });

  describe("invalid token", () => {
    it("should return 403 for wrong secret", async () => {
      const app = createApp();
      const token = jwt.sign(
        { sub: WALLET, aud: "402-merchant", amount: PRICE, resource: RESOURCE },
        "wrong-secret",
        { expiresIn: 60 },
      );
      const res = await request(app).get("/api/data").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Invalid receipt");
    });

    it("should return 403 for expired token", async () => {
      const app = createApp();
      const token = jwt.sign(
        { sub: WALLET, aud: "402-merchant", amount: PRICE, resource: RESOURCE },
        SECRET,
        { expiresIn: -10 },
      );
      const res = await request(app).get("/api/data").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("should return 403 for wrong merchant wallet", async () => {
      const app = createApp();
      const token = makeToken({ sub: "0x" + "1".repeat(40) });
      const res = await request(app).get("/api/data").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Receipt merchant mismatch");
    });

    it("should return 403 for wrong amount", async () => {
      const app = createApp();
      const token = makeToken({ amount: "999999" });
      const res = await request(app).get("/api/data").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Receipt amount mismatch");
    });

    it("should return 403 for wrong resource", async () => {
      const app = createApp();
      const token = makeToken({ resource: "/wrong/path" });
      const res = await request(app).get("/api/data").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Receipt resource mismatch");
    });
  });

  describe("constructor validation", () => {
    it("should throw if price is missing", () => {
      expect(() =>
        createPaymentRequiredMiddleware({
          price: "",
          wallet: WALLET,
          gatewayPublicKey: SECRET,
          network: "base",
        }),
      ).toThrow("price is required");
    });

    it("should throw if wallet is missing", () => {
      expect(() =>
        createPaymentRequiredMiddleware({
          price: PRICE,
          wallet: "",
          gatewayPublicKey: SECRET,
          network: "base",
        }),
      ).toThrow();
    });
  });
});
