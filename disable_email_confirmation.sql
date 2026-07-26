-- Run this SQL in the Supabase SQL Editor to:
-- 1. Disable email confirmation requirement for new signups
-- 2. Auto-confirm all existing unconfirmed users

-- PART 1: Update Supabase Auth config to disable email confirmation
-- This is the ONLY reliable way to fix signup issues.
-- Go to: Supabase Dashboard → Authentication → Providers → Email
-- Uncheck "Confirm email" / Set "Enable email confirmations" to OFF
-- Then click Save.

-- PART 2: Auto-confirm all existing unconfirmed users
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email_confirmed_at IS NULL;

-- PART 3: Create an RPC function that auto-confirms a user by email
-- This allows the frontend to confirm a user immediately after signup
-- as a fallback if email confirmation can't be disabled.
CREATE OR REPLACE FUNCTION public.auto_confirm_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE email = user_email
    AND email_confirmed_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.auto_confirm_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_confirm_user(TEXT) TO anon;

-- Verify: Check if any users are still unconfirmed
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
