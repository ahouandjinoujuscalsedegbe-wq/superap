/**
 * Version de l'application et vérification des mises à jour.
 *
 * Tout fonctionne hors ligne : la vérification n'a lieu que si l'utilisateur
 * appuie sur le bouton « Vérifier les mises à jour » (ou au démarrage, au
 * maximum toutes les 6 heures). Aucune donnée n'est envoyée, on télécharge
 * seulement un petit fichier `version.json`.
 *
 * Dépôt privé : quand un jeton GitHub est disponible (intégré à la
 * compilation ou saisi dans Paramètres), le manifeste et l'APK sont
 * téléchargés via l'API GitHub avec authentification.
 */

/** Version installée. À incrémenter à chaque nouvelle compilation d'APK. */
export const VERSION_APPLICATION = "1.0.8";

/** Adresse par défaut du fichier `version.json` (modifiable dans Paramètres). */
export const URL_MANIFESTE_DEFAUT =
  "https://github.com/ahouandjinoujuscalsedegbe-wq/superapp/releases/latest/download/version.json";

/** Dépôt GitHub qui héberge les Releases (propriétaire/nom). */
export const DEPOT_GITHUB = "ahouandjinoujuscalsedegbe-wq/superapp";

/** Délai minimum entre deux vérifications automatiques (6 heures). */
const DELAI_AUTO_MS = 6 * 60 * 60 * 1000;

const CLE_URL = "superapp:maj:url";
const CLE_DERNIERE = "superapp:maj:derniere";
const CLE_TENTATIVE = "superapp:maj:tentative";
const CLE_IGNOREE = "superapp:maj:ignoree";
const CLE_TOKEN = "superapp:maj:token";

export type Manifeste = {
  version: string;
  url: string;
  changelog?: string;
  /** Empreinte SHA-256 hexadécimale de l'APK (contrôle d'intégrité). */
  sha256?: string;
  /** Taille exacte de l'APK en octets (contrôle d'intégrité). */
  taille?: number;
};

/** Contrôle d'intégrité attendu pour l'APK téléchargé. */
export type Integrite = { sha256?: string; taille?: number };

export type ResultatVerification =
  | { etat: "a-jour"; version: string }
  | { etat: "disponible"; manifeste: Manifeste }
  | { etat: "hors-ligne"; message: string }
  | { etat: "erreur"; message: string };

export type EtapeInstallation =
  | { etape: "telechargement"; message: string }
  | { etape: "enregistrement"; message: string }
  | { etape: "installation"; message: string }
  | { etape: "termine"; message: string }
  | { etape: "erreur"; message: string };

/** Adresse du manifeste enregistrée sur l'appareil. */
export function lireUrlManifeste(): string {
  if (typeof localStorage === "undefined") return URL_MANIFESTE_DEFAUT;
  return localStorage.getItem(CLE_URL) ?? URL_MANIFESTE_DEFAUT;
}

export function enregistrerUrlManifeste(url: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CLE_URL, url.trim());
}

/**
 * Jeton d'accès GitHub (lecture seule) utilisé lorsque le dépôt est privé.
 * Priorité : jeton saisi dans Paramètres, sinon jeton intégré à la compilation.
 */
export function lireTokenGithub(): string {
  if (typeof localStorage !== "undefined") {
    const local = localStorage.getItem(CLE_TOKEN);
    if (local?.trim()) return local.trim();
  }
  const integre = import.meta.env["VITE_UPDATE_TOKEN"] as string | undefined;
  return typeof integre === "string" ? integre.trim() : "";
}

export function enregistrerTokenGithub(token: string) {
  if (typeof localStorage === "undefined") return;
  const valeur = token.trim();
  if (valeur) localStorage.setItem(CLE_TOKEN, valeur);
  else localStorage.removeItem(CLE_TOKEN);
}

