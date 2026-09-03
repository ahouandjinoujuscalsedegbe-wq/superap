-- Le coffre de synchronisation n'est plus appelable directement depuis
-- l'application : seules les fonctions serveur (rôle service_role) y accèdent.
REVOKE EXECUTE ON FUNCTION public.sync_publier(TEXT, TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_lire(TEXT, TEXT, BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_publier(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_lire(TEXT, TEXT, BIGINT) TO service_role;