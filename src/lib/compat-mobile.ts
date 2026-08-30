/**
 * Compatibilité WebView Android.
 *
 * Certaines API modernes (crypto.randomUUID, structuredClone, Array.at…)
 * n'existent pas dans les WebView Android un peu anciennes. Sans ces
 * remplacements, la première fonction qui les utilise lève une exception et
 * l'application reste figée sur un écran blanc.
 *
 * Ce fichier doit être importé AVANT tout autre module de l'application.
 */

type Global = typeof globalThis & {
  crypto?: Crypto & { randomUUID?: () => string };
  structuredClone?: <T>(v: T) => T;
};

const g = globalThis as Global;

function uuidDeSecours(): string {
  const alea = () => Math.floor(Math.random() * 16).toString(16);
  let sortie = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) sortie += "-";
    else if (i === 14) sortie += "4";
    else if (i === 19) sortie += ((Math.floor(Math.random() * 4) + 8) & 0xf).toString(16);
    else sortie += alea();
  }
  return sortie;
}

export function installerCompatibiliteMobile() {
  // crypto / crypto.randomUUID
  if (!g.crypto) {
    (g as { crypto?: unknown }).crypto = {} as Crypto;
  }
  if (typeof g.crypto?.randomUUID !== "function") {
    try {
      (g.crypto as { randomUUID?: () => string }).randomUUID = uuidDeSecours;
    } catch {
      /* objet crypto en lecture seule : on ignore */
    }
  }

  // structuredClone
  if (typeof g.structuredClone !== "function") {
    g.structuredClone = (<T>(v: T): T =>
      JSON.parse(JSON.stringify(v)) as T) as Global["structuredClone"];
  }

  // Array.prototype.at / String.prototype.at
  if (typeof Array.prototype.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      value: function (n: number) {
        const i = Math.trunc(n) || 0;
        const idx = i < 0 ? this.length + i : i;
        return idx < 0 || idx >= this.length ? undefined : this[idx];
      },
      writable: true,
      configurable: true,
    });
  }
  if (typeof String.prototype.at !== "function") {
    Object.defineProperty(String.prototype, "at", {
      value: function (n: number) {
        const i = Math.trunc(n) || 0;
        const idx = i < 0 ? this.length + i : i;
        return idx < 0 || idx >= this.length ? undefined : this[idx];
      },
      writable: true,
      configurable: true,
    });
  }

  // String.prototype.replaceAll
  if (typeof String.prototype.replaceAll !== "function") {
    Object.defineProperty(String.prototype, "replaceAll", {
      value: function (recherche: string | RegExp, remplacement: string) {
        if (recherche instanceof RegExp) return this.replace(recherche, remplacement);
        return this.split(recherche).join(remplacement);
      },
      writable: true,
      configurable: true,
    });
  }

  // Object.hasOwn
  if (typeof (Object as { hasOwn?: unknown }).hasOwn !== "function") {
    (Object as { hasOwn?: (o: object, k: PropertyKey) => boolean }).hasOwn = (o, k) =>
      Object.prototype.hasOwnProperty.call(o, k);
  }

  // requestIdleCallback
  const w = g as unknown as Record<string, unknown>;
  if (typeof w["requestIdleCallback"] !== "function") {
    w["requestIdleCallback"] = (cb: () => void) => setTimeout(cb, 1);
  }
}
