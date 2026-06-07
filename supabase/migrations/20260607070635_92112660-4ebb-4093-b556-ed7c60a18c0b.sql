
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Shopping lists
CREATE TABLE public.shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'sky',
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT ALL ON public.shopping_lists TO service_role;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

-- List members
CREATE TABLE public.list_members (
  list_id UUID NOT NULL REFERENCES public.shopping_lists ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_members TO authenticated;
GRANT ALL ON public.list_members TO service_role;
ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

-- Security definer: is user a member of list?
CREATE OR REPLACE FUNCTION public.is_list_member(_list_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopping_lists WHERE id = _list_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.list_members WHERE list_id = _list_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_list_owner(_list_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shopping_lists WHERE id = _list_id AND owner_id = _user_id);
$$;

-- shopping_lists policies
CREATE POLICY "Members can view lists" ON public.shopping_lists
  FOR SELECT TO authenticated USING (public.is_list_member(id, auth.uid()));
CREATE POLICY "Users can create lists" ON public.shopping_lists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update lists" ON public.shopping_lists
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete lists" ON public.shopping_lists
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- list_members policies
CREATE POLICY "Members can view membership" ON public.list_members
  FOR SELECT TO authenticated USING (public.is_list_member(list_id, auth.uid()));
CREATE POLICY "Owners can add members" ON public.list_members
  FOR INSERT TO authenticated WITH CHECK (public.is_list_owner(list_id, auth.uid()));
CREATE POLICY "Owners can remove members or user removes self" ON public.list_members
  FOR DELETE TO authenticated USING (public.is_list_owner(list_id, auth.uid()) OR user_id = auth.uid());

-- Items
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.shopping_lists ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  note TEXT,
  is_bought BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bought_at TIMESTAMPTZ
);
CREATE INDEX items_list_id_idx ON public.items(list_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view items" ON public.items
  FOR SELECT TO authenticated USING (public.is_list_member(list_id, auth.uid()));
CREATE POLICY "Members can insert items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (public.is_list_member(list_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Members can update items" ON public.items
  FOR UPDATE TO authenticated USING (public.is_list_member(list_id, auth.uid()));
CREATE POLICY "Members can delete items" ON public.items
  FOR DELETE TO authenticated USING (public.is_list_member(list_id, auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.list_members;
ALTER TABLE public.shopping_lists REPLICA IDENTITY FULL;
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.list_members REPLICA IDENTITY FULL;

-- Find user by email for invites (security definer, returns id if exists)
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;
