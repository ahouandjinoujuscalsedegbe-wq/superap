import { useState } from "react";
import { CheckCircle2, Download, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { chiffrer, horodatageFichier, telecharger } from "@/lib/sauvegarde";

type Recap = {
  localStorage: number;
  sessionStorage: number;
  indexedDB: number;
  caches: number;
  cookies: number;
};

async function purgerToutStockage(): Promise<Recap> {
  const recap: Recap = {
    localStorage: 0,
    sessionStorage: 0,
    indexedDB: 0,
    caches: 0,
    cookies: 0,
  };

  try {
    recap.localStorage = window.localStorage.length;
    window.localStorage.clear();
  } catch {
    /* noop */
  }
  try {
    recap.sessionStorage = window.sessionStorage.length;
    window.sessionStorage.clear();
  } catch {
    /* noop */
  }

  // IndexedDB : suppression de toutes les bases connues.
  try {
    const idb = window.indexedDB;
    if (idb) {
      let noms: string[] = [];
      if (typeof idb.databases === "function") {
        const bases = await idb.databases();
        noms = bases.map((b) => b.name).filter((n): n is string => Boolean(n));
      }
      if (noms.length === 0) {
        noms = ["superapp", "superapp-db", "keyval-store", "localforage"];
      }
      await Promise.all(
        noms.map(
          (nom) =>
            new Promise<void>((resoudre) => {
              try {
                const req = idb.deleteDatabase(nom);
                req.onsuccess = () => {
                  recap.indexedDB += 1;
                  resoudre();
                };
                req.onerror = () => resoudre();
                req.onblocked = () => resoudre();
              } catch {
                resoudre();
              }
            }),
        ),
      );
    }
  } catch {
    /* noop */
  }

  // Caches (PWA / hors ligne)
  try {
    if (typeof caches !== "undefined") {
      const cles = await caches.keys();
      recap.caches = cles.length;
      await Promise.all(cles.map((c) => caches.delete(c)));
    }
  } catch {
    /* noop */
  }

  // Service workers (les réenregistrera au prochain démarrage)
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* noop */
  }

  // Cookies éventuels de l'origine
  try {
    const cookies = document.cookie ? document.cookie.split(";") : [];
    recap.cookies = cookies.filter((c) => c.trim()).length;
    for (const c of cookies) {
      const nom = c.split("=")[0]?.trim();
      if (nom) document.cookie = `${nom}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  } catch {
    /* noop */
  }

  return recap;
}

/**
 * Purge complète : localStorage, sessionStorage, IndexedDB, caches,
 * service workers et cookies. Export chiffré optionnel avant suppression,
 * puis récapitulatif des espaces effacés.
 */
export function SectionPurge() {
  const app = useSuperApp();
  const [etape, setEtape] = useState<0 | 1 | 2 | 3>(0);
  const [sauvegarderAvant, setSauvegarderAvant] = useState(true);
  const [phrase, setPhrase] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);

  const fermer = () => {
    if (occupe || etape === 3) return;
    setEtape(0);
  };

  const executer = async () => {
    if (sauvegarderAvant && phrase.trim().length < 6) {
      toast.error("Phrase secrète trop courte (6 caractères minimum).");
      return;
    }
    setOccupe(true);
    try {
      if (sauvegarderAvant) {
        const enveloppe = await chiffrer(app.etatComplet(), phrase.trim());
        telecharger(
          `superapp-sauvegarde-avant-purge-${horodatageFichier()}.sadc`,
          JSON.stringify(enveloppe, null, 2),
        );
        toast.success("Sauvegarde chiffrée téléchargée. Conservez-la en lieu sûr.");
        await new Promise((r) => setTimeout(r, 900));
      }
      const resultat = await purgerToutStockage();
      setRecap(resultat);
      setEtape(3);
      toast.success("Toutes les données locales ont été supprimées.");
    } catch {
      toast.error("La sauvegarde a échoué : suppression annulée par sécurité.");
    } finally {
      setOccupe(false);
    }
  };

  const lignes = recap
    ? [
        { nom: "Stockage local (localStorage)", valeur: `${recap.localStorage} entrée(s)` },
        { nom: "Stockage de session", valeur: `${recap.sessionStorage} entrée(s)` },
        { nom: "Bases IndexedDB", valeur: `${recap.indexedDB} base(s)` },
        { nom: "Caches hors ligne", valeur: `${recap.caches} cache(s)` },
        { nom: "Cookies de l'application", valeur: `${recap.cookies} cookie(s)` },
      ]
    : [];

  return (
    <section className="carte space-y-3 border-destructive/40 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-destructive">
        <TriangleAlert className="h-4 w-4" aria-hidden /> Zone dangereuse
      </h2>
      <p className="text-sm text-muted-foreground">
        Supprime définitivement toutes les données de l'application sur cet appareil : comptes,
        enveloppes, opérations, dettes, budgets, sauvegardes automatiques, paramètres, code PIN,
        bases IndexedDB et caches hors ligne. Cette action est irréversible.
      </p>
      <button
        type="button"
        onClick={() => {
          setRecap(null);
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
                      pourrez la réimporter depuis l'onglet Sauvegarde.
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

            {etape === 3 && (
              <>
                <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" aria-hidden /> Suppression réussie
                </h3>
                <p className="text-sm text-muted-foreground">
                  Récapitulatif des espaces de stockage effacés sur cet appareil :
                </p>
                <ul className="space-y-1 rounded-xl border border-border p-3 text-sm">
                  {lignes.map((l) => (
                    <li key={l.nom} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{l.nom}</span>
                      <span className="font-semibold">{l.valeur}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Démarrer à zéro
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
