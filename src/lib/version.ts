/**
 * Version de l'application et vérification des mises à jour.
 *
 * Tout fonctionne hors ligne : la vérification n'a lieu que si l'utilisateur
 * appuie sur le bouton « Vérifier les mises à jour ». Aucune donnée n'est
 * envoyée, on télécharge seulement un petit fichier `version.json` public.
 */

/** Version installée. À incrémenter à chaque nouvelle compilation d'APK. */
export const VERSION_APPLICATION = "1.0.0";

/** Adresse par défaut du fichier `version.json` (modifiable dans Paramètres). */
export const URL_MANIFESTE_DEFAUT =
  "https://github.com/ahouandjinoujuscalsedegbe-wq/superap/releases/latest/download/version.json";

/** Délai minimum entre deux vérifications automatiques (6 heures). */
const DELAI_AUTO_MS = 6 * 60 * 60 * 1000;

const CLE_URL = "superapp:maj:url";
const CLE_DERNIERE = "superapp:maj:derniere";
const CLE_TENTATIVE = "superapp:maj:tentative";
const CLE_IGNOREE = "superapp:maj:ignoree";

export type Manifeste = {
  version: string;
  url: string;
  changelog?: string;
};

export type ResultatVerification =
  | { etat: "a-jour"; version: string }
  | { etat: "disponible"; manifeste: Manifeste }
  | { etat: "hors-ligne"; message: string }
  | { etat: "erreur"; message: string };

/** Adresse du manifeste enregistrée sur l'appareil. */
export function lireUrlManifeste(): string {
  if (typeof localStorage === "undefined") return URL_MANIFESTE_DEFAUT;
  return localStorage.getItem(CLE_URL) ?? URL_MANIFESTE_DEFAUT;
}

export function enregistrerUrlManifeste(url: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CLE_URL, url.trim());
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
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** Téléchargement par le réseau natif Android (aucune restriction CORS). */
async function telechargerNatif(
  cible: string,
): Promise<
  { etat: "ok"; donnees: Partial<Manifeste> } | { etat: "erreur" | "hors-ligne"; message: string }
> {
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
        message: `Le serveur a répondu ${reponse.status}. Vérifiez l'adresse du fichier version.json (le dépôt doit être public).`,
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
      },
    };
  }
  return { etat: "a-jour", version: VERSION_APPLICATION };
}



/**
 * Télécharge le manifeste et le compare à la version installée.
 * Ne lève jamais d'exception : toutes les issues sont décrites dans le résultat.
 */
export async function verifierMiseAJour(
  urlManifeste = lireUrlManifeste(),
): Promise<ResultatVerification> {
  const adresse = urlManifeste.trim();
  if (!adresse) {
    return {
      etat: "erreur",
      message:
        "Aucune adresse de mise à jour enregistrée. Collez l'adresse du fichier version.json ci-dessous.",
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
        message:
          "Le fichier version.json est incomplet : il faut au minimum « version » et « url ».",
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
 * Ouvre le téléchargement de l'APK. Android propose ensuite l'installation
 * par-dessus l'application existante : les données locales sont conservées,
 * car l'APK est signé avec la même clé et porte le même identifiant.
 */
export function lancerTelechargement(url: string) {
  if (typeof window === "undefined") return;
  const fenetre = window.open(url, "_blank", "noopener,noreferrer");
  if (!fenetre) window.location.href = url;
}

/** Version que l'utilisateur a choisi d'ignorer (bouton « Plus tard »). */
export function lireVersionIgnoree(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CLE_IGNOREE);
}

export function ignorerVersion(version: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CLE_IGNOREE, version);
}

/**
 * Vérification silencieuse au démarrage : l'utilisateur n'a rien à faire.
 * On limite à une tentative toutes les 6 heures pour ne pas consommer de data.
 */
export async function verifierAuDemarrage(): Promise<Manifeste | null> {
  if (typeof localStorage === "undefined") return null;
  const derniereTentative = Number(localStorage.getItem(CLE_TENTATIVE) ?? 0);
  if (Number.isFinite(derniereTentative) && Date.now() - derniereTentative < DELAI_AUTO_MS) {
    return null;
  }
  localStorage.setItem(CLE_TENTATIVE, String(Date.now()));
  const resultat = await verifierMiseAJour();
  if (resultat.etat !== "disponible") return null;
  if (lireVersionIgnoree() === resultat.manifeste.version) return null;
  return resultat.manifeste;
}