/** En-têtes d'authentification pour l'API GitHub (dépôt privé). */
function entetesGithub(accept: string): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${lireTokenGithub()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

type AssetRelease = { name: string; url: string };

/** Mémoire courte (60 s) de la dernière Release pour éviter les appels répétés. */
let cacheRelease: { assets: AssetRelease[]; expire: number } | null = null;

/** Durée de validité du cache de Release. */
const CACHE_RELEASE_MS = 60 * 1000;

type ReponseGithub =
  | { etat: "ok"; donnees: unknown }
  | { etat: "http"; code: number }
  | { etat: "reseau" };

/** Lecture d'un JSON de l'API GitHub, en natif (Capacitor) ou via fetch. */
async function lireJsonGithub(url: string): Promise<ReponseGithub> {
  const entetes = entetesGithub("application/vnd.github+json");
  try {
    if (estApplicationNative()) {
      const { CapacitorHttp } = await import("@capacitor/core");
      const reponse = await CapacitorHttp.get({
        url,
        headers: entetes,
        readTimeout: 15000,
        connectTimeout: 15000,
      });
      if (reponse.status < 200 || reponse.status >= 300) {
        return { etat: "http", code: reponse.status };
      }
      const brut = reponse.data;
      return { etat: "ok", donnees: typeof brut === "string" ? JSON.parse(brut) : brut };
    }
    const reponse = await fetch(url, { headers: entetes, cache: "no-store" });
    if (!reponse.ok) return { etat: "http", code: reponse.status };
    return { etat: "ok", donnees: await reponse.json() };
  } catch {
    return { etat: "reseau" };
  }
}

type ResultatRelease =
  | { etat: "ok"; assets: AssetRelease[] }
  | { etat: "sans-release" }
  | { etat: "http"; code: number }
  | { etat: "reseau" };

/**
 * Récupère la Release la plus récente contenant le manifeste via l'API GitHub
 * (fonctionne avec un dépôt privé grâce au jeton).
 *
 * Deux tentatives : d'abord `releases/latest`, puis la liste complète des
 * Releases. La liste est indispensable car `releases/latest` ignore les
 * pré-Releases : sans elle, une compilation de test (APK debug, publiée en
 * pré-Release) bloquerait totalement la mise à jour automatique.
 */
async function lireDerniereRelease(): Promise<ResultatRelease> {
  if (cacheRelease && Date.now() < cacheRelease.expire) {
    return { etat: "ok", assets: cacheRelease.assets };
  }

  const base = `https://api.github.com/repos/${DEPOT_GITHUB}/releases`;

  const reponseLatest = await lireJsonGithub(`${base}/latest?t=${Date.now()}`);
  if (reponseLatest.etat === "reseau") return { etat: "reseau" };
  if (reponseLatest.etat === "http" && reponseLatest.code !== 404) {
    return { etat: "http", code: reponseLatest.code };
  }

  const latest =
    reponseLatest.etat === "ok" ? (reponseLatest.donnees as { assets?: AssetRelease[] }) : null;
  if (latest && Array.isArray(latest.assets) && latest.assets.some((a) => a.name === "version.json")) {
    cacheRelease = { assets: latest.assets, expire: Date.now() + CACHE_RELEASE_MS };
    return { etat: "ok", assets: latest.assets };
  }

  const reponseListe = await lireJsonGithub(`${base}?per_page=15&t=${Date.now()}`);
  if (reponseListe.etat === "reseau") return { etat: "reseau" };
  if (reponseListe.etat === "http") return { etat: "http", code: reponseListe.code };

  const liste = reponseListe.donnees as Array<{ draft?: boolean; assets?: AssetRelease[] }>;
  if (Array.isArray(liste)) {
    if (liste.length === 0) return { etat: "sans-release" };
    const trouvee = liste.find(
      (r) => !r.draft && Array.isArray(r.assets) && r.assets.some((a) => a.name === "version.json"),
    );
    if (trouvee?.assets) {
      cacheRelease = { assets: trouvee.assets, expire: Date.now() + CACHE_RELEASE_MS };
      return { etat: "ok", assets: trouvee.assets };
    }
    return { etat: "sans-release" };
  }

  if (latest && Array.isArray(latest.assets)) {
    cacheRelease = { assets: latest.assets, expire: Date.now() + CACHE_RELEASE_MS };
    return { etat: "ok", assets: latest.assets };
  }
  return { etat: "sans-release" };
}

/** Trouve un fichier (asset) de la dernière Release par son nom. */
async function trouverAsset(nom: string): Promise<{ asset: AssetRelease | null; echec: ResultatRelease | null }> {
  const release = await lireDerniereRelease();
  if (release.etat !== "ok") return { asset: null, echec: release };
  return { asset: release.assets.find((a) => a.name === nom) ?? null, echec: null };
}

/**
 * Télécharge un fichier JSON d'une Release privée via l'API GitHub.
 * L'URL d'asset de l'API renvoie le contenu brut avec l'en-tête
 * Accept « application/octet-stream » et le jeton.
 */
async function telechargerAssetJson(
  assetUrl: string,
): Promise<{ etat: "ok"; donnees: Partial<Manifeste> } | { etat: "erreur" | "hors-ligne"; message: string }> {
  const entetes = entetesGithub("application/octet-stream");
  try {
    if (estApplicationNative()) {
      const { CapacitorHttp } = await import("@capacitor/core");
      const reponse = await CapacitorHttp.get({
        url: assetUrl,
        headers: entetes,
        readTimeout: 15000,
        connectTimeout: 15000,
      });
      if (reponse.status < 200 || reponse.status >= 300) {
        return { etat: "erreur", message: `GitHub a répondu ${reponse.status}. Vérifiez le jeton d'accès.` };
      }
      const brut = reponse.data;
      const donnees = (typeof brut === "string" ? JSON.parse(brut) : brut) as Partial<Manifeste>;
      return { etat: "ok", donnees };
    }
    const reponse = await fetch(assetUrl, { headers: entetes, cache: "no-store" });
    if (!reponse.ok) {
      return { etat: "erreur", message: `GitHub a répondu ${reponse.status}. Vérifiez le jeton d'accès.` };
    }
    return { etat: "ok", donnees: (await reponse.json()) as Partial<Manifeste> };
  } catch {
    return {
      etat: "hors-ligne",
      message: "Impossible de joindre le serveur de mise à jour. Vérifiez votre connexion Internet.",
    };
  }
}

/** Date de la dernière vérification réussie (texte lisible) ou null. */
export function lireDerniereVerification(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CLE_DERNIERE);
}

