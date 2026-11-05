ALTER TABLE public.trip_notes ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY trip_id ORDER BY created_at ASC) AS rn
  FROM public.trip_notes
)
UPDATE public.trip_notes n SET sort_order = o.rn FROM ordered o WHERE n.id = o.id AND n.sort_order = 0;