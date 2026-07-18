import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCategories() {
  const { data, error } = await supabase.from('categories').select('*');
  console.log("Error:", error);
  console.log("Categories:", JSON.stringify(data, null, 2));
}

checkCategories();
