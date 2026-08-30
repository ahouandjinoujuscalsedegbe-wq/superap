CREATE TABLE public.coffre_sync (
  id BIGSERIAL PRIMARY KEY,
  salon TEXT NOT NULL,
  appareil TEXT NOT NULL,
  contenu TEXT NOT NULL,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX coffre_sync_salon_id_idx ON public.coffre_sync (salon, id);

GRANT ALL ON public.coffre_sync TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.coffre_sync_id_seq TO service_role;

ALTER TABLE public.coffre_sync ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sync_publier(
  p_salon TEXT,
  p_appareil TEXT,
  p_contenu TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF p_salon IS NULL OR length(p_salon) < 16 OR length(p_salon) > 128 THEN
    RAISE EXCEPTION 'salon invalide';
  END IF;
  IF p_contenu IS NULL OR length(p_contenu) > 4000000 THEN
    RAISE EXCEPTION 'contenu invalide';
  END IF;

  DELETE FROM public.coffre_sync WHERE cree_le < now() - interval '30 days';

  INSERT INTO public.coffre_sync (salon, appareil, contenu)
  VALUES (p_salon, left(coalesce(p_appareil, 'APPAREIL'), 60), p_contenu)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_lire(
  p_salon TEXT,
  p_appareil TEXT,
  p_depuis BIGINT
) RETURNS TABLE (id BIGINT, appareil TEXT, contenu TEXT, cree_le TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_salon IS NULL OR length(p_salon) < 16 OR length(p_salon) > 128 THEN
    RAISE EXCEPTION 'salon invalide';
  END IF;

  RETURN QUERY
  SELECT c.id, c.appareil, c.contenu, c.cree_le
  FROM public.coffre_sync c
  WHERE c.salon = p_salon
    AND c.id > coalesce(p_depuis, 0)
    AND c.appareil IS DISTINCT FROM p_appareil
  ORDER BY c.id
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_publier(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_lire(TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_publier(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_lire(TEXT, TEXT, BIGINT) TO anon, authenticated, service_role;