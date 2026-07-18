import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data: products, error: pError } = await supabase.from('products').select('*').limit(1);
  console.log("Products table:", pError ? pError.message : "Exists", products ? `Found ${products.length} rows` : "");
  
  const { data: roles, error: rError } = await supabase.from('user_roles').select('*').limit(1);
  console.log("User_roles table:", rError ? rError.message : "Exists", roles ? `Found ${roles.length} rows` : "");
}

test();
