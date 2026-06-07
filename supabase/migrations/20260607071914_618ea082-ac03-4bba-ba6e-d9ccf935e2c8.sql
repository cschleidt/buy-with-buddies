
CREATE POLICY "Owners can view own lists" ON public.shopping_lists
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Creator can view own items" ON public.items
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by);

DROP FUNCTION IF EXISTS public.whoami();
