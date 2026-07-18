import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

async function fullCheck() {
  console.log("=== SUPABASE DATA VERIFICATION ===\n");

  // 1. Products
  const { data: products, error: pErr, count: pCount } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('is_active', true);
  console.log(`1. Products (active): ${pCount} | Error: ${pErr?.message || 'None'}`);

  // 2. Categories
  const { data: categories, error: cErr } = await supabase.from('categories').select('*');
  console.log(`2. Categories: ${categories?.length || 0} | Error: ${cErr?.message || 'None'}`);
  categories?.forEach(c => console.log(`   - ${c.name} (slug: ${c.slug}, id: ${c.id})`));

  // 3. Collections
  const { data: collections, error: colErr } = await supabase.from('collections').select('*');
  console.log(`3. Collections: ${collections?.length || 0} | Error: ${colErr?.message || 'None'}`);
  collections?.forEach(c => console.log(`   - ${c.name} (slug: ${c.slug}, id: ${c.id})`));

  // 4. Products per collection
  console.log("\n4. Products per collection:");
  if (collections && products) {
    for (const col of collections) {
      const count = products.filter(p => p.collection_id === col.id).length;
      console.log(`   - ${col.name}: ${count} active products`);
    }
  }

  // 5. Products per category
  console.log("\n5. Products per category:");
  if (categories && products) {
    for (const cat of categories) {
      const count = products.filter(p => p.category_id === cat.id).length;
      console.log(`   - ${cat.name}: ${count} active products`);
    }
  }

  // 6. Check "set" category specifically (Twinning Sets)
  const { data: setCategory } = await supabase.from('categories').select('id').eq('slug', 'set').maybeSingle();
  if (setCategory) {
    const { data: setProducts, count: setCount } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('category_id', setCategory.id)
      .eq('is_active', true);
    console.log(`\n6. Twinning Sets (category=set): ${setCount} active products`);
  } else {
    console.log("\n6. WARNING: No category with slug 'set' found!");
  }

  // 7. Hero slides
  const { data: heroSlides, error: hErr } = await supabase.from('hero_slides').select('*');
  console.log(`\n7. Hero slides: ${heroSlides?.length || 0} | Error: ${hErr?.message || 'None'}`);

  // 8. User roles
  const { data: roles, error: rErr } = await supabase.from('user_roles').select('*');
  console.log(`8. User roles: ${roles?.length ?? 'N/A'} | Error: ${rErr?.message || 'None'}`);

  // 9. Complex query (the exact one useProducts uses)
  const { data: complexData, error: complexErr } = await supabase
    .from("products")
    .select(`*, category:categories(*), collection:collections(*)`)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  console.log(`\n9. Complex product query: ${complexData?.length || 0} results | Error: ${complexErr?.message || 'None'}`);
  if (complexData && complexData.length > 0) {
    const first = complexData[0];
    console.log(`   First: "${first.name}" | Category: ${first.category?.name || 'N/A'} | Collection: ${first.collection?.name || 'N/A'}`);
  }

  console.log("\n=== VERIFICATION COMPLETE ===");
}

fullCheck();
