import { useState } from "react";
import { CheckCircle2, Download, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { chiffrer, horodatageFichier, telecharger } from "@/lib/sauvegarde";
import { lignesRecap, purgerToutStockage, type RecapPurge } from "@/lib/purge";
import { consigner } from "@/lib/journal-donnees";

/**
 * Purge complète avec export chiffré optionnel, barre de progression,
 * messages détaillés et écran de succès récapitulatif.
 */
export function SectionPurge() {
  const app = useSuperApp();
  const [etape, setEtape] = useState<0 | 1 | 2 | 3>(0);
  const [sauvegarderAvant, setSauvegarderAvant] = useState(true);
  const [phrase, setPhrase] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [progression, setProgression] = useState(0);
  const [message, setMessage] = useState("");
  const [recap, setRecap] = useState<RecapPurge | null>(null);

  const fermer = () => {
    if (occupe || etape === 3) return;
    setEtape(0);
  };

  const avancer = (pourcentage: number, texte: string) => {
    setProgression(pourcentage);
    setMessage(texte);
  };

  const executer = async () => {
    if (sauvegarderAvant && phrase.trim().length < 6) {
      toast.error("Phrase secrète trop courte (6 caractères minimum).");
      return;
    }
    setOccupe(true);
    setProgression(0);
    try {
      if (sauvegarderAvant) {
        avancer(5, "Préparation de vos données…");
        const etat = app.etatComplet();
        avancer(20, "Chiffrement AES-GCM en cours…");
        const enveloppe = await chiffrer(etat, phrase.trim());
        avancer(45, "Génération du fichier de sauvegarde…");
        const nom = `superapp-sauvegarde-avant-purge-${horodatageFichier()}.sadc`;
        telecharger(nom, JSON.stringify(enveloppe, null, 2));
        consigner("export-chiffre", `Fichier ${nom} (avant purge complète).`);
        avancer(55, "Sauvegarde chiffrée téléchargée.");
        toast.success("Sauvegarde chiffrée téléchargée. Conservez-la en lieu sûr.");
        await new Promise((r) => setTimeout(r, 600));
      }

      const resultat = await purgerToutStockage((p) =>
        avancer(
          sauvegarderAvant ? 55 + Math.round(p.pourcentage * 0.45) : p.pourcentage,
          p.message,
        ),
      );
      setRecap(resultat);
      setEtape(3);
      toast.success("Toutes les données locales ont été supprimées.");
    } catch {
      toast.error("La sauvegarde a échoué : suppression annulée par sécurité.");
      setMessage("");
      setProgression(0);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <section className="carte space-y-3 border-destructive/40 p-4" data-test="section-purge">
      <h2 className="flex items-center gap-2 font-semibold text-destructive">
        <TriangleAlert className="h-4 w-4" aria-hidden /> Zone dangereuse
      </h2>
      <p className="text-sm text-muted-foreground">
        Supprime définitivement toutes les données de l'application sur cet appareil : comptes,
        enveloppes, opérations, dettes, budgets, sauvegardes automatiques, paramètres, code PIN,
        bases IndexedDB, caches hors ligne, cookies et service workers. Cette action est
        irréversible.
      </p>
      <button
        type="button"
        data-test="ouvrir-purge"
        onClick={() => {
          setRecap(null);
          setMessage("");
          setProgression(0);
          setEtape(1);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground"
      >
        <Trash2 className="h-4 w-4" aria-hidden /> Supprimer toutes les données
      </button>

      {etape > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmation de suppression totale"
          onClick={fermer}
          onKeyDown={(e) => e.key === "Escape" && fermer()}
        >
          <div
            className="surface max-h-[90vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-2xl border border-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {etape === 1 && (
              <>
                <h3 className="text-lg font-bold text-destructive">Tout supprimer ?</h3>
                <p className="text-sm text-muted-foreground">
                  Vous êtes sur le point d'effacer <strong>toutes</strong> vos données locales.
                  Aucune copie ne sera conservée sur cet appareil.
                </p>
                <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    data-test="option-sauvegarde"
                    checked={sauvegarderAvant}
                    onChange={(e) => setSauvegarderAvant(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <strong>Exporter une sauvegarde chiffrée</strong> juste avant la suppression
                    (recommandé). Le fichier <code>.sadc</code> sera téléchargé sur cet appareil.
                  </span>
                </label>
                {sauvegarderAvant && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" htmlFor="phrase-purge">
                      Phrase secrète de la sauvegarde
                    </label>
                    <input
                      id="phrase-purge"
                      type="password"
                      value={phrase}
                      onChange={(e) => setPhrase(e.target.value)}
                      placeholder="6 caractères minimum"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Notez cette phrase : sans elle, la sauvegarde est impossible à restaurer. Vous
                      pourrez la réimporter depuis « Restaurer mes données ».
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fermer}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    data-test="purge-continuer"
                    onClick={() => setEtape(2)}
                    className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground"
                  >
                    Continuer
                  </button>
                </div>
              </>
            )}

            {etape === 2 && (
              <>
                <h3 className="text-lg font-bold text-destructive">Dernière confirmation</h3>
                <p className="text-sm text-muted-foreground">
                  Cette action est <strong>définitive et irréversible</strong>.{" "}
                  {sauvegarderAvant
                    ? "Une sauvegarde chiffrée sera téléchargée avant la suppression."
                    : "Aucune sauvegarde ne sera créée."}{" "}
                  L'application redémarrera vide, comme à la première installation.
                </p>

                {(occupe || progression > 0) && (
                  <div className="space-y-2" data-test="progression-purge">
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={progression}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progression de la suppression"
                    >
                      <div
                        className="h-full rounded-full bg-destructive transition-all duration-300"
                        style={{ width: `${progression}%` }}
                      />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {progression}% — {message}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fermer}
                    disabled={occupe}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    data-test="purge-confirmer"
                    onClick={executer}
                    disabled={occupe}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-60"
                  >
                    {occupe ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> En cours…
                      </>
                    ) : sauvegarderAvant ? (
                      <>
                        <Download className="h-4 w-4" aria-hidden /> Sauvegarder puis supprimer
                      </>
                    ) : (
                      "Supprimer définitivement"
                    )}
                  </button>
                </div>
              </>
            )}

            {etape === 3 && recap && (
              <div data-test="purge-succes" className="space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" aria-hidden /> Suppression réussie
                </h3>
                <p className="text-sm text-muted-foreground">
                  Récapitulatif des espaces de stockage effacés sur cet appareil :
                </p>
                <ul className="space-y-1 rounded-xl border border-border p-3 text-sm">
                  {lignesRecap(recap).map((l) => (
                    <li key={l.nom} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{l.nom}</span>
                      <span className="font-semibold">{l.valeur}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  data-test="demarrer-a-zero"
                  onClick={() => window.location.reload()}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Démarrer à zéro
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
