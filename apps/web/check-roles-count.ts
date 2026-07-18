import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, count, error } = await supabase.from('user_roles').select('*', { count: 'exact' });
  console.log("User roles (anon):", count, error ? error.message : "");
}

test();
