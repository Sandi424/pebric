import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAll() {
  console.log("=== Testing cart_items insert with product_id '1' ===");
  const { error: insertErr1 } = await supabase.from("cart_items").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    product_id: "1",
    size: "M",
    quantity: 1
  });
  console.log("cart_items insert result:", insertErr1);

  console.log("=== Testing pets table ===");
  const { data: petsData, error: petsError } = await supabase.from("pets").select("*").limit(1);
  console.log("pets select:", { petsData, petsError });

  console.log("=== Testing finalize_checkout RPC (all 12 params) ===");
  const { data: rpcData, error: rpcError } = await supabase.rpc("finalize_checkout" as any, {
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
  console.log("finalize_checkout RPC:", { rpcData, rpcError });

  console.log("=== Testing Edge Function apply-coupon / checkout ===");
  const { data: efData, error: efError } = await supabase.functions.invoke("apply-coupon", {
    body: { code: "WELCOME10" },
  });
  console.log("Edge Function apply-coupon:", { efData, efError });
}

testAll();
