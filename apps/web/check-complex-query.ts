import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(*),
          collection:collections(*)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
  console.log("Error:", error ? error.message : "None");
  console.log("Products fetched:", data ? data.length : 0);
  if (data && data.length > 0) {
    console.log("First product:", JSON.stringify(data[0], null, 2));
  }
}

test();