function memoriserVerification() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CLE_DERNIERE, new Date().toISOString());
}

/** Découpe « 1.10.2 » en [1, 10, 2] en ignorant les suffixes éventuels. */
function segments(version: string): number[] {
  return String(version)
    .trim()
    .replace(/^v/i, "")
    .split(/[.\-+]/)
    .map((p) => Number.parseInt(p, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

/** Renvoie 1 si a > b, -1 si a < b, 0 si identiques. */
export function comparerVersions(a: string, b: string): number {
  const sa = segments(a);
  const sb = segments(b);
  const taille = Math.max(sa.length, sb.length);
  for (let i = 0; i < taille; i += 1) {
    const va = sa[i] ?? 0;
    const vb = sb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function estAdresseValide(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Vrai lorsque le code tourne dans l'application Android (Capacitor). */
export function estApplicationNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** Téléchargement par le réseau natif Android (aucune restriction CORS). */
async function telechargerNatif(
  cible: string,
): Promise<{ etat: "ok"; donnees: Partial<Manifeste> } | { etat: "erreur" | "hors-ligne"; message: string }> {
  try {
    const { CapacitorHttp } = await import("@capacitor/core");
    const reponse = await CapacitorHttp.get({
      url: cible,
      headers: { Accept: "application/json" },
      readTimeout: 15000,
      connectTimeout: 15000,
    });
    if (reponse.status < 200 || reponse.status >= 300) {
      return {
        etat: "erreur",
        message: `Le serveur a répondu ${reponse.status}. Si le dépôt est privé, enregistrez un jeton d'accès dans Paramètres → Mises à jour.`,
      };
    }
    const brut = reponse.data;
    const donnees = (typeof brut === "string" ? JSON.parse(brut) : brut) as Partial<Manifeste>;
    return { etat: "ok", donnees };
  } catch {
    return {
      etat: "hors-ligne",
      message: "Impossible de joindre le serveur de mise à jour. Vérifiez votre connexion Internet.",
    };
  }
}

/** Compare le manifeste téléchargé à la version installée. */
function interpreterManifeste(donnees: Partial<Manifeste>): ResultatVerification {
  if (!donnees || typeof donnees.version !== "string" || typeof donnees.url !== "string") {
    return {
      etat: "erreur",
      message: "Le fichier version.json est incomplet : il faut au minimum « version » et « url ».",
    };
  }
  memoriserVerification();
  if (comparerVersions(donnees.version, VERSION_APPLICATION) > 0) {
    return {
      etat: "disponible",
      manifeste: {
        version: donnees.version,
        url: donnees.url,
        ...(donnees.changelog ? { changelog: donnees.changelog } : {}),
        ...(typeof donnees.sha256 === "string" ? { sha256: donnees.sha256 } : {}),
        ...(typeof donnees.taille === "number" ? { taille: donnees.taille } : {}),
      },
    };
  }
  return { etat: "a-jour", version: VERSION_APPLICATION };
}

/**
 * Télécharge le manifeste et le compare à la version installée.
 * Ne lève jamais d'exception : toutes les issues sont décrites dans le résultat.
 */
export async function verifierMiseAJour(urlManifeste = lireUrlManifeste()): Promise<ResultatVerification> {
  const adresse = urlManifeste.trim();
  if (!adresse) {
    return {
      etat: "erreur",
      message: "Aucune adresse de mise à jour enregistrée. Collez l'adresse du fichier version.json ci-dessous.",
    };
  }
  if (!estAdresseValide(adresse)) {
    return {
      etat: "erreur",
      message: "L'adresse doit commencer par https:// et pointer vers un fichier version.json.",
    };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      etat: "hors-ligne",
      message:
        "Aucune connexion Internet détectée. Connectez-vous puis réessayez : l'application continue de fonctionner hors ligne.",
    };
  }

  // Dépôt privé : avec un jeton, on passe par l'API GitHub authentifiée
  // (l'URL publique de téléchargement répondrait 404 sur un dépôt privé).
  if (lireTokenGithub() && adresse.includes("github.com")) {
    const asset = await trouverAsset("version.json");
    if (!asset) {
      cacheRelease = null;
      return {
        etat: "erreur",
        message:
          "Impossible de lire la dernière version sur GitHub. Vérifiez le jeton d'accès et qu'une Release existe.",
      };
    }
    const resultat = await telechargerAssetJson(asset.url);
    if (resultat.etat !== "ok") return { etat: resultat.etat, message: resultat.message };
    return interpreterManifeste(resultat.donnees);
  }

  const cible = `${adresse}${adresse.includes("?") ? "&" : "?"}t=${Date.now()}`;

  // Dans l'application Android, `fetch` est bloqué par la politique CORS des
  // serveurs (GitHub par exemple). On passe alors par le réseau natif du
  // téléphone, qui n'est pas soumis à cette restriction.
  if (estApplicationNative()) {
    const natif = await telechargerNatif(cible);
    if (natif.etat !== "ok") return { etat: natif.etat, message: natif.message };
    return interpreterManifeste(natif.donnees);
  }

  const controleur = new AbortController();
  const delai = setTimeout(() => controleur.abort(), 15000);
  try {
    const reponse = await fetch(cible, {
      cache: "no-store",
      signal: controleur.signal,
    });
    if (!reponse.ok) {
      return {
        etat: "erreur",
        message: `Le serveur a répondu ${reponse.status}. Vérifiez l'adresse du fichier version.json.`,
      };
    }
    const donnees = (await reponse.json()) as Partial<Manifeste>;

    if (!donnees || typeof donnees.version !== "string" || typeof donnees.url !== "string") {
      return {
        etat: "erreur",
        message: "Le fichier version.json est incomplet : il faut au minimum « version » et « url ».",
      };
    }
    memoriserVerification();
    if (comparerVersions(donnees.version, VERSION_APPLICATION) > 0) {
      return {
        etat: "disponible",
        manifeste: {
          version: donnees.version,
          url: donnees.url,
          ...(donnees.changelog ? { changelog: donnees.changelog } : {}),
          ...(typeof donnees.sha256 === "string" ? { sha256: donnees.sha256 } : {}),
          ...(typeof donnees.taille === "number" ? { taille: donnees.taille } : {}),
        },
      };
    }
    return { etat: "a-jour", version: VERSION_APPLICATION };
  } catch (erreur) {
    const abandon = (erreur as Error)?.name === "AbortError";
    return {
      etat: "hors-ligne",
      message: abandon
        ? "La vérification a pris trop de temps. Vérifiez votre connexion puis réessayez."
        : "Impossible de joindre le serveur de mise à jour. Vérifiez votre connexion puis réessayez.",
    };
  }
}

/**
 * Convertit un ArrayBuffer en chaîne base64.
 */
function bufferVersBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaire = "";
  const taille = bytes.byteLength;
  for (let i = 0; i < taille; i += 1) {
    binaire += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binaire);
}

/** Nettoie une chaîne base64 (préfixe « data: », espaces, retours à la ligne). */
function nettoyerBase64(valeur: string): string {
  const sansPrefixe = valeur.includes("base64,") ? valeur.slice(valeur.indexOf("base64,") + 7) : valeur;
  return sansPrefixe.replace(/\s/g, "");
}

/** Vérifie que le fichier commence bien par la signature d'une archive APK (« PK »). */
function estArchiveApk(base64: string): boolean {
  try {
    const debut = atob(base64.slice(0, 8));
    return debut.charCodeAt(0) === 0x50 && debut.charCodeAt(1) === 0x4b;
  } catch {
    return false;
  }
}

/** Taille réelle en octets d'un contenu base64. */
function tailleBase64(base64: string): number {
  const rembourrage = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - rembourrage;
}

/** Calcule l'empreinte SHA-256 hexadécimale d'un contenu base64. */
async function sha256Base64(base64: string): Promise<string> {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) {
    octets[i] = binaire.charCodeAt(i);
  }
  const empreinte = await crypto.subtle.digest("SHA-256", octets);
  return Array.from(new Uint8Array(empreinte))
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Vérifie l'intégrité de l'APK téléchargé contre les informations du
 * fichier version.json : taille exacte et empreinte SHA-256. Un fichier
 * tronqué ou corrompu pendant le transfert est ainsi refusé avant
 * l'installation au lieu de provoquer une erreur « analyse du package ».
 */
async function verifierIntegrite(
  base64: string,
  attendu?: Integrite,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!attendu) return { ok: true };
  if (typeof attendu.taille === "number" && attendu.taille > 0) {
    const taille = tailleBase64(base64);
    if (taille !== attendu.taille) {
      return {
        ok: false,
        message:
          "Le fichier téléchargé est incomplet ou corrompu (taille différente de celle annoncée). Vérifiez votre connexion puis réessayez.",
      };
    }
  }
  if (typeof attendu.sha256 === "string" && /^[0-9a-f]{64}$/i.test(attendu.sha256)) {
    const empreinte = await sha256Base64(base64);
    if (empreinte.toLowerCase() !== attendu.sha256.toLowerCase()) {
      return {
        ok: false,
        message:
          "Le fichier téléchargé ne correspond pas à la version officielle (empreinte différente). Vérifiez votre connexion puis réessayez.",
      };
    }
  }
  return { ok: true };
}

/**
 * Télécharge l'APK avec le réseau natif Android et retourne son contenu en
 * base64 (format attendu par le système de fichiers Capacitor).
 *
 * Important : avec `responseType: "arraybuffer"`, le pont natif renvoie déjà
 * une chaîne base64. La reconvertir comme un tableau d'octets produisait un
 * fichier corrompu, d'où le message « problème lors de l'analyse du package ».
 */
async function telechargerAPKNatif(
  url: string,
  surEtape?: (etape: EtapeInstallation) => void,
  integrite?: Integrite,
): Promise<{ ok: true; base64: string } | { ok: false; message: string }> {
  try {
    surEtape?.({ etape: "telechargement", message: "Téléchargement de la nouvelle version..." });

    // Dépôt privé : l'URL publique de téléchargement répond 404. On la
    // remplace par l'URL d'asset de l'API GitHub, authentifiée par le jeton.
    let cible = url;
    let entetes: Record<string, string> = { Accept: "application/vnd.android.package-archive" };
    if (lireTokenGithub() && url.includes("github.com")) {
      const nomFichier = url.split("/").pop()?.split("?")[0] ?? "";
      const asset = nomFichier ? await trouverAsset(nomFichier) : null;
      if (!asset) {
        cacheRelease = null;
        return {
          ok: false,
          message: `Le fichier ${nomFichier || "APK"} est introuvable dans la dernière version publiée sur GitHub.`,
        };
      }
      cible = asset.url;
      entetes = entetesGithub("application/octet-stream");
    }

    const { CapacitorHttp } = await import("@capacitor/core");
    const reponse = await CapacitorHttp.get({
      url: cible,
      headers: entetes,
      responseType: "blob",
      readTimeout: 180000,
      connectTimeout: 30000,
    });
    if (reponse.status < 200 || reponse.status >= 300) {
      return {
        ok: false,
        message: `Le serveur a répondu ${reponse.status} lors du téléchargement de l'APK.`,
      };
    }

    const brut = reponse.data as unknown;
    let base64: string;
    if (typeof brut === "string") {
      base64 = nettoyerBase64(brut);
    } else if (brut instanceof ArrayBuffer) {
      base64 = bufferVersBase64(brut);
    } else if (ArrayBuffer.isView(brut)) {
      const vue = brut as ArrayBufferView;
      base64 = bufferVersBase64(vue.buffer.slice(vue.byteOffset, vue.byteOffset + vue.byteLength) as ArrayBuffer);
    } else {
      return { ok: false, message: "Réponse inattendue du serveur : le fichier n'a pas pu être lu." };
    }

    if (tailleBase64(base64) < 100_000) {
      return {
        ok: false,
        message:
          "Le fichier téléchargé est trop petit pour être une application. Vérifiez que l'adresse pointe bien vers l'APK de la nouvelle version.",
      };
    }
    if (!estArchiveApk(base64)) {
      return {
        ok: false,
        message:
          "Le fichier téléchargé n'est pas une application Android valide (page web ou lien invalide). Vérifiez l'adresse indiquée dans version.json.",
      };
    }

    // Contrôle d'intégrité annoncé par version.json (taille + SHA-256) :
    // un fichier tronqué ou altéré est refusé avant toute installation.
    const controle = await verifierIntegrite(base64, integrite);
    if (!controle.ok) return controle;

    return { ok: true, base64 };
  } catch {
    return {
      ok: false,
      message: "Impossible de télécharger la mise à jour. Vérifiez votre connexion Internet.",
    };
  }
}

/**
 * Écrit l'APK dans le cache de l'application puis l'ouvre avec l'installateur
 * Android natif. L'utilisateur n'a plus qu'à confirmer l'installation.
 */
async function installerAPKDepuisCache(
  base64: string,
  surEtape?: (etape: EtapeInstallation) => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    surEtape?.({ etape: "enregistrement", message: "Préparation du fichier d'installation..." });
    const [{ Filesystem, Directory }, { FileOpener }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor-community/file-opener"),
    ]);

    const nomFichier = `super-app-${Date.now()}.apk`;

    // Un ancien fichier partiellement écrit provoquerait la même erreur
    // d'analyse : on repart toujours d'un nom neuf et d'une écriture complète.
    await Filesystem.writeFile({
      path: nomFichier,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    const info = await Filesystem.stat({ path: nomFichier, directory: Directory.Cache });
    if (!info.size || info.size < 100_000) {
      return {
        ok: false,
        message: "L'enregistrement du fichier d'installation est incomplet. Réessayez la mise à jour.",
      };
    }

    const uri = await Filesystem.getUri({
      path: nomFichier,
      directory: Directory.Cache,
    });

    surEtape?.({
      etape: "installation",
      message: "Lancement de l'installateur Android. Confirmez l'installation.",
    });

    await FileOpener.open({
      filePath: uri.uri,
      contentType: "application/vnd.android.package-archive",
    });

    return { ok: true };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    return {
      ok: false,
      message: `Impossible de lancer l'installateur : ${message}. Autorisez l'installation depuis cette application dans les paramètres Android si demandé.`,
    };
  }
}

/**
 * Lance la mise à jour en un clic dans l'application Android :
 * téléchargement de l'APK, enregistrement local, ouverture de l'installateur.
 * Sur navigateur, on retombe sur l'ouverture d'un nouvel onglet.
 */
export async function installerMiseAJour(
  url: string,
  surEtape?: (etape: EtapeInstallation) => void,
  integrite?: Integrite,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!estApplicationNative()) {
    lancerTelechargement(url);
    return { ok: true };
  }

  const telechargement = await telechargerAPKNatif(url, surEtape, integrite);
  if (!telechargement.ok) return telechargement;

  const installation = await installerAPKDepuisCache(telechargement.base64, surEtape);
  if (!installation.ok) return installation;

  surEtape?.({ etape: "termine", message: "Installateur Android lancé." });
  return { ok: true };
}

/**
 * Ouvre le téléchargement de l'APK. Android propose ensuite l'installation
 * par-dessus l'application existante : les données locales sont conservées,
 * car l'APK est signé avec la même clé et porte le même identifiant.
 */
export function lancerTelechargement(url: string) {
  if (typeof window === "undefined") return;
  const fenetre = window.open(url, "_blank", "noopener,noreferrer");
  if (!fenetre) window.location.href = url;
}

/** Durée pendant laquelle « Plus tard » repousse le rappel (24 heures). */
export const DELAI_RAPPEL_MS = 24 * 60 * 60 * 1000;

type Report = { version: string; jusqua: number };

function lireReport(): Report | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const brut = localStorage.getItem(CLE_IGNOREE);
    if (!brut) return null;
    // Ancien format : simple chaîne de version (ignore définitivement).
    // On le traite comme un report déjà expiré pour ne plus jamais masquer
    // une version indéfiniment.
    if (!brut.startsWith("{")) return null;
    const report = JSON.parse(brut) as Partial<Report>;
    if (typeof report.version !== "string" || typeof report.jusqua !== "number") return null;
    return report as Report;
  } catch {
    return null;
  }
}

