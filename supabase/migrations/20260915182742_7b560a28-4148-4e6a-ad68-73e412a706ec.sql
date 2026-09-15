CREATE TABLE public.coffre_email (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cle TEXT NOT NULL,
  empreinte TEXT NOT NULL,
  contenu TEXT NOT NULL,
  appareil TEXT,
  taille INTEGER,
  classement TEXT,
  cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (cle, empreinte)
);

CREATE INDEX coffre_email_cle_date_idx ON public.coffre_email (cle, cree_le DESC);

GRANT ALL ON public.coffre_email TO service_role;

ALTER TABLE public.coffre_email ENABLE ROW LEVEL SECURITY;