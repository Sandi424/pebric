import { useCallback, useState } from "react";

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

function showRazorpayTestModal({
  amount,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onFailure,
}: {
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  onSuccess: (response: RazorpayPaymentResponse) => void;
  onFailure: (error: string) => void;
}) {
  const existingModal = document.getElementById("razorpay-test-modal");
  if (existingModal) existingModal.remove();

  const modalContainer = document.createElement("div");
  modalContainer.id = "razorpay-test-modal";
  modalContainer.style.cssText = "position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px); padding: 16px;";

  modalContainer.innerHTML = `
    <div style="width: 100%; max-width: 440px; background: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); font-family: system-ui, -apple-system, sans-serif; overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0c2340 0%, #1a365d 100%); color: white; padding: 20px 24px; position: relative;">
        <button id="rzp-close-btn" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.15); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">✕</button>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3B82F6"/>
            <path d="M2 17L12 22L22 17" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span style="font-weight: 700; font-size: 18px; letter-spacing: -0.02em;">Razorpay</span>
          <span style="background: rgba(59, 130, 246, 0.3); border: 1px solid rgba(147, 197, 253, 0.4); color: #93c5fd; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; text-transform: uppercase;">Test Mode</span>
        </div>
        <p style="margin: 0; font-size: 13px; color: #cbd5e1;">Paying Pebric Store</p>
        <div style="margin-top: 12px; font-size: 26px; font-weight: 800; color: #ffffff;">₹${amount.toFixed(2)}</div>
      </div>

      <!-- Payment Options -->
      <div style="padding: 20px 24px 24px;">
        <p style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Select Payment Method</p>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- UPI -->
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 2px solid #2563eb; border-radius: 10px; cursor: pointer; background: #eff6ff;" class="rzp-opt">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="radio" name="rzp_method" value="upi" checked style="accent-color: #2563eb; width: 18px; height: 18px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #0f172a;">UPI / QR Code</div>
                <div style="font-size: 11px; color: #64748b;">Google Pay, PhonePe, Paytm, BHIM</div>
              </div>
            </div>
            <span style="font-size: 18px;">⚡</span>
          </label>

          <!-- Cards -->
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; background: #f8fafc;" class="rzp-opt">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="radio" name="rzp_method" value="card" style="accent-color: #2563eb; width: 18px; height: 18px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #0f172a;">Credit / Debit Card</div>
                <div style="font-size: 11px; color: #64748b;">Visa, Mastercard, RuPay</div>
              </div>
            </div>
            <span style="font-size: 18px;">💳</span>
          </label>

          <!-- Net Banking -->
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; background: #f8fafc;" class="rzp-opt">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="radio" name="rzp_method" value="netbanking" style="accent-color: #2563eb; width: 18px; height: 18px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #0f172a;">Netbanking</div>
                <div style="font-size: 11px; color: #64748b;">HDFC, ICICI, SBI, Axis</div>
              </div>
            </div>
            <span style="font-size: 18px;">🏛️</span>
          </label>

          <!-- Wallet -->
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; background: #f8fafc;" class="rzp-opt">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="radio" name="rzp_method" value="wallet" style="accent-color: #2563eb; width: 18px; height: 18px;" />
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #0f172a;">Wallets</div>
                <div style="font-size: 11px; color: #64748b;">Paytm, PhonePe Wallet, Mobikwik</div>
              </div>
            </div>
            <span style="font-size: 18px;">👛</span>
          </label>
        </div>

        <button id="rzp-pay-btn" style="width: 100%; margin-top: 18px; background: #2563eb; color: white; border: none; padding: 13px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
          Pay ₹${amount.toFixed(2)}
        </button>

        <p style="font-size: 11px; text-align: center; color: #94a3b8; margin-top: 12px; margin-bottom: 0;">
          🔒 Encrypted 256-bit SSL Payment Gateway (Test Mode)
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  const closeBtn = modalContainer.querySelector("#rzp-close-btn");
  closeBtn?.addEventListener("click", () => {
    modalContainer.remove();
    onFailure("Payment window was closed.");
  });

  const payBtn = modalContainer.querySelector("#rzp-pay-btn") as HTMLButtonElement;
  payBtn?.addEventListener("click", () => {
    payBtn.disabled = true;
    payBtn.innerText = "Processing Payment...";
    payBtn.style.opacity = "0.7";

    setTimeout(() => {
      modalContainer.remove();
      const paymentId = "pay_test_" + Math.random().toString(36).substring(2, 12);
      onSuccess({
        razorpay_payment_id: paymentId,
        razorpay_order_id: "order_test_" + Math.random().toString(36).substring(2, 10),
        razorpay_signature: "sig_test_" + Math.random().toString(36).substring(2, 12),
      });
    }, 600);
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
        showRazorpayTestModal({
          amount,
          customerName,
          customerEmail,
          customerPhone,
          onSuccess,
          onFailure,
        });
      } catch (error) {
        onFailure("Payment initialization error");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { openCheckout, isLoading };
}
