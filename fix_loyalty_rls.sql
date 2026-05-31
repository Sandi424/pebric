-- ============================
-- Fix RLS for loyalty_points
-- ============================
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view their own loyalty points" ON public.loyalty_points;
DROP POLICY IF EXISTS "Users can insert their own loyalty points" ON public.loyalty_points;
DROP POLICY IF EXISTS "Users can update their own loyalty points" ON public.loyalty_points;

-- Users can read their own loyalty points
CREATE POLICY "Users can view their own loyalty points"
  ON public.loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own loyalty points row
CREATE POLICY "Users can insert their own loyalty points"
  ON public.loyalty_points FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own loyalty points
CREATE POLICY "Users can update their own loyalty points"
  ON public.loyalty_points FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================
-- Fix RLS for loyalty_transactions
-- ============================
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view their own loyalty transactions" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Users can insert their own loyalty transactions" ON public.loyalty_transactions;

-- Users can read their own transactions
CREATE POLICY "Users can view their own loyalty transactions"
  ON public.loyalty_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own transactions
CREATE POLICY "Users can insert their own loyalty transactions"
  ON public.loyalty_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
