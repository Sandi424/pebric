-- Fix RLS Policies for referral_codes, subscriptions, and referrals
-- Run this in your Supabase Dashboard → SQL Editor

-- ============================================================
-- REFERRAL CODES
-- ============================================================
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own referral code' AND tablename = 'referral_codes') THEN
        CREATE POLICY "Users can insert own referral code" ON public.referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own referral code' AND tablename = 'referral_codes') THEN
        CREATE POLICY "Users can update own referral code" ON public.referral_codes FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read referral codes' AND tablename = 'referral_codes') THEN
        CREATE POLICY "Public read referral codes" ON public.referral_codes FOR SELECT USING (true);
    END IF;
END $$;

-- ============================================================
-- SUBSCRIPTIONS — INSERT, SELECT, UPDATE, DELETE
-- ============================================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own subscriptions' AND tablename = 'subscriptions') THEN
        CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own subscriptions' AND tablename = 'subscriptions') THEN
        CREATE POLICY "Users can read own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own subscriptions' AND tablename = 'subscriptions') THEN
        CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own subscriptions' AND tablename = 'subscriptions') THEN
        CREATE POLICY "Users can delete own subscriptions" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================
-- REFERRALS
-- ============================================================
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own referrals' AND tablename = 'referrals') THEN
        CREATE POLICY "Users can insert own referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referred_id OR auth.uid() = referrer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own referrals' AND tablename = 'referrals') THEN
        CREATE POLICY "Users can read own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referred_id OR auth.uid() = referrer_id);
    END IF;
END $$;

