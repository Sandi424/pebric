import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ykyruievdbwzlvyperjv.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1j6PG3qXptQAN3Ld6OIGpQ_qNEOuLit";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRls() {
  console.log("=== Testing saved_addresses RLS ===");
  
  // 1. Try signing in with test credentials
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "22053145@kiit.ac.in",
    password: "arani@2002",
  });
  
  console.log("Auth result:", { user: authData?.user?.id, authError });

  if (authData?.session) {
    console.log("Logged in user ID:", authData.user.id);
    
    // Try insert saved_addresses
    const { data: addData, error: addError } = await supabase
      .from("saved_addresses")
      .insert({
        user_id: authData.user.id,
        full_name: "Test User",
        address_line1: "123 Test Street",
        city: "Bhubaneswar",
        state: "Odisha",
        postal_code: "751024",
        country: "India",
        is_default: false,
        label: "Home"
      })
      .select();

    console.log("saved_addresses insert result:", { addData, addError });

    // Try insert pets
    const { data: petData, error: petError } = await supabase
      .from("pets")
      .insert({
        user_id: authData.user.id,
        name: "Buddy",
        species: "dog",
        breed: "Golden Retriever",
        is_primary: true
      })
      .select();

    console.log("pets insert result:", { petData, petError });
  }
}

testRls().catch(console.error);
