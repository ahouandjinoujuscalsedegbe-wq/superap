/**
 * Mot de passe des actions sensibles (modification et suppression).
 *
 * Tout reste local : seul un condensé PBKDF2-SHA256 salé du mot de passe est
 * conservé dans le stockage de l'appareil. Aucune donnée n'est envoyée en ligne.
 */

const CLE = "superapp:mdp-actions:v1";

/** Délai pendant lequel une validation reste valable (opérations en série). */
const GRACE_MS = 20_000;

export type ReglagesMdpActions = {
  actif: boolean;
  empreinte: string | null;
  sel: string | null;
};

const INITIAL: ReglagesMdpActions = { actif: false, empreinte: null, sel: null };

const abonnes = new Set<(r: ReglagesMdpActions) => void>();

function hexa(t: ArrayBuffer | Uint8Array): string {
  const o = t instanceof Uint8Array ? t : new Uint8Array(t);
  return Array.from(o)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

export function nouveauSelMdp(): string {
  const t = new Uint8Array(16);
  crypto.getRandomValues(t);
  return hexa(t);
}

/** Condensé PBKDF2-SHA256 (150 000 tours) du mot de passe. */
export async function empreinteMotDePasse(mdp: string, sel: string): Promise<string> {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(mdp), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(sel),
      iterations: 150_000,
      hash: "SHA-256",
    },
    cle,
    256,
  );
  return hexa(bits);
}

export function lireReglagesMdp(): ReglagesMdpActions {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return INITIAL;
    return { ...INITIAL, ...(JSON.parse(brut) as Partial<ReglagesMdpActions>) };
  } catch {
    return INITIAL;
  }
}

function ecrire(r: ReglagesMdpActions): ReglagesMdpActions {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(r));
  } catch {
    /* stockage indisponible */
  }
  abonnes.forEach((f) => f(r));
  return r;
}

export function abonnerMdp(f: (r: ReglagesMdpActions) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Vrai lorsqu'un mot de passe est défini et actif. */
export function protectionActive(): boolean {
  const r = lireReglagesMdp();
  return r.actif && Boolean(r.empreinte && r.sel);
}

export async function definirMotDePasse(mdp: string): Promise<void> {
  const sel = nouveauSelMdp();
  ecrire({ actif: true, sel, empreinte: await empreinteMotDePasse(mdp, sel) });
}

export async function verifierMotDePasse(mdp: string): Promise<boolean> {
  const r = lireReglagesMdp();
  if (!r.empreinte || !r.sel) return false;
  return (await empreinteMotDePasse(mdp, r.sel)) === r.empreinte;
}

export async function changerMotDePasse(ancien: string, nouveau: string): Promise<boolean> {
  if (!(await verifierMotDePasse(ancien))) return false;
  await definirMotDePasse(nouveau);
  return true;
}

export async function retirerMotDePasse(ancien: string): Promise<boolean> {
  if (!(await verifierMotDePasse(ancien))) return false;
  ecrire(INITIAL);
  return true;
}

/* ------------------------------------------------------------------ */
/* Demande de confirmation                                             */
/* ------------------------------------------------------------------ */

type Demandeur = (libelle: string) => Promise<boolean>;

let demandeur: Demandeur | null = null;
let enCours: Promise<boolean> | null = null;
let valideJusqua = 0;

/** Le composant de saisie s'enregistre au montage. */
export function enregistrerDemandeurMdp(f: Demandeur): () => void {
  demandeur = f;
  return () => {
    if (demandeur === f) demandeur = null;
  };
}

/** Annule la fenêtre de validation (verrouillage, changement de mot de passe). */
export function oublierValidationMdp(): void {
  valideJusqua = 0;
}

/**
 * Demande le mot de passe avant une action de modification ou de suppression.
 * Renvoie vrai lorsque l'action peut se poursuivre.
 */
export function demanderMotDePasse(libelle = "Confirmez cette action"): Promise<boolean> {
  if (!protectionActive()) return Promise.resolve(true);
  if (Date.now() < valideJusqua) return Promise.resolve(true);
  if (enCours) return enCours;
  if (!demandeur) return Promise.resolve(false);

  enCours = demandeur(libelle)
    .then((ok) => {
      if (ok) valideJusqua = Date.now() + GRACE_MS;
      return ok;
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}