/**
 * Version actuellement repoussée par « Plus tard », si le délai de rappel
 * (24 h) n'est pas encore écoulé. Passé ce délai, la popup réapparaît :
 * une mise à jour ne doit jamais être ignorée définitivement par accident.
 */
export function lireVersionIgnoree(): string | null {
  const report = lireReport();
  if (!report) return null;
  if (Date.now() >= report.jusqua) return null;
  return report.version;
}

/** Repousse le rappel d'une version de 24 heures (bouton « Plus tard »). */
export function ignorerVersion(version: string) {
  if (typeof localStorage === "undefined") return;
  const report: Report = { version, jusqua: Date.now() + DELAI_RAPPEL_MS };
  localStorage.setItem(CLE_IGNOREE, JSON.stringify(report));
}

/**
 * Vérification silencieuse au démarrage : l'utilisateur n'a rien à faire.
 * On limite à une tentative réussie toutes les 6 heures pour ne pas consommer
 * de data. Une tentative hors ligne ne consomme PAS le créneau : sans réseau,
 * rien n'a pu être vérifié, donc on réessaiera à la prochaine ouverture.
 */
export async function verifierAuDemarrage(): Promise<Manifeste | null> {
  if (typeof localStorage === "undefined") return null;
  const derniereTentative = Number(localStorage.getItem(CLE_TENTATIVE) ?? 0);
  if (Number.isFinite(derniereTentative) && Date.now() - derniereTentative < DELAI_AUTO_MS) {
    return null;
  }
  const resultat = await verifierMiseAJour();
  if (resultat.etat === "hors-ligne") return null;
  if (resultat.etat === "erreur") {
    // Erreur serveur, jeton refusé, Release absente… : on réessaie dans 30 min
    // au lieu d'attendre 6 h, sinon une panne passagère gèle les mises à jour.
    localStorage.setItem(CLE_TENTATIVE, String(Date.now() - (DELAI_AUTO_MS - 30 * 60 * 1000)));
    return null;
  }
  localStorage.setItem(CLE_TENTATIVE, String(Date.now()));
  if (resultat.etat !== "disponible") return null;

  if (lireVersionIgnoree() === resultat.manifeste.version) return null;
  return resultat.manifeste;
}
