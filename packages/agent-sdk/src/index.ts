/**
 * @module @helix402/agent-sdk
 *
 * x402 payment SDK for AI agents.
 * Automatically handles HTTP 402 responses with on-chain USDC settlement.
 */

import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { ethers } from "ethers";

import {
  PaymentClientOptions,
  PaymentClientResult,
  Helix402Error,
  ErrorCodes,
} from "./types";
import { createBudgetGuard } from "./budget";
import {
  validateEthereumAddress,
  validatePrivateKey,
  validateApiKey,
  validateNetwork,
} from "./validation";
import { DEFAULT_TIMEOUT_MS } from "./constants";
import {
  buildPayload,
  buildRequirements,
  requestGatewaySign,
  signLocally,
  submitSettlement,
} from "./signing";
import { parsePaymentRequired } from "./parser";

// Re-export public API
export { createBudgetGuard } from "./budget";
export { getServices, getPlans, subscribe, getCredits } from "./discovery";
export {
  BudgetPolicy,
  BudgetGuard,
  BudgetState,
  PaymentClientOptions,
  PaymentClientResult,
  SignPaymentResponse,
  X402PaymentRequired,
  X402SettleResponse,
  Helix402Error,
  ErrorCodes,
} from "./types";

interface PaidRequestConfig extends InternalAxiosRequestConfig {
  __paidRequest?: boolean;
}

export function createPaymentClient(
  options: PaymentClientOptions,
): PaymentClientResult {
  const {
    gatewayUrl,
    apiKey,
    privateKey,
    rpcUrl,
    usdcAddress,
    network,
    chainId,
    budgetPolicy,
    axiosConfig = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (!gatewayUrl)
    throw new Helix402Error(
      "gatewayUrl is required",
      ErrorCodes.INVALID_CONFIG,
    );
  if (!apiKey && !privateKey)
    throw new Helix402Error(
      "Either apiKey or privateKey is required",
      ErrorCodes.INVALID_CONFIG,
    );
  if (apiKey && privateKey)
    throw new Helix402Error(
      "Provide either apiKey or privateKey, not both",
      ErrorCodes.INVALID_CONFIG,
    );
  if (apiKey) validateApiKey(apiKey);
  if (privateKey) {
    validatePrivateKey(privateKey);
    if (!rpcUrl)
      throw new Helix402Error(
        "rpcUrl is required for self-custody mode",
        ErrorCodes.INVALID_CONFIG,
      );
    if (!usdcAddress)
      throw new Helix402Error(
        "usdcAddress is required for self-custody mode",
        ErrorCodes.INVALID_CONFIG,
      );
    validateEthereumAddress(usdcAddress, "usdcAddress");
  }
  if (!network)
    throw new Helix402Error(
      "network is required (e.g. 'base', 'base-sepolia')",
      ErrorCodes.INVALID_CONFIG,
    );
  const resolvedChainId = chainId || validateNetwork(network);
  const mode: "managed" | "self-custody" = apiKey ? "managed" : "self-custody";

  let signer: ethers.Wallet | undefined;
  if (privateKey && rpcUrl)
    signer = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpcUrl));

  const budget = createBudgetGuard(budgetPolicy);
  const sdkId =
    (axiosConfig?.headers as Record<string, string>)?.["X-Helix-SDK"] ||
    "agent-sdk/0.1.0";
  const client = axios.create({
    timeout: timeoutMs,
    ...axiosConfig,
    headers: {
      "X-Helix-SDK": sdkId,
      ...((axiosConfig?.headers as Record<string, string>) || {}),
    },
  });

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const response = error.response;
      const originalConfig = error.config as PaidRequestConfig | undefined;
      if (
        !response ||
        response.status !== 402 ||
        !originalConfig ||
        originalConfig.__paidRequest
      )
        throw error;

      const paymentReq = parsePaymentRequired(response);
      if (!paymentReq)
        throw new Helix402Error(
          "402 response missing payment metadata",
          ErrorCodes.MISSING_PAYMENT_METADATA,
          402,
        );

      const { amount, payTo, facilitatorUrl, resource } = paymentReq;
      budget.check(amount);

      const settleUrl = facilitatorUrl || gatewayUrl;
      let paymentPayload, paymentRequirements;

      if (mode === "managed") {
        const signRes = await requestGatewaySign(
          gatewayUrl,
          apiKey!,
          payTo,
          amount,
          network,
        );
        paymentPayload = buildPayload(
          network,
          signRes.signature,
          signRes.authorization,
        );
        paymentRequirements = buildRequirements(
          network,
          amount,
          signRes.usdcAddress,
          payTo,
          resource,
        );
      } else {
        const signResult = await signLocally(
          signer!,
          resolvedChainId,
          usdcAddress!,
          payTo,
          amount,
        );
        paymentPayload = buildPayload(
          network,
          signResult.signature,
          signResult.authorization,
        );
        paymentRequirements = buildRequirements(
          network,
          amount,
          usdcAddress!,
          payTo,
          resource,
        );
      }

      const settleResponse = await submitSettlement(
        settleUrl,
        paymentPayload,
        paymentRequirements,
        sdkId,
      );
      if (!settleResponse.settled || !settleResponse.receipt) {
        budget.record(amount);
        throw new Helix402Error(
          `Settlement rejected: ${settleResponse.error || "unknown"}`,
          ErrorCodes.SETTLEMENT_REJECTED,
        );
      }

      budget.record(amount);
      originalConfig.__paidRequest = true;
      originalConfig.headers.set(
        "Authorization",
        `Bearer ${settleResponse.receipt}`,
      );
      return client.request(originalConfig);
    },
  );

  return { client, signer, budget };
}
