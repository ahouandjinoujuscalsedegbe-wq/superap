-- Index utile au comptage anti-abus et à la purge par salon
CREATE INDEX IF NOT EXISTS coffre_sync_salon_cree_le_idx ON public.coffre_sync (salon, cree_le DESC);

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
  v_recents INT;
BEGIN
  -- Le salon est une empreinte SHA-256 hexadécimale : exactement 64 caractères.
  -- Cela interdit tout identifiant court, donc devinable.
  IF p_salon IS NULL OR p_salon !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'salon invalide';
  END IF;
  IF p_contenu IS NULL OR length(p_contenu) = 0 OR length(p_contenu) > 2000000 THEN
    RAISE EXCEPTION 'contenu invalide';
  END IF;

  -- Limite anti-abus : pas plus de 120 depots par heure pour un meme salon.
  SELECT count(*) INTO v_recents
  FROM public.coffre_sync
  WHERE salon = p_salon AND cree_le > now() - interval '1 hour';

  IF v_recents >= 120 THEN
    RAISE EXCEPTION 'trop de depots, reessayez plus tard';
  END IF;

  -- Retention courte : rien ne reste en ligne au-dela de 7 jours.
  DELETE FROM public.coffre_sync WHERE cree_le < now() - interval '7 days';

  INSERT INTO public.coffre_sync (salon, appareil, contenu)
  VALUES (p_salon, left(coalesce(p_appareil, 'APPAREIL'), 60), p_contenu)
  RETURNING id INTO v_id;

  -- Un salon ne conserve que ses 200 derniers depots.
  DELETE FROM public.coffre_sync
  WHERE salon = p_salon
    AND id < (
      SELECT min(id) FROM (
        SELECT id FROM public.coffre_sync
        WHERE salon = p_salon
        ORDER BY id DESC
        LIMIT 200
      ) AS derniers
    );

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
  IF p_salon IS NULL OR p_salon !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'salon invalide';
  END IF;

  RETURN QUERY
  SELECT c.id, c.appareil, c.contenu, c.cree_le
  FROM public.coffre_sync c
  WHERE c.salon = p_salon
    AND c.id > coalesce(p_depuis, 0)
    AND c.appareil IS DISTINCT FROM p_appareil
  ORDER BY c.id
  LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_publier(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_lire(TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_publier(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_lire(TEXT, TEXT, BIGINT) TO anon, authenticated, service_role;