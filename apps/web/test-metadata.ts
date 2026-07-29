import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ykyruievdbwzlvyperjv.supabase.co";
const SUPABASE_KEY = "sb_publishable_1j6PG3qXptQAN3Ld6OIGpQ_qNEOuLit";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testMetadata() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "22053145@kiit.ac.in",
    password: "arani@2002",
  });
  
  if (authError || !authData.user) {
    console.error("Auth error:", authError);
    return;
  }

  console.log("Logged in user:", authData.user.id);
  console.log("Existing metadata:", authData.user.user_metadata);

  // Update user metadata
  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    data: {
      test_field: "works",
      saved_addresses: [
        {
          id: "addr_123",
          label: "Home",
          full_name: "Sandipan",
          address_line1: "123 Main St",
          city: "Bhubaneswar",
          postal_code: "751024",
          country: "India",
          is_default: true,
        }
      ]
    }
  });

  console.log("updateUser result:", { user: updateData?.user?.id, updateError });
}

testMetadata();
