import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, category_id, collection_id, is_active')
    .eq('category_id', '06b9b6d2-dccf-46e1-8028-d68b35f35f11')
    .eq('is_active', true);
    
  console.log("Error:", error);
  console.log("Products found in 'set' category:", products?.length);
  if (products && products.length > 0) {
    console.log(products[0]);
  }
}

checkProducts();
