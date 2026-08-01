import { supabase } from "@/integrations/client";

type RateLimitEndpoint =
  | "review-submit"
  | "support-ticket"
  | "send-email"
  | "default";

type RateLimitResponse = {
  allowed?: boolean;
  remaining?: number;
  retryAfter?: number;
  message?: string;
  error?: string;
};

type FunctionsHttpErrorLike = {
  context?: Response;
  message?: string;
};

export async function enforceRateLimit(endpoint: RateLimitEndpoint) {
  // Wrap entirely in try-catch: if the edge function doesn't exist or any
  // network/CORS error occurs, we fail-open and let the actual operation proceed.
  try {
    const { data, error } = await supabase.functions.invoke("check-rate-limit", {
      body: { endpoint },
    });

    const result = data as RateLimitResponse | null;

    if (result?.allowed === false) {
      throw new Error(result.message || "Too many requests. Please try again later.");
    }

    if (error) {
      const status = (error as FunctionsHttpErrorLike).context?.status;
      if (status === 429) {
        throw new Error(
          result?.message || "Too many requests. Please wait and try again.",
        );
      }
      // Any other error (e.g., function not found) — fail open
      console.warn("Rate limit check failed open:", error);
    }
  } catch (err) {
    // Re-throw only real rate limit errors; swallow everything else
    if (err instanceof Error && (
      err.message.includes("Too many requests") ||
      err.message.includes("rate limit")
    )) {
      throw err;
    }
    console.warn("Rate limit check skipped (function unavailable):", err);
  }
}
