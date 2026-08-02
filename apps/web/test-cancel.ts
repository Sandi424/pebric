import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: "./apps/web/.env" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testOrdersUpdate() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: "22053145@kiit.ac.in",
    password: "arani@2002",
  });

  if (authData?.session) {
    const user = authData.user;
    
    // Fetch orders for user
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id);

    console.log("User orders count:", orders?.length, "Error:", ordersErr);

    if (orders && orders.length > 0) {
      const order = orders[0];
      const { data: updateData, error: updateErr } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select();

      console.log("Order status update result:", { updateData, updateErr });
    }
  }
}

testOrdersUpdate().catch(console.error);
