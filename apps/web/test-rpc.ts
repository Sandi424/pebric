import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ykyruievdbwzlvyperjv.supabase.co";
const SUPABASE_KEY = "sb_publishable_1j6PG3qXptQAN3Ld6OIGpQ_qNEOuLit";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRpc() {
  console.log("Testing finalize_checkout with 12 parameters...");
  const { data: fcData, error: fcError } = await supabase.rpc("finalize_checkout" as any, {
    p_items: [],
    p_payment_method: "cod",
    p_shipping_address: {},
    p_billing_address: null,
    p_notes: null,
    p_gift_wrap: false,
    p_gift_message: null,
    p_clear_cart: true,
    p_coupon_id: null,
    p_transaction_id: null,
    p_payment_status: null,
    p_idempotency_key: null,
  });
  console.log("finalize_checkout result:", { fcData, fcError });
}

checkRpc();
