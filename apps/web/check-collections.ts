import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDatabase() {
  const { data: collections, error: colError } = await supabase.from('collections').select('*');
  console.log("Collections Error:", colError);
  console.log("Collections:", JSON.stringify(collections, null, 2));

  const { data: products, error: prodError } = await supabase.from('products').select('id, name, collection_id, category_id, is_active');
  console.log("Products Error:", prodError);
  
  if (collections) {
    for (const col of collections) {
      const colProducts = products?.filter(p => p.collection_id === col.id && p.is_active) || [];
      console.log(`Collection '${col.name}' (${col.slug}) [ID: ${col.id}] has ${colProducts.length} active products.`);
    }
  }
}

checkDatabase();
