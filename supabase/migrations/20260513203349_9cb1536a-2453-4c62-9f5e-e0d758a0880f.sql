CREATE OR REPLACE FUNCTION public.get_hen_ancestors(_hen_id uuid, _generations integer DEFAULT 3)
RETURNS TABLE(
  id uuid,
  name text,
  breed text,
  color text,
  birth_date date,
  hen_type text,
  image_url text,
  mother_id uuid,
  father_id uuid,
  depth integer,
  relation text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE ancestry AS (
    SELECT h.id, h.name, h.breed, h.color, h.birth_date, h.hen_type, h.image_url,
           h.mother_id, h.father_id, 0 AS depth, 'self'::text AS relation,
           ARRAY[h.id] AS path
    FROM public.hens h
    WHERE h.id = _hen_id
      AND h.user_id IN (SELECT public.get_farm_user_ids(auth.uid()))

    UNION ALL

    SELECT p.id, p.name, p.breed, p.color, p.birth_date, p.hen_type, p.image_url,
           p.mother_id, p.father_id, a.depth + 1,
           CASE WHEN p.id = a.mother_id THEN 'mother' ELSE 'father' END,
           a.path || p.id
    FROM ancestry a
    JOIN public.hens p
      ON (p.id = a.mother_id OR p.id = a.father_id)
    WHERE a.depth < _generations
      AND NOT (p.id = ANY(a.path))
      AND p.user_id IN (SELECT public.get_farm_user_ids(auth.uid()))
  )
  SELECT id, name, breed, color, birth_date, hen_type, image_url,
         mother_id, father_id, depth, relation
  FROM ancestry;
$$;