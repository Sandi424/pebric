import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkHeroSlides() {
  const { data, error } = await supabase.from('hero_slides').select('*');
  console.log("Error:", error);
  console.log("Data:", data);
}

checkHeroSlides();
