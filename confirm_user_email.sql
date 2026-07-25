-- Run this in Supabase SQL Editor to:
-- 1. Confirm the existing unconfirmed user (22053145@kiit.ac.in)
-- 2. Enable auto-confirm so future signups don't require email verification

-- PART 1: Manually confirm the existing user's email
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = '22053145@kiit.ac.in'
  AND email_confirmed_at IS NULL;

-- Verify it worked
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users 
WHERE email = '22053145@kiit.ac.in';
