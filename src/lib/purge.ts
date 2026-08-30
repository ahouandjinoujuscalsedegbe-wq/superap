/**
 * Purge de tous les stockages persistants de l'application :
 * localStorage, sessionStorage, IndexedDB, caches hors ligne,
 * service workers et cookies de l'origine.
 */

import { consigner, ecrireJournal, lireJournal } from "@/lib/journal-donnees";

export type RecapPurge = {
  localStorage: number;
  sessionStorage: number;
  indexedDB: number;
  caches: number;
  cookies: number;
  serviceWorkers: number;
};

export type Progression = {
  pourcentage: number;
  message: string;
};

export const BASES_CONNUES = ["superapp", "superapp-db", "keyval-store", "localforage"];

function noop() {}

/** Supprime tous les stockages. `onProgress` reçoit des étapes détaillées. */
export async function purgerToutStockage(
  onProgress: (p: Progression) => void = noop,
  options: { conserverJournal?: boolean } = {},
): Promise<RecapPurge> {
  const conserverJournal = options.conserverJournal !== false;
  const journal = conserverJournal ? lireJournal() : [];

  const recap: RecapPurge = {
    localStorage: 0,
    sessionStorage: 0,
    indexedDB: 0,
    caches: 0,
    cookies: 0,
    serviceWorkers: 0,
  };

  onProgress({ pourcentage: 5, message: "Effacement du stockage local…" });
  try {
    recap.localStorage = window.localStorage.length;
    window.localStorage.clear();
  } catch {
    /* noop */
  }

  onProgress({ pourcentage: 20, message: "Effacement du stockage de session…" });
  try {
    recap.sessionStorage = window.sessionStorage.length;
    window.sessionStorage.clear();
  } catch {
    /* noop */
  }

  onProgress({ pourcentage: 35, message: "Suppression des bases IndexedDB…" });
  try {
    const idb = window.indexedDB;
    if (idb) {
      let noms: string[] = [];
      if (typeof idb.databases === "function") {
        const bases = await idb.databases();
        noms = bases.map((b) => b.name).filter((n): n is string => Boolean(n));
      }
      if (noms.length === 0) noms = BASES_CONNUES;
      for (const nom of noms) {
        // eslint-disable-next-line no-await-in-loop
        const supprimee = await new Promise<boolean>((resoudre) => {
          try {
            const req = idb.deleteDatabase(nom);
            req.onsuccess = () => resoudre(true);
            req.onerror = () => resoudre(false);
            req.onblocked = () => resoudre(false);
          } catch {
            resoudre(false);
          }
        });
        if (supprimee) recap.indexedDB += 1;
      }
    }
  } catch {
    /* noop */
  }

  onProgress({ pourcentage: 60, message: "Vidage des caches hors ligne…" });
  try {
    if (typeof caches !== "undefined") {
      const cles = await caches.keys();
      recap.caches = cles.length;
      await Promise.all(cles.map((c) => caches.delete(c)));
    }
  } catch {
    /* noop */
  }

  onProgress({ pourcentage: 78, message: "Désinscription des service workers…" });
  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      recap.serviceWorkers = regs.length;
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* noop */
  }

  onProgress({ pourcentage: 90, message: "Suppression des cookies de l'application…" });
  try {
    const cookies = document.cookie ? document.cookie.split(";") : [];
    const noms = cookies.map((c) => c.split("=")[0]?.trim()).filter(Boolean) as string[];
    recap.cookies = noms.length;
    for (const nom of noms) {
      document.cookie = `${nom}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  } catch {
    /* noop */
  }

  if (conserverJournal) {
    ecrireJournal(journal);
    consigner(
      "purge",
      `${recap.localStorage} entrée(s) locales, ${recap.sessionStorage} de session, ${recap.indexedDB} base(s) IndexedDB, ${recap.caches} cache(s), ${recap.cookies} cookie(s), ${recap.serviceWorkers} service worker(s).`,
    );
  }

  onProgress({ pourcentage: 100, message: "Suppression terminée." });
  return recap;
}

export function lignesRecap(recap: RecapPurge) {
  return [
    { nom: "Stockage local (localStorage)", valeur: `${recap.localStorage} entrée(s)` },
    { nom: "Stockage de session", valeur: `${recap.sessionStorage} entrée(s)` },
    { nom: "Bases IndexedDB", valeur: `${recap.indexedDB} base(s)` },
    { nom: "Caches hors ligne", valeur: `${recap.caches} cache(s)` },
    { nom: "Cookies de l'application", valeur: `${recap.cookies} cookie(s)` },
    { nom: "Service workers", valeur: `${recap.serviceWorkers} enregistrement(s)` },
  ];
}
