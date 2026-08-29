import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from "react";

/** Configuration de sécurité stockée localement (aucune donnée envoyée en ligne). */
export type ConfigSecurite = {
  /** Verrouillage par code PIN activé. */
  actif: boolean;
  /** Empreinte SHA-256 du couple sel + PIN (le PIN n'est jamais stocké en clair). */
  empreinte: string | null;
  /** Sel aléatoire propre à cet appareil. */
  sel: string | null;
  /** Longueur du PIN choisi (4 à 6 chiffres). */
  longueur: number;
  /** Délai d'inactivité avant verrouillage automatique, en minutes (0 = immédiat). */
  delaiMinutes: number;
  /** Déverrouillage biométrique activé (empreinte / visage de l'appareil). */
  biometrie: boolean;
  /** Identifiant de la clé biométrique enregistrée. */
  identifiantBiometrie: string | null;
};

export const DELAIS: { valeur: number; label: string }[] = [
  { valeur: 0, label: "Immédiatement" },
  { valeur: 1, label: "Après 1 minute" },
  { valeur: 5, label: "Après 5 minutes" },
  { valeur: 15, label: "Après 15 minutes" },
  { valeur: 60, label: "Après 1 heure" },
];

const CLE = "superapp:securite:v1";
const CLE_ACTIVITE = "superapp:securite:activite";

const CONFIG_INITIALE: ConfigSecurite = {
  actif: false,
  empreinte: null,
  sel: null,
  longueur: 4,
  delaiMinutes: 1,
  biometrie: false,
  identifiantBiometrie: null,
};

function octetsEnHexa(octets: ArrayBuffer | Uint8Array): string {
  const vue = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  return Array.from(vue)
    .map((o) => o.toString(16).padStart(2, "0"))
    .join("");
}

function nouveauSel(): string {
  const tampon = new Uint8Array(16);
  crypto.getRandomValues(tampon);
  return octetsEnHexa(tampon);
}

