/**
 * Renforcements de sécurité locaux (aucune donnée envoyée en ligne).
 *
 * Regroupe les réglages avancés : PIN obligatoire, code du jour, effacement
 * après échecs, masquage en arrière-plan, verrou des actions sensibles,
 * journal d'accès, blocage des captures, mode camouflage, dérivation forte
 * (Argon2id) et double coffre.
 */

export type OptionsSecurite = {
  /** Le code PIN est exigé dès la première ouverture de l'application. */
  pinObligatoire: boolean;
  /** La biométrie ne suffit pas au premier déverrouillage de la journée. */
  pinPremierDuJour: boolean;
  /** Nombre d'échecs consécutifs avant effacement des données (0 = jamais). */
  effacementApresEchecs: number;
  /** Masque les montants quand l'application passe en arrière-plan. */
  masquageArrierePlan: boolean;
  /** Exige le code avant les actions sensibles (purge, export, sauvegarde). */
  verrouActionsSensibles: boolean;
  /** Enregistre localement les ouvertures et tentatives d'accès. */
  journalAcces: boolean;
  /** Demande au système Android d'interdire captures d'écran et aperçus. */
  blocageCaptures: boolean;
  /** Un second code affiche des données fictives. */
  camouflageActif: boolean;
  empreinteCamouflage: string | null;
  selCamouflage: string | null;
  /** Dérivation Argon2id au lieu de PBKDF2 pour les clés issues d'un secret. */
  derivationForte: boolean;
  /** Deuxième coffre : les pages sensibles exigent une phrase distincte. */
  doubleCoffre: boolean;
};

export const OPTIONS_INITIALES: OptionsSecurite = {
  pinObligatoire: false,
  pinPremierDuJour: false,
  effacementApresEchecs: 0,
  masquageArrierePlan: true,
  verrouActionsSensibles: false,
  journalAcces: true,
  blocageCaptures: false,
  camouflageActif: false,
  empreinteCamouflage: null,
  selCamouflage: null,
  derivationForte: false,
  doubleCoffre: false,
};

const CLE_OPTIONS = "superapp:securite:avancee:v1";
const CLE_JOURNAL = "superapp:securite:journal:v1";
const CLE_DERNIER_PIN_JOUR = "superapp:securite:pin-jour";
const CLE_CAMOUFLAGE = "superapp:securite:camouflage";

const abonnes = new Set<(o: OptionsSecurite) => void>();

export function lireOptions(): OptionsSecurite {
  try {
    const brut = window.localStorage.getItem(CLE_OPTIONS);
    if (!brut) return OPTIONS_INITIALES;
    return { ...OPTIONS_INITIALES, ...(JSON.parse(brut) as Partial<OptionsSecurite>) };
  } catch {
    return OPTIONS_INITIALES;
  }
}

export function ecrireOptions(maj: Partial<OptionsSecurite>): OptionsSecurite {
  const suivant = { ...lireOptions(), ...maj };
  try {
    window.localStorage.setItem(CLE_OPTIONS, JSON.stringify(suivant));
  } catch {
    /* stockage indisponible */
  }
  for (const a of abonnes) a(suivant);
  return suivant;
}

