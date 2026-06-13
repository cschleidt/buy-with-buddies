CREATE TABLE public.saved_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  url text,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_recipes TO anon, authenticated;
GRANT ALL ON public.saved_recipes TO service_role;

ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access to saved_recipes" ON public.saved_recipes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_saved_recipes_user ON public.saved_recipes(user_id, created_at DESC);
