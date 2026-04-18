/* eslint-disable max-lines */
/**
 * @module @helix402/agent-sdk/langchain
 *
 * LangChain tool adapters for Helix402 x402 payments.
 * Gives any LangChain agent the ability to discover, pay for, and consume paid APIs.
 *
 * @example
 * ```typescript
 * import { createHelix402Tools } from "@helix402/agent-sdk/langchain";
 *
 * const tools = createHelix402Tools({
 *   gatewayUrl: "https://gateway.helix402.com",
 *   apiKey: process.env.HELIX_API_KEY!,
 *   network: "base",
 * });
 *
 * const agent = createReactAgent({ llm, tools: [...myTools, ...tools] });
 * ```
 */

import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  createPaymentClient,
  getServices,
  getPlans,
  subscribe,
  getCredits,
} from "./index";
import type { PaymentClientOptions, PaymentClientResult } from "./types";

// ─── Options ────────────────────────────────────────────────────

export interface Helix402ToolsOptions {
  /** Helix402 gateway URL. */
  gatewayUrl: string;
  /** Agent API key (managed wallet mode). */
  apiKey: string;
  /** Network identifier (e.g. "base", "base-sepolia"). */
  network: string;
  /** Base URL of the merchant/service to call. If omitted, call_paid_api expects full URLs. */
  merchantBaseUrl?: string;
  /** Budget policy override. */
  budgetPolicy?: { maxSpendPerCall?: string; dailyLimit?: string };
}

// ─── Tool Implementations ───────────────────────────────────────

class DiscoverServicesTool extends StructuredTool {
  name = "helix402_discover_services";
  description =
    "Discover available paid API services on the Helix402 marketplace. " +
    "Returns service names, descriptions, endpoints, and prices. " +
    "Use this to find what data sources are available before making paid calls.";
  schema = z.object({
    search: z
      .string()
      .optional()
      .describe("Optional search term to filter services"),
  });

  private gatewayUrl: string;

  constructor(gatewayUrl: string) {
    super();
    this.gatewayUrl = gatewayUrl;
  }

  async _call(input: { search?: string }): Promise<string> {
    try {
      const result = await getServices(this.gatewayUrl, input.search);
      return JSON.stringify(result, null, 2);
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }
}

class CallPaidApiTool extends StructuredTool {
  name = "helix402_call_paid_api";
  description =
    "Make a paid API call through the Helix402 x402 payment gateway. " +
    "Payment is handled automatically — if the API requires payment (HTTP 402), " +
    "USDC is signed and settled on-chain, then the request retries with a receipt. " +
    "The cost is deducted from your agent's budget.";
  schema = z.object({
    method: z.enum(["GET", "POST"]).describe("HTTP method"),
    url: z.string().describe("Full URL or path to the API endpoint"),
    params: z
      .record(z.string(), z.string())
      .optional()
      .describe("Query parameters for GET, or body for POST"),
  });

  private payment: PaymentClientResult;
  private merchantBaseUrl?: string;

  constructor(payment: PaymentClientResult, merchantBaseUrl?: string) {
    super();
    this.payment = payment;
    this.merchantBaseUrl = merchantBaseUrl;
  }

  async _call(input: {
    method: string;
    url: string;
    params?: Record<string, string>;
  }): Promise<string> {
    try {
      const url =
        this.merchantBaseUrl && !input.url.startsWith("http")
          ? `${this.merchantBaseUrl}${input.url}`
          : input.url;

      const budgetBefore = this.payment.budget.getState().dailySpent;

      const response =
        input.method === "POST"
          ? await this.payment.client.post(url, input.params)
          : await this.payment.client.get(url, { params: input.params });

      const budgetAfter = this.payment.budget.getState().dailySpent;
      const cost = BigInt(budgetAfter) - BigInt(budgetBefore);

      const result: Record<string, unknown> = {
        status: response.status,
        data: response.data,
      };
      if (cost > 0n) {
        result.paymentMade = true;
        result.costUnits = cost.toString();
      }

      return JSON.stringify(result, null, 2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: message });
    }
  }
}

class CheckBudgetTool extends StructuredTool {
  name = "helix402_check_budget";
  description =
    "Check your current spending budget on Helix402. " +
    "Returns daily spend, daily limit, and remaining budget. " +
    "Use this before expensive calls to make cost-effective decisions.";
  schema = z.object({});

  private payment: PaymentClientResult;
  private apiKey: string;
  private gatewayUrl: string;

  constructor(
    payment: PaymentClientResult,
    apiKey: string,
    gatewayUrl: string,
  ) {
    super();
    this.payment = payment;
    this.apiKey = apiKey;
    this.gatewayUrl = gatewayUrl;
  }

  async _call(): Promise<string> {
    try {
      const budgetState = this.payment.budget.getState();
      const credits = await getCredits(this.gatewayUrl, this.apiKey).catch(
        () => null,
      );

      return JSON.stringify(
        {
          dailySpent: budgetState.dailySpent,
          lastDay: budgetState.lastDay,
          ...(credits ? { subscriptions: credits.summary } : {}),
        },
        null,
        2,
      );
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }
}

class GetPlansTool extends StructuredTool {
  name = "helix402_get_plans";
  description =
    "List available subscription plans on Helix402. " +
    "Plans offer prepaid credits at a fixed price — often cheaper than per-call payments.";
  schema = z.object({
    serviceId: z.string().optional().describe("Filter plans by service ID"),
  });

  private gatewayUrl: string;

  constructor(gatewayUrl: string) {
    super();
    this.gatewayUrl = gatewayUrl;
  }

  async _call(input: { serviceId?: string }): Promise<string> {
    try {
      const result = await getPlans(this.gatewayUrl, input.serviceId);
      return JSON.stringify(result, null, 2);
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }
}

class SubscribePlanTool extends StructuredTool {
  name = "helix402_subscribe";
  description =
    "Subscribe to a credit plan on Helix402. " +
    "Purchases a bundle of credits for a service at a fixed USDC price.";
  schema = z.object({
    planId: z.string().describe("The plan ID to subscribe to"),
  });

  private gatewayUrl: string;
  private apiKey: string;

  constructor(gatewayUrl: string, apiKey: string) {
    super();
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
  }

  async _call(input: { planId: string }): Promise<string> {
    try {
      const result = await subscribe(
        this.gatewayUrl,
        this.apiKey,
        input.planId,
      );
      return JSON.stringify(result, null, 2);
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────

/**
 * Creates a set of LangChain tools that give any agent Helix402 payment capabilities.
 *
 * Returns 5 tools: discover_services, call_paid_api, check_budget, get_plans, subscribe.
 */
export function createHelix402Tools(
  options: Helix402ToolsOptions,
): StructuredTool[] {
  const paymentOpts: PaymentClientOptions = {
    gatewayUrl: options.gatewayUrl,
    apiKey: options.apiKey,
    network: options.network,
    budgetPolicy: options.budgetPolicy,
    axiosConfig: { headers: { "X-Helix-SDK": "langchain/0.1.0" } },
  };

  const payment = createPaymentClient(paymentOpts);

  return [
    new DiscoverServicesTool(options.gatewayUrl),
    new CallPaidApiTool(payment, options.merchantBaseUrl),
    new CheckBudgetTool(payment, options.apiKey, options.gatewayUrl),
    new GetPlansTool(options.gatewayUrl),
    new SubscribePlanTool(options.gatewayUrl, options.apiKey),
  ];
}
