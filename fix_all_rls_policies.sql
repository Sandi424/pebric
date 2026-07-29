-- Enable Row Level Security on saved_addresses and pets tables
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- Policies for saved_addresses
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own addresses." ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can select their own addresses." ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can update their own addresses." ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can delete their own addresses." ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can insert their own address" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can update their own address" ON public.saved_addresses;
DROP POLICY IF EXISTS "Users can delete their own address" ON public.saved_addresses;

CREATE POLICY "Users can insert their own addresses."
  ON public.saved_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own addresses."
  ON public.saved_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses."
  ON public.saved_addresses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses."
  ON public.saved_addresses FOR DELETE
  USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- Policies for pets
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can create their own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can update their own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can delete their own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can insert their own pets" ON public.pets;

CREATE POLICY "Users can view their own pets"
  ON public.pets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pets"
  ON public.pets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pets"
  ON public.pets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pets"
  ON public.pets FOR DELETE
  USING (auth.uid() = user_id);
