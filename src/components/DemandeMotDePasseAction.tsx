import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { enregistrerDemandeurMdp, verifierMotDePasse } from "@/lib/mot-de-passe-actions";

/**
 * Fenêtre de confirmation : exige le mot de passe avant toute modification
 * ou suppression de données.
 */
export function DemandeMotDePasseAction() {
  const [ouvert, setOuvert] = useState(false);
  const [libelle, setLibelle] = useState("Confirmez cette action");
  const [valeur, setValeur] = useState("");
  const [erreur, setErreur] = useState("");
  const reponse = useRef<((ok: boolean) => void) | null>(null);

  useEffect(
    () =>
      enregistrerDemandeurMdp(
        (texte) =>
          new Promise<boolean>((resoudre) => {
            setLibelle(texte);
            setValeur("");
            setErreur("");
            setOuvert(true);
            reponse.current = resoudre;
          }),
      ),
    [],
  );

  const fermer = (ok: boolean) => {
    setOuvert(false);
    setValeur("");
    reponse.current?.(ok);
    reponse.current = null;
  };

  if (!ouvert) return null;

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifierMotDePasse(valeur)) {
      fermer(true);
      return;
    }
    setValeur("");
    setErreur("Mot de passe incorrect.");
  };

  return (
    <div className="fixed inset-0 z-[97] flex items-center justify-center bg-background/95 px-6">
      <form onSubmit={valider} className="surface w-full max-w-xs space-y-4 rounded-2xl border border-border p-5 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border text-primary">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="text-base font-bold tracking-tight">Action protégée</h2>
        <p className="text-xs text-muted-foreground">{libelle}</p>
        <input
          type="password"
          autoFocus
          value={valeur}
          onChange={(ev) => {
            setValeur(ev.target.value);
            setErreur("");
          }}
          placeholder="Mot de passe"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center text-sm"
        />
        {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fermer(false)}
            className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Confirmer
          </button>
        </div>
      </form>
    </div>
  );
}
