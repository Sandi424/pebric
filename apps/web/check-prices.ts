import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase.from('products').select('id, name, price');
  console.log("Error:", error);
  const badPrices = data?.filter(p => typeof p.price !== 'number' || isNaN(p.price) || p.price === null);
  console.log("Products with bad prices:", badPrices);
}

test();
