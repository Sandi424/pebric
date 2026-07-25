// Test script to simulate the complete signup flow exactly as the browser does
// Run: node apps/web/test-signup-flow.mjs

const SUPABASE_URL = "https://ykyruievdbwzlvyperjv.supabase.co";
const SUPABASE_KEY = "sb_publishable_1j6PG3qXptQAN3Ld6OIGpQ_qNEOuLit";

const EMAIL = "22053145@kiit.ac.in";
const PASSWORD = "arani@2002";
const FULL_NAME = "Sandipan";

async function supabaseRequest(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log("=".repeat(60));
  console.log("PEBRIC SIGNUP FLOW TEST");
  console.log("=".repeat(60));
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log();

  // Step 1: Check if we can sign in (does account already exist?)
  console.log("STEP 1: Checking if account already exists...");
  const signInResult = await supabaseRequest("/token?grant_type=password", "POST", {
    email: EMAIL,
    password: PASSWORD,
  });
  
  console.log(`  Sign-in status: ${signInResult.status}`);
  if (signInResult.ok) {
    console.log("  ✅ ACCOUNT EXISTS AND CREDENTIALS ARE CORRECT");
    console.log(`  User ID: ${signInResult.data.user?.id}`);
    console.log(`  Email confirmed: ${signInResult.data.user?.email_confirmed_at ? "YES" : "NO"}`);
    console.log(`  Access token: ${signInResult.data.access_token ? "RECEIVED" : "MISSING"}`);
    console.log();
    console.log("  ACTION: This account already exists. You can sign in directly at /login");
    console.log("  The signup page will redirect to home after login.");
    return;
  } else {
    const err = signInResult.data;
    console.log(`  Sign-in error: ${err.msg || err.error_description || JSON.stringify(err)}`);
    console.log(`  Error code: ${err.error_code || err.error}`);
    
    if (err.error_code === "email_not_confirmed") {
      console.log();
      console.log("  ℹ️  ACCOUNT EXISTS but email is NOT confirmed");
      console.log("  Action needed: Enable 'mailer_autoconfirm' in Supabase Dashboard");
      console.log("  OR: Manually confirm this user in Auth > Users > Edit");
      return;
    }
    
    if (err.error_code === "invalid_credentials") {
      console.log("  Account does NOT exist with these credentials (or different password was used)");
    }
  }

  // Step 2: Try signup
  console.log();
  console.log("STEP 2: Attempting signup...");
  const signUpResult = await supabaseRequest("/signup", "POST", {
    email: EMAIL,
    password: PASSWORD,
    data: { full_name: FULL_NAME },
    gotrue_meta_security: {},
  });
  
  console.log(`  Signup status: ${signUpResult.status}`);
  
  if (signUpResult.ok) {
    const user = signUpResult.data.user;
    const session = signUpResult.data.session;
    const identities = user?.identities || [];
    
    console.log(`  User ID: ${user?.id}`);
    console.log(`  Session: ${session ? "✅ RECEIVED (auto-login works!)" : "❌ NULL (email confirmation required)"}`);
    console.log(`  Identities count: ${identities.length}`);
    console.log(`  Email confirmed: ${user?.email_confirmed_at ? "YES" : "NO"}`);
    
    if (identities.length === 0) {
      console.log();
      console.log("  ⚠️  EMPTY IDENTITIES: Email was previously used but not confirmed");
      console.log("  OR: Supabase returned this because the email already exists");
      
      // Try signing in anyway
      console.log();
      console.log("  Trying to sign in with provided credentials...");
      const retry = await supabaseRequest("/token?grant_type=password", "POST", {
        email: EMAIL, password: PASSWORD,
      });
      if (retry.ok) {
        console.log("  ✅ SIGN-IN SUCCEEDED - Account exists with matching credentials");
        console.log(`  The app will auto-log-in this user`);
      } else {
        console.log(`  ❌ Sign-in failed: ${retry.data.msg}`);
        console.log("  This is a truly duplicate but unconfirmable account");
      }
    } else if (session) {
      console.log();
      console.log("  🎉 SUCCESS! Account created with immediate session");
      console.log("  The user will be auto-logged in and redirected to home");
    } else {
      console.log();
      console.log("  ✉️  Account created but email confirmation required");
      console.log("  FIX: In Supabase Dashboard → Auth → Providers → Email → Disable 'Confirm email'");
    }
  } else {
    const err = signUpResult.data;
    console.log(`  ❌ Signup failed: ${err.msg || JSON.stringify(err)}`);
    console.log(`  Error code: ${err.error_code}`);
    
    if (err.error_code === "over_email_send_rate_limit" || signUpResult.status === 429) {
      console.log();
      console.log("  🚫 RATE LIMIT HIT: Supabase free tier email quota exhausted");
      console.log("  CAUSE: mailer_autoconfirm=false causes an email to be sent on every signup");
      console.log("  SOLUTIONS:");
      console.log("    1. (BEST) Disable 'Confirm email' in Supabase Dashboard → Auth → Providers → Email");
      console.log("    2. Wait ~1 hour for rate limit to reset");
      console.log("    3. Use Supabase custom SMTP to increase email limits");
    }
    
    if (err.error_code === "user_already_exists" || err.msg?.includes("already registered")) {
      console.log();
      console.log("  Email is already registered. Use /login instead.");
    }
  }
  
  console.log();
  console.log("=".repeat(60));
}

main().catch(console.error);