async function calculerEmpreinte(pin: string, sel: string): Promise<string> {
  const donnees = new TextEncoder().encode(`${sel}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", donnees);
  return octetsEnHexa(digest);
}

type Contexte = {
  config: ConfigSecurite;
  /** true tant que la configuration locale n'a pas été lue. */
  chargement: boolean;
  /** L'écran de verrouillage doit être affiché. */
  verrouille: boolean;
  /** Nombre d'essais infructueux consécutifs. */
  essais: number;
  /** Horodatage (ms) jusqu'auquel la saisie est bloquée après trop d'essais. */
  blocageJusqua: number;
  biometrieDisponible: boolean;
  definirPin: (pin: string) => Promise<void>;
  changerPin: (ancien: string, nouveau: string) => Promise<boolean>;
  desactiverPin: (pin: string) => Promise<boolean>;
  verifierPin: (pin: string) => Promise<boolean>;
  verrouiller: () => void;
  definirDelai: (minutes: number) => void;
  activerBiometrie: () => Promise<boolean>;
  desactiverBiometrie: () => void;
  deverrouillerParBiometrie: () => Promise<boolean>;
};

const registre = globalThis as typeof globalThis & {
  __superAppSecurite?: Context<Contexte | null>;
};
const SecuriteContext = registre.__superAppSecurite ?? createContext<Contexte | null>(null);
registre.__superAppSecurite = SecuriteContext;

export function SecuriteProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigSecurite>(CONFIG_INITIALE);
  const [chargement, setChargement] = useState(true);
  const [verrouille, setVerrouille] = useState(false);
  const [essais, setEssais] = useState(0);
  const [blocageJusqua, setBlocageJusqua] = useState(0);
  const [biometrieDisponible, setBiometrieDisponible] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lecture de la configuration locale au démarrage.
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE);
      if (brut) {
        const charge = { ...CONFIG_INITIALE, ...(JSON.parse(brut) as Partial<ConfigSecurite>) };
        setConfig(charge);
        if (charge.actif && charge.empreinte) {
          const derniere = Number(window.localStorage.getItem(CLE_ACTIVITE) ?? 0);
          const ecoule = Date.now() - derniere;
          setVerrouille(!derniere || ecoule >= charge.delaiMinutes * 60_000);
        }
      }
    } catch {
      /* stockage indisponible */
    }
    setChargement(false);
  }, []);

  useEffect(() => {
    if (chargement) return;
    try {
      window.localStorage.setItem(CLE, JSON.stringify(config));
    } catch {
      /* stockage indisponible */
    }
  }, [config, chargement]);

  useEffect(() => {
    let annule = false;
    const w = window as typeof window & {
      PublicKeyCredential?: {
        isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
      };
    };
    const test = w.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    if (!test) return;
    test()
      .then((ok) => {
        if (!annule) setBiometrieDisponible(Boolean(ok));
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  const marquerActivite = useCallback(() => {
    try {
      window.localStorage.setItem(CLE_ACTIVITE, String(Date.now()));
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const verrouiller = useCallback(() => {
    setVerrouille(true);
    setEssais(0);
  }, []);

  // Verrouillage automatique après inactivité et au retour en arrière-plan.
  useEffect(() => {
    if (!config.actif || !config.empreinte || verrouille) return;
    marquerActivite();

    const reprogrammer = () => {
      marquerActivite();
      if (minuteur.current) clearTimeout(minuteur.current);
      if (config.delaiMinutes > 0) {
        minuteur.current = setTimeout(() => verrouiller(), config.delaiMinutes * 60_000);
      }
    };
    reprogrammer();

    const surVisibilite = () => {
      if (document.visibilityState === "hidden") {
        marquerActivite();
        if (config.delaiMinutes === 0) verrouiller();
        return;
      }
      const derniere = Number(window.localStorage.getItem(CLE_ACTIVITE) ?? 0);
      if (Date.now() - derniere >= config.delaiMinutes * 60_000) verrouiller();
      else reprogrammer();
    };

    const evenements = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of evenements) window.addEventListener(e, reprogrammer, { passive: true });
    document.addEventListener("visibilitychange", surVisibilite);

    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
      for (const e of evenements) window.removeEventListener(e, reprogrammer);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [config.actif, config.empreinte, config.delaiMinutes, verrouille, marquerActivite, verrouiller]);

  const verifierPin = useCallback(
    async (pin: string) => {
      if (!config.empreinte || !config.sel) return false;
      if (Date.now() < blocageJusqua) return false;
      const empreinte = await calculerEmpreinte(pin, config.sel);
      const ok = empreinte === config.empreinte;
      if (ok) {
        setEssais(0);
        setBlocageJusqua(0);
        setVerrouille(false);
        marquerActivite();
      } else {
        setEssais((n) => {
          const suivant = n + 1;
          if (suivant % 5 === 0) setBlocageJusqua(Date.now() + 30_000 * Math.ceil(suivant / 5));
          return suivant;
        });
      }
      return ok;
    },
    [config.empreinte, config.sel, blocageJusqua, marquerActivite],
  );

  const definirPin = useCallback(async (pin: string) => {
    const sel = nouveauSel();
    const empreinte = await calculerEmpreinte(pin, sel);
    setConfig((c) => ({ ...c, actif: true, sel, empreinte, longueur: pin.length }));
    setVerrouille(false);
    try {
      window.localStorage.setItem(CLE_ACTIVITE, String(Date.now()));
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const changerPin = useCallback(
    async (ancien: string, nouveau: string) => {
      if (!config.sel || !config.empreinte) return false;
      const empreinteAncienne = await calculerEmpreinte(ancien, config.sel);
      if (empreinteAncienne !== config.empreinte) return false;
      const sel = nouveauSel();
      const empreinte = await calculerEmpreinte(nouveau, sel);
      setConfig((c) => ({ ...c, sel, empreinte, longueur: nouveau.length }));
      return true;
    },
    [config.sel, config.empreinte],
  );

  const desactiverPin = useCallback(
    async (pin: string) => {
      if (!config.sel || !config.empreinte) return false;
      const empreinte = await calculerEmpreinte(pin, config.sel);
      if (empreinte !== config.empreinte) return false;
      setConfig((c) => ({
        ...c,
        actif: false,
        sel: null,
        empreinte: null,
        biometrie: false,
        identifiantBiometrie: null,
      }));
      setVerrouille(false);
      return true;
    },
    [config.sel, config.empreinte],
  );

  const definirDelai = useCallback((minutes: number) => {
    setConfig((c) => ({ ...c, delaiMinutes: minutes }));
  }, []);

  const activerBiometrie = useCallback(async () => {
    if (!biometrieDisponible || !navigator.credentials?.create) return false;
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const idUtilisateur = new Uint8Array(16);
      crypto.getRandomValues(idUtilisateur);
      const cle = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "SUPER APP" },
          user: { id: idUtilisateur, name: "utilisateur", displayName: "Utilisateur" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!cle) return false;
      setConfig((c) => ({
        ...c,
        biometrie: true,
        identifiantBiometrie: octetsEnHexa(new Uint8Array(cle.rawId)),
      }));
      return true;
    } catch {
      return false;
    }
  }, [biometrieDisponible]);

  const desactiverBiometrie = useCallback(() => {
    setConfig((c) => ({ ...c, biometrie: false, identifiantBiometrie: null }));
  }, []);

  const deverrouillerParBiometrie = useCallback(async () => {
    if (!config.biometrie || !config.identifiantBiometrie || !navigator.credentials?.get) {
      return false;
    }
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const octets = config.identifiantBiometrie.match(/.{2}/g) ?? [];
      const id = Uint8Array.from(octets.map((o) => parseInt(o, 16)));
      const resultat = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ type: "public-key", id }],
          userVerification: "required",
          timeout: 60_000,
        },
      });
      if (!resultat) return false;
      setVerrouille(false);
      setEssais(0);
      marquerActivite();
      return true;
    } catch {
      return false;
    }
  }, [config.biometrie, config.identifiantBiometrie, marquerActivite]);

  const valeur = useMemo<Contexte>(
    () => ({
      config,
      chargement,
      verrouille: verrouille && config.actif && Boolean(config.empreinte),
      essais,
      blocageJusqua,
      biometrieDisponible,
      definirPin,
      changerPin,
      desactiverPin,
      verifierPin,
      verrouiller,
      definirDelai,
      activerBiometrie,
      desactiverBiometrie,
      deverrouillerParBiometrie,
    }),
    [
      config,
      chargement,
      verrouille,
      essais,
      blocageJusqua,
      biometrieDisponible,
      definirPin,
      changerPin,
      desactiverPin,
      verifierPin,
      verrouiller,
      definirDelai,
      activerBiometrie,
      desactiverBiometrie,
      deverrouillerParBiometrie,
    ],
  );

  return <SecuriteContext.Provider value={valeur}>{children}</SecuriteContext.Provider>;
}

export function useSecurite() {
  const ctx = useContext(SecuriteContext);
  if (!ctx) throw new Error("useSecurite doit être utilisé dans SecuriteProvider");
  return ctx;
}
