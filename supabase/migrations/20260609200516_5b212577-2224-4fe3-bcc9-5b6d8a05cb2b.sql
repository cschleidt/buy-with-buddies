
-- Drop auth trigger + helpers tied to Supabase auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.find_user_id_by_email(text);

-- Drop all existing policies that depended on auth.uid()
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Members can view lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can create lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Owners can update lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Owners can delete lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Owners can view own lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Members can view membership" ON public.list_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.list_members;
DROP POLICY IF EXISTS "Owners can remove members or user removes self" ON public.list_members;
DROP POLICY IF EXISTS "Members can view items" ON public.items;
DROP POLICY IF EXISTS "Members can insert items" ON public.items;
DROP POLICY IF EXISTS "Members can update items" ON public.items;
DROP POLICY IF EXISTS "Members can delete items" ON public.items;
DROP POLICY IF EXISTS "Creator can view own items" ON public.items;

-- Drop FK constraints pointing to auth.users
ALTER TABLE public.shopping_lists DROP CONSTRAINT IF EXISTS shopping_lists_owner_id_fkey;
ALTER TABLE public.list_members DROP CONSTRAINT IF EXISTS list_members_user_id_fkey;
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_created_by_fkey;

-- Replace profiles with app_users
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_users_username_lower_idx ON public.app_users (lower(username));

GRANT SELECT, INSERT, UPDATE ON public.app_users TO anon, authenticated;
GRANT ALL ON public.app_users TO service_role;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read users" ON public.app_users
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create users" ON public.app_users
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update users" ON public.app_users
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Open access to app data tables (no auth)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon;

CREATE POLICY "Open access to lists" ON public.shopping_lists
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to members" ON public.list_members
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to items" ON public.items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RPC: find or create a user by username (case-insensitive)
CREATE OR REPLACE FUNCTION public.find_or_create_user_by_username(_username TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  SELECT id INTO _id FROM public.app_users WHERE lower(username) = lower(_username) LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.app_users (username) VALUES (_username) RETURNING id INTO _id;
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_or_create_user_by_username(TEXT) TO anon, authenticated;

-- RPC: lookup username (used for sharing lists)
CREATE OR REPLACE FUNCTION public.find_user_id_by_username(_username TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.app_users WHERE lower(username) = lower(_username) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_username(TEXT) TO anon, authenticated;
