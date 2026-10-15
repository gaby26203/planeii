ALTER TABLE public.trip_todos ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY trip_id ORDER BY created_at ASC) AS rn
  FROM public.trip_todos
)
UPDATE public.trip_todos t
SET sort_order = ranked.rn
FROM ranked
WHERE ranked.id = t.id;

CREATE INDEX IF NOT EXISTS trip_todos_trip_sort_idx ON public.trip_todos (trip_id, sort_order);