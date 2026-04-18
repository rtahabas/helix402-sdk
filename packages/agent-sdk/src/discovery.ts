import axios from "axios";
import { DEFAULT_TIMEOUT_MS } from "./constants";

export async function getServices(
  gatewayUrl: string,
  search?: string,
): Promise<{
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    base_url: string | null;
    default_price: string | null;
    endpoints: Array<{ path: string; method: string; price: string }>;
  }>;
}> {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const resp = await axios.get(`${gatewayUrl}/api/v1/services${params}`, {
    timeout: DEFAULT_TIMEOUT_MS,
  });
  return resp.data;
}

export async function getPlans(
  gatewayUrl: string,
  serviceId?: string,
): Promise<{
  plans: Array<{
    id: string;
    name: string;
    total_credits: number;
    price_usdc: string;
    credits_per_call: number;
  }>;
}> {
  const params = serviceId ? `?serviceId=${serviceId}` : "";
  const resp = await axios.get(`${gatewayUrl}/api/v1/plans${params}`, {
    timeout: DEFAULT_TIMEOUT_MS,
  });
  return resp.data;
}

export async function subscribe(
  gatewayUrl: string,
  apiKey: string,
  planId: string,
): Promise<{ id: string; credits_remaining: number; status: string }> {
  const resp = await axios.post(
    `${gatewayUrl}/api/v1/subscriptions/purchase`,
    { planId },
    { headers: { "x-api-key": apiKey }, timeout: DEFAULT_TIMEOUT_MS },
  );
  return resp.data;
}

export async function getCredits(
  gatewayUrl: string,
  apiKey: string,
): Promise<{
  subscriptions: Array<{
    id: string;
    credits_remaining: number;
    credits_used: number;
    status: string;
  }>;
  summary: { totalRemaining: number; totalUsed: number };
}> {
  const resp = await axios.get(`${gatewayUrl}/api/v1/subscriptions/me`, {
    headers: { "x-api-key": apiKey },
    timeout: DEFAULT_TIMEOUT_MS,
  });
  return resp.data;
}
