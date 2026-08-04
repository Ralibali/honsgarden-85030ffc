
CREATE TABLE public.egg_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period TEXT NOT NULL DEFAULT 'weekly',
  target_count INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.egg_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm egg goals"
ON public.egg_goals
FOR ALL
USING (user_id IN (SELECT get_farm_user_ids(auth.uid())))
WITH CHECK (user_id IN (SELECT get_farm_user_ids(auth.uid())));

CREATE POLICY "Admins can view all egg goals"
ON public.egg_goals
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_egg_goals_updated_at
BEFORE UPDATE ON public.egg_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
