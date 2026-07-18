import { useCallback, useState } from "react";
import { supabase } from "@/integrations/client";

interface PhonePeTransactionResult {
    success: boolean;
    redirectUrl: string;
    merchantTransactionId: string;
    amount: number;
}

export interface PhonePePaymentResponse {
    verified: boolean;
    pending: boolean;
    status: string;
    transactionId: string;
    paymentMode: string | null;
    providerReferenceId: string | null;
    rawResponse: unknown;
}

export function usePhonePe() {
    const [isLoading, setIsLoading] = useState(false);

    const createTransaction = useCallback(
        async ({
            amount,
            customerEmail,
            customerPhone,
            customerId,
            redirectUrl,
        }: {
            amount: number;
            customerEmail?: string;
            customerPhone?: string;
            customerId?: string;
            redirectUrl?: string;
        }): Promise<PhonePeTransactionResult> => {
            const { data, error } = await supabase.functions.invoke("create-phonepe-transaction", {
                body: {
                    amount,
                    customerId,
                    customerEmail,
                    customerPhone,
                    redirectUrl,
                },
            });

            console.error("PhonePe Create Txn Response:", { data, error });

            if (error) {
                console.error("Supabase edge function error:", error);
                throw new Error(error.message || "Failed to create PhonePe transaction");
            }
            if (data?.error) {
                console.error("PhonePe business error:", data.error, data.details);
                throw new Error(data.error);
            }

            return data as PhonePeTransactionResult;
        },
        []
    );

    const verifyPayment = useCallback(async (merchantTransactionId: string): Promise<PhonePePaymentResponse> => {
        const { data, error } = await supabase.functions.invoke("verify-phonepe-transaction", {
            body: { merchantTransactionId },
        });



        if (error) throw new Error(error.message || "Failed to verify PhonePe payment");
        if (data?.error) throw new Error(data.error);

        // Map the edge function response fields to expected shape
        return {
            verified: data?.success === true && data?.status === "COMPLETED",
            pending: data?.status === "PENDING",
            status: data?.status || "UNKNOWN",
            transactionId: data?.transactionId || merchantTransactionId,
            paymentMode: data?.paymentMode || null,
            providerReferenceId: data?.transactionId || null,
            rawResponse: data,
        } as PhonePePaymentResponse;
    }, []);

    const openCheckout = useCallback(
        async ({
            amount,
            customerEmail,
            customerPhone,
            customerId,
            onFailure,
            redirectUrl,
        }: {
            amount: number;
            customerEmail?: string;
            customerPhone?: string;
            customerId?: string;
            onFailure: (error: string) => void;
            redirectUrl?: string;
        }) => {
            setIsLoading(true);

            try {
                const transaction = await createTransaction({
                    amount,
                    customerEmail,
                    customerPhone,
                    customerId,
                    redirectUrl,
                });

                // Redirect to PhonePe payment page
                if (transaction.success && transaction.redirectUrl) {
                    // Store the merchantTransactionId in sessionStorage to verify when user returns
                    sessionStorage.setItem("phonepe_merchant_transaction_id", transaction.merchantTransactionId);
                    window.location.href = transaction.redirectUrl;
                } else {
                    throw new Error("Invalid response from PhonePe API");
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "PhonePe checkout failed";
                onFailure(message);
                setIsLoading(false);
            }
        },
        [createTransaction]
    );

    return { openCheckout, verifyPayment, isLoading };
}
