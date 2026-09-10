import { useEffect, useState } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { Vault } from "lucide-react";
import {
  PAGES_SENSIBLES,
  coffreSensibleConfigure,
  coffreSensibleOuvert,
  ouvrirCoffreSensible,
} from "@/lib/coffre-sensible";
import { lireOptions } from "@/lib/securite-avancee";
import { retourIntelligent } from "@/lib/retour";

/**
 * Deuxième coffre : les pages sensibles (objectifs, dettes, sauvegarde,
 * journal) réclament une phrase distincte, une fois par session.
 */
export function GardeCoffreSensible() {
  const { pathname } = useLocation();
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(() => coffreSensibleOuvert());

  const sensible = PAGES_SENSIBLES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const actif = lireOptions().doubleCoffre && coffreSensibleConfigure();

  useEffect(() => {
    setPhrase("");
    setErreur("");
    setOuvert(coffreSensibleOuvert());
  }, [pathname]);

  if (!actif || !sensible || ouvert) return null;

  const valider = async () => {
    const ok = await ouvrirCoffreSensible(phrase);
    if (ok) setOuvert(true);
    else setErreur("Phrase incorrecte.");
  };

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs space-y-4 text-center">
        <span className="surface mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border text-primary">
          <Vault className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-lg font-bold tracking-tight">Coffre sensible</h1>
        <p className="text-xs text-muted-foreground">
          Cette page contient vos données les plus sensibles. Saisissez la phrase du deuxième
          coffre.
        </p>
        <input
          type="password"
          value={phrase}
          onChange={(e) => {
            setPhrase(e.target.value);
            setErreur("");
          }}
          placeholder="Phrase du deuxième coffre"
          className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
        />
        {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}
        <button
          type="button"
          onClick={() => void valider()}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          Ouvrir
        </button>
        <button
          type="button"
          onClick={() => retourIntelligent(router)}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
        >
          Retour
        </button>
      </div>
    </div>
  );
}
