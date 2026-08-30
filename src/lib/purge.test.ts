import { beforeEach, describe, expect, it, vi } from "vitest";
import { purgerToutStockage } from "@/lib/purge";
import { CLE_JOURNAL, consigner, lireJournal } from "@/lib/journal-donnees";

/** Faux stockage compatible avec l'API Storage. */
function faireStockage(initial: Record<string, string> = {}) {
  const carte = new Map(Object.entries(initial));
  return {
    get length() {
      return carte.size;
    },
    getItem: (k: string) => carte.get(k) ?? null,
    setItem: (k: string, v: string) => void carte.set(k, String(v)),
    removeItem: (k: string) => void carte.delete(k),
    clear: () => carte.clear(),
    key: (i: number) => [...carte.keys()][i] ?? null,
    _carte: carte,
  } as unknown as Storage & { _carte: Map<string, string> };
}

let basesSupprimees: string[] = [];
let cachesSupprimes: string[] = [];
let swDesinscrits = 0;

beforeEach(() => {
  basesSupprimees = [];
  cachesSupprimes = [];
  swDesinscrits = 0;

  const local = faireStockage({ "superapp:etat": "{}", "superapp:pin": "1234" });
  const session = faireStockage({ tmp: "1" });

  const indexedDB = {
    databases: async () => [{ name: "superapp" }, { name: "autre-base" }],
    deleteDatabase: (nom: string) => {
      const req: Record<string, unknown> = {};
      queueMicrotask(() => {
        basesSupprimees.push(nom);
        (req["onsuccess"] as (() => void) | undefined)?.();
      });
      return req;
    },
  };

  const caches = {
    keys: async () => ["assets-v1", "pages-v1"],
    delete: async (c: string) => {
      cachesSupprimes.push(c);
      return true;
    },
  };

  const navigateur = {
    serviceWorker: {
      getRegistrations: async () => [
        {
          unregister: async () => {
            swDesinscrits += 1;
            return true;
          },
        },
      ],
    },
  };

  let cookies = "session=abc; theme=rose";
  const document = {
    get cookie() {
      return cookies;
    },
    set cookie(v: string) {
      const nom = v.split("=")[0];
      cookies = cookies
        .split(";")
        .filter((c) => c.split("=")[0]?.trim() !== nom)
        .join(";");
    },
  };

  vi.stubGlobal("window", {
    localStorage: local,
    sessionStorage: session,
    indexedDB,
  });
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("indexedDB", indexedDB);
  vi.stubGlobal("caches", caches);
  vi.stubGlobal("navigator", navigateur);
  vi.stubGlobal("document", document);
});

describe("purgerToutStockage", () => {
  it("efface localStorage, sessionStorage, IndexedDB, caches, cookies et service workers", async () => {
    const recap = await purgerToutStockage();

    expect(recap.localStorage).toBe(2);
    expect(recap.sessionStorage).toBe(1);
    expect(recap.indexedDB).toBe(2);
    expect(recap.caches).toBe(2);
    expect(recap.cookies).toBe(2);
    expect(recap.serviceWorkers).toBe(1);

    expect(window.sessionStorage.length).toBe(0);
    expect(basesSupprimees.sort()).toEqual(["autre-base", "superapp"]);
    expect(cachesSupprimes.sort()).toEqual(["assets-v1", "pages-v1"]);
    expect(swDesinscrits).toBe(1);
    expect(document.cookie.trim()).toBe("");
  });

  it("émet une progression croissante jusqu'à 100%", async () => {
    const etapes: number[] = [];
    await purgerToutStockage((p) => etapes.push(p.pourcentage));
    expect(etapes.length).toBeGreaterThan(3);
    expect(etapes[etapes.length - 1]).toBe(100);
    expect([...etapes].sort((a, b) => a - b)).toEqual(etapes);
  });

  it("conserve le journal et y consigne la purge", async () => {
    consigner("export-chiffre", "fichier de test");
    await purgerToutStockage();

    const journal = lireJournal();
    expect(journal[0]?.type).toBe("purge");
    expect(journal.some((e) => e.type === "export-chiffre")).toBe(true);
    expect(window.localStorage.getItem(CLE_JOURNAL)).toBeTruthy();
  });

  it("n'écrit rien dans le journal si conserverJournal vaut false", async () => {
    consigner("export-chiffre", "fichier de test");
    await purgerToutStockage(undefined, { conserverJournal: false });
    expect(lireJournal()).toEqual([]);
  });
});
