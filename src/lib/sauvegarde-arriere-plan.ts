/**
 * Relais « application fermée ».
 *
 * Le colis chiffré est confié à un service worker : le système d'exploitation
 * peut le réveiller au retour d'Internet (Background Sync) ou de temps en
 * temps (Periodic Sync), même si l'application n'est plus ouverte.
 */

const BASE = "superapp-sauvegarde";
const MAGASIN = "colis";
const ETIQUETTE = "sauvegarde-email";

export type ColisArrierePlan = {
  email: string;
  appareil: string;
  colis: string;
  creeLe: string;
};

function disponible(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof indexedDB !== "undefined"
  );
}

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE, 1);
    requete.onupgradeneeded = () => {
      if (!requete.result.objectStoreNames.contains(MAGASIN)) {
        requete.result.createObjectStore(MAGASIN);
      }
    };
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

async function ecrire(cle: string, valeur: unknown): Promise<void> {
  const base = await ouvrirBase();
  await new Promise<void>((resoudre) => {
    const r = base.transaction(MAGASIN, "readwrite").objectStore(MAGASIN).put(valeur, cle);
    r.onsuccess = () => resoudre();
    r.onerror = () => resoudre();
  });
}

async function supprimer(cle: string): Promise<void> {
  const base = await ouvrirBase();
  await new Promise<void>((resoudre) => {
    const r = base.transaction(MAGASIN, "readwrite").objectStore(MAGASIN).delete(cle);
    r.onsuccess = () => resoudre();
    r.onerror = () => resoudre();
  });
}

let enregistrement: Promise<ServiceWorkerRegistration | null> | null = null;

/** Installe (une seule fois) le service worker de sauvegarde. */
export function preparerArrierePlan(): Promise<ServiceWorkerRegistration | null> {
  if (!disponible()) return Promise.resolve(null);
  if (!enregistrement) {
    enregistrement = navigator.serviceWorker
      .register("/sw-sauvegarde.js", { scope: "/" })
      .then(async (reg) => {
        const periodique = (
          reg as ServiceWorkerRegistration & {
            periodicSync?: { register: (t: string, o: object) => Promise<void> };
          }
        ).periodicSync;
        try {
          await periodique?.register(ETIQUETTE, { minInterval: 3 * 60 * 60 * 1000 });
        } catch {
          /* non pris en charge : la reprise réseau suffit */
        }
        return reg;
      })
      .catch(() => null);
  }
  return enregistrement;
}

/**
 * Confie le colis au service worker et demande son envoi dès que possible,
 * y compris après la fermeture de l'application.
 */
export async function confierColisArrierePlan(colis: ColisArrierePlan): Promise<void> {
  if (!disponible()) return;
  const reg = await preparerArrierePlan();
  if (!reg) return;
  await ecrire("courant", colis);
  const sync = (
    reg as ServiceWorkerRegistration & {
      sync?: { register: (t: string) => Promise<void> };
    }
  ).sync;
  try {
    await sync?.register(ETIQUETTE);
  } catch {
    /* Background Sync indisponible */
  }
  reg.active?.postMessage({ type: "envoyer-maintenant" });
}

/** Retire le colis confié (l'envoi a déjà réussi depuis l'application). */
export async function oublierColisArrierePlan(): Promise<void> {
  if (!disponible()) return;
  try {
    await supprimer("courant");
  } catch {
    /* rien à retirer */
  }
}
