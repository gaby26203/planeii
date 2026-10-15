
CREATE TABLE public.account_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  refund_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_method_fees JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_presets JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra_presets JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_defaults TO authenticated;
GRANT ALL ON public.account_defaults TO service_role;

ALTER TABLE public.account_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own defaults"
  ON public.account_defaults FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_account_defaults_updated_at
  BEFORE UPDATE ON public.account_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
