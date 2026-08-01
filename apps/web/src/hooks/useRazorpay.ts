import { useCallback, useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id?: string;
  handler: (response: RazorpayPaymentResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
  };
}

interface RazorpayInstance {
  open(): void;
  on(event: string, callback: () => void): void;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

// Razorpay Test Key — safe to expose in client
// Replace with your live key for production
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function useRazorpay() {
  const [isLoading, setIsLoading] = useState(false);

  const openCheckout = useCallback(
    async ({
      amount,
      customerEmail,
      customerPhone,
      customerName,
      onSuccess,
      onFailure,
    }: {
      amount: number;
      customerEmail?: string;
      customerPhone?: string;
      customerName?: string;
      onSuccess: (response: RazorpayPaymentResponse) => void;
      onFailure: (error: string) => void;
    }) => {
      setIsLoading(true);

      try {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded || !window.Razorpay) {
          onFailure("Failed to load Razorpay. Please check your internet connection.");
          return;
        }

        const options: RazorpayOptions = {
          key: RAZORPAY_KEY,
          amount: Math.round(amount * 100), // convert to paise
          currency: "INR",
          name: "Pebric",
          description: "Pet Fashion Order",
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },
          theme: {
            color: "#000000",
          },
          handler: (response: RazorpayPaymentResponse) => {
            onSuccess(response);
          },
          modal: {
            ondismiss: () => {
              onFailure("Payment window was closed.");
            },
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Payment failed";
        onFailure(message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { openCheckout, isLoading };
}
