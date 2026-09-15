import { useEffect, useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useSuperApp, type Etat } from "@/lib/store";
import {
  chercherCopieTelephone,
  ouvrirCopieTelephone,
  type CopieTrouvee,
} from "@/lib/sauvegarde-avant-maj";

/**
 * Après une réinstallation (mise à jour qui a dû désinstaller l'ancienne
 * version), l'application démarre vide. Si une copie de secours a été laissée
 * dans les Documents du téléphone, on propose ici de la restaurer.
 */
export function RestaurationApresReinstallation() {
  const app = useSuperApp();
  const [copie, setCopie] = useState<CopieTrouvee | null>(null);
  const [phrase, setPhrase] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ignore, setIgnore] = useState(false);

  const vide =
    !app.chargement &&
    app.transactions.length === 0 &&
    app.enveloppes.length === 0 &&
    app.objectifs.length === 0;

  useEffect(() => {
    if (!vide || copie || ignore) return;
    let actif = true;
    void chercherCopieTelephone().then((trouve) => {
      if (actif && trouve) setCopie(trouve);
    });
    return () => {
      actif = false;
    };
  }, [vide, copie, ignore]);

  if (!copie || !vide || ignore) return null;

  async function restaurer() {
    if (!copie) return;
    setErreur("");
    if (phrase.trim().length < 1) {
      setErreur("Saisissez votre phrase de récupération.");
      return;
    }
    setOccupe(true);
    try {
      const donnees = (await ouvrirCopieTelephone(copie.contenu, phrase)) as Partial<Etat>;
      if (!donnees || !Array.isArray(donnees.transactions)) {
        setErreur("Cette copie ne contient pas de données SUPER APP valides.");
        return;
      }
      app.remplacerEtat(donnees);
      toast.success("Vos données ont été restaurées sur ce téléphone.");
      setIgnore(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Restauration impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Copie de secours trouvée"
    >
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xl">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <LifeBuoy aria-hidden className="h-5 w-5 text-primary" /> Copie de secours trouvée
        </h3>
        <p className="text-sm text-muted-foreground">
          L'application est vide, mais une copie de vos données est enregistrée sur ce téléphone
          (fichier {copie.chemin}). Saisissez votre phrase de récupération pour tout remettre en
          place.
        </p>
        <input
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Phrase de récupération"
          data-majuscules="non"
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        {erreur && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erreur}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIgnore(true)}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Plus tard
          </button>
          <button
            type="button"
            disabled={occupe}
            onClick={() => void restaurer()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
          >
            {occupe && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            Restaurer mes données
          </button>
        </div>
      </div>
    </div>
  );
}
