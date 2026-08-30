import { useEffect, useState } from "react";
import { CloudCog, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ecrireReglagesAuto, lireReglagesAuto, type ReglagesAuto } from "@/lib/sync-auto";
import { EVENEMENT_SYNC_AUTO } from "@/components/SyncAuto";

function horodatage(iso?: string): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "jamais" : d.toLocaleString("fr-FR");
}

/** Réglages de la synchronisation automatique chiffrée entre les deux téléphones. */
export function SectionSyncAuto() {
  const [reglages, setReglages] = useState<ReglagesAuto | null>(null);
  const [phrase, setPhrase] = useState("");
  const [appareil, setAppareil] = useState("");

  useEffect(() => {
    const lu = lireReglagesAuto();
    setReglages(lu);
    setPhrase(lu.phrase);
    setAppareil(lu.appareil);
  }, []);

  if (!reglages) return null;

  const appliquer = (suite: ReglagesAuto) => {
    ecrireReglagesAuto(suite);
    setReglages(suite);
    window.dispatchEvent(new Event(EVENEMENT_SYNC_AUTO));
  };

  const enregistrer = () => {
    const p = phrase.trim();
    const a = appareil.trim().toUpperCase();
    if (p.length < 6) {
      toast.error("La phrase secrète doit contenir au moins 6 caractères.");
      return;
    }
    if (!a) {
      toast.error("Donnez un nom à cet appareil (par exemple MON TÉLÉPHONE).");
      return;
    }
    const changementPhrase = p !== reglages.phrase;
    appliquer({
      ...reglages,
      phrase: p,
      appareil: a,
      actif: true,
      // Nouvelle phrase = nouveau salon : on repart au début.
      curseur: changementPhrase ? 0 : reglages.curseur,
    });
    toast.success("Synchronisation automatique activée.");
  };

  const arreter = () => {
    appliquer({ ...reglages, actif: false });
    toast.message("Synchronisation automatique désactivée.");
  };

  return (
    <section className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <CloudCog className="h-5 w-5 text-primary" aria-hidden />
        Synchronisation automatique (chiffrée)
      </h2>
      <p className="text-sm text-muted-foreground">
        Chaque modification part automatiquement, déjà chiffrée, et arrive sur l'autre téléphone en
        quelques secondes. Les deux saisies sont conservées : rien n'est écrasé.
      </p>

      <label className="block text-sm font-semibold" htmlFor="sync-appareil">
        Nom de cet appareil
        <input
          id="sync-appareil"
          value={appareil}
          onChange={(e) => setAppareil(e.target.value)}
          placeholder="TÉLÉPHONE DE L'ÉPOUX"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal"
        />
      </label>

      <label className="block text-sm font-semibold" htmlFor="sync-phrase">
        Phrase secrète commune au couple
        <input
          id="sync-phrase"
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="La même sur les deux téléphones"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal"
        />
      </label>

      <p className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          La phrase secrète ne quitte jamais le téléphone : elle sert à chiffrer les données avant
          l'envoi. Sans elle, personne ne peut lire vos données. Saisissez exactement la même sur
          les deux téléphones.
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={enregistrer}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {reglages.actif ? "Mettre à jour" : "Activer la synchronisation"}
        </button>
        {reglages.actif ? (
          <button
            type="button"
            onClick={arreter}
            className="rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive"
          >
            Désactiver
          </button>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <dt className="font-semibold">Dernier envoi</dt>
          <dd>{horodatage(reglages.dernierEnvoi)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Dernière réception</dt>
          <dd>{horodatage(reglages.dernierRecu)}</dd>
        </div>
      </dl>
    </section>
  );
}