export function abonnerOptions(f: (o: OptionsSecurite) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/* ------------------------------------------------------------------ */
/* Journal d'accès local                                               */
/* ------------------------------------------------------------------ */

export type EvenementAcces = {
  date: string;
  type: "ouverture" | "deverrouillage" | "echec" | "verrouillage" | "camouflage" | "effacement";
  detail: string;
};

export function lireJournalAcces(): EvenementAcces[] {
  try {
    const brut = window.localStorage.getItem(CLE_JOURNAL);
    return brut ? (JSON.parse(brut) as EvenementAcces[]) : [];
  } catch {
    return [];
  }
}

export function journaliserAcces(type: EvenementAcces["type"], detail = ""): void {
  if (!lireOptions().journalAcces) return;
  try {
    const liste = [{ date: new Date().toISOString(), type, detail }, ...lireJournalAcces()].slice(
      0,
      100,
    );
    window.localStorage.setItem(CLE_JOURNAL, JSON.stringify(liste));
  } catch {
    /* stockage indisponible */
  }
}

export function viderJournalAcces(): void {
  try {
    window.localStorage.removeItem(CLE_JOURNAL);
  } catch {
    /* stockage indisponible */
  }
}

/* ------------------------------------------------------------------ */
/* Code du jour (biométrie + PIN combinés)                             */
/* ------------------------------------------------------------------ */

function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Vrai si le code a déjà été saisi aujourd'hui (la biométrie suffit alors). */
export function pinDejaSaisiAujourdHui(): boolean {
  try {
    return window.localStorage.getItem(CLE_DERNIER_PIN_JOUR) === aujourdHui();
  } catch {
    return false;
  }
}

export function marquerPinDuJour(): void {
  try {
    window.localStorage.setItem(CLE_DERNIER_PIN_JOUR, aujourdHui());
  } catch {
    /* stockage indisponible */
  }
}

/* ------------------------------------------------------------------ */
/* Mode camouflage                                                     */
/* ------------------------------------------------------------------ */

export function camouflageEnCours(): boolean {
  try {
    return window.sessionStorage.getItem(CLE_CAMOUFLAGE) === "1";
  } catch {
    return false;
  }
}

export function activerCamouflage(): void {
  try {
    window.sessionStorage.setItem(CLE_CAMOUFLAGE, "1");
  } catch {
    /* stockage indisponible */
  }
}

export function quitterCamouflage(): void {
  try {
    window.sessionStorage.removeItem(CLE_CAMOUFLAGE);
  } catch {
    /* stockage indisponible */
  }
}

/* ------------------------------------------------------------------ */
/* Empreintes de code (identiques au verrouillage principal)           */
/* ------------------------------------------------------------------ */

function hexa(octets: ArrayBuffer | Uint8Array): string {
  const vue = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  return Array.from(vue)
    .map((o) => o.toString(16).padStart(2, "0"))
    .join("");
}

export function nouveauSel(): string {
  const t = new Uint8Array(16);
  crypto.getRandomValues(t);
  return hexa(t);
}

export async function empreinteCode(code: string, sel: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sel}:${code}`));
  return hexa(digest);
}

/** Vrai lorsque le code saisi correspond au code de camouflage enregistré. */
export async function estCodeCamouflage(code: string): Promise<boolean> {
  const o = lireOptions();
  if (!o.camouflageActif || !o.empreinteCamouflage || !o.selCamouflage) return false;
  return (await empreinteCode(code, o.selCamouflage)) === o.empreinteCamouflage;
}

export async function definirCodeCamouflage(code: string): Promise<void> {
  const sel = nouveauSel();
  ecrireOptions({
    camouflageActif: true,
    selCamouflage: sel,
    empreinteCamouflage: await empreinteCode(code, sel),
  });
}

export function retirerCodeCamouflage(): void {
  ecrireOptions({ camouflageActif: false, selCamouflage: null, empreinteCamouflage: null });
}

/* ------------------------------------------------------------------ */
/* Effacement de sécurité                                              */
/* ------------------------------------------------------------------ */

/** Efface toutes les données locales de l'application (irréversible). */
export function effacerToutesLesDonnees(): void {
  journaliserAcces("effacement", "Effacement de sécurité après échecs répétés.");
  try {
    const aSupprimer: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const cle = window.localStorage.key(i);
      if (cle && cle.startsWith("superapp:") && cle !== CLE_JOURNAL) aSupprimer.push(cle);
    }
    for (const cle of aSupprimer) window.localStorage.removeItem(cle);
  } catch {
    /* stockage indisponible */
  }
}

/* ------------------------------------------------------------------ */
/* Blocage des captures d'écran (Android)                              */
/* ------------------------------------------------------------------ */

type PontCapacitor = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      IntegriteApp?: {
        bloquerCaptures?: (o: { actif: boolean }) => Promise<unknown>;
      };
    };
  };
};

/** Demande au système Android de masquer l'écran dans les aperçus/captures. */
export async function appliquerBlocageCaptures(actif: boolean): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = (window as unknown as PontCapacitor).Capacitor;
  try {
    if (!cap?.isNativePlatform?.()) return;
    await cap.Plugins?.IntegriteApp?.bloquerCaptures?.({ actif });
  } catch {
    /* fonction native indisponible sur cette version */
  }
}
