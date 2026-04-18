import type { AxiosResponse } from "axios";
import type { X402PaymentRequired, ParsedPaymentRequirement } from "./types";

export function parsePaymentRequired(response: AxiosResponse): ParsedPaymentRequirement | null {
  const headerValue = response.headers?.["payment-required"];
  if (typeof headerValue === "string" && headerValue.length > 0) {
    try {
      const decoded = JSON.parse(
        Buffer.from(headerValue, "base64").toString("utf-8"),
      ) as X402PaymentRequired;
      if (decoded.accepts?.length > 0) {
        const accept = decoded.accepts[0];
        if (
          typeof accept.amount === "string" &&
          typeof accept.payTo === "string" &&
          typeof decoded.resource === "string"
        ) {
          return {
            amount: accept.amount,
            payTo: accept.payTo,
            resource: decoded.resource,
            facilitatorUrl:
              typeof accept.facilitatorUrl === "string" ? accept.facilitatorUrl : undefined,
          };
        }
      }
    } catch {
      /* header parse failed — fall through to body */
    }
  }
  const body = response.data as Record<string, unknown> | undefined;
  if (
    body &&
    typeof body.price === "string" &&
    typeof body.wallet === "string" &&
    typeof body.resource === "string"
  ) {
    return {
      amount: body.price,
      payTo: body.wallet,
      resource: body.resource,
      facilitatorUrl: typeof body.facilitatorUrl === "string" ? body.facilitatorUrl : undefined,
    };
  }
  return null;
}
