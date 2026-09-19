import { useEffect, useState } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useSecurite } from "@/lib/securite";
import { empreinteCode, lireOptions } from "@/lib/securite-avancee";
import { PavePin } from "./PavePin";
import { lirePhrase } from "@/lib/sauvegarde-email";
import { ecrireOptions } from "@/lib/securite-avancee";
import { retourIntelligent } from "@/lib/retour";

/** Pages contenant des actions irréversibles ou une sortie de données. */
const PAGES_PROTEGEES = ["/parametres/donnees", "/sauvegarde", "/parametres/securite"];

const CLE_SESSION = "superapp:securite:actions-ouvertes";

/** Exige le code avant les actions sensibles (purge, export, sauvegarde). */
export function GardeActionSensible() {
  const { pathname } = useLocation();
  const router = useRouter();
  const { config } = useSecurite();
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(false);
  // Issue de secours : sans elle, un code oublié rendrait la page Sécurité
  // inaccessible, donc impossible de désactiver le verrou.
  const [secours, setSecours] = useState(false);
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    setCode("");
    setErreur("");
    try {
      setOuvert(window.sessionStorage.getItem(CLE_SESSION) === "1");
    } catch {
      setOuvert(false);
    }
  }, [pathname]);

  const protege =
    lireOptions().verrouActionsSensibles &&
    config.actif &&
    Boolean(config.empreinte && config.sel) &&
    PAGES_PROTEGEES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!protege || ouvert) return null;

  const valider = async (valeur: string) => {
    const attendu = await empreinteCode(valeur, config.sel ?? "");
    if (attendu === config.empreinte) {
      try {
        window.sessionStorage.setItem(CLE_SESSION, "1");
      } catch {
        /* stockage indisponible */
      }
      setOuvert(true);
      return;
    }
    setCode("");
    setErreur("Code incorrect.");
  };

  const validerPhrase = async () => {
    const attendue = await lirePhrase();
    if (attendue && phrase.trim() === attendue.trim()) {
      // Le verrou est désactivé : l'utilisateur reprend la main sur ses réglages.
      ecrireOptions({ verrouActionsSensibles: false });
      try {
        window.sessionStorage.setItem(CLE_SESSION, "1");
      } catch {
        /* stockage indisponible */
      }
      setOuvert(true);
      return;
    }
    setErreur(
      attendue
        ? "Cette phrase de récupération ne correspond pas."
        : "Aucune phrase de récupération n'est enregistrée sur cet appareil.",
    );
  };

  if (secours) {
    return (
      <div className="fixed inset-0 z-[94] flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-xs space-y-4 text-center">
          <h1 className="text-lg font-bold tracking-tight">Code oublié</h1>
          <p className="text-xs text-muted-foreground">
            Saisissez votre phrase de récupération : le verrou sera retiré et vous pourrez choisir un
            nouveau code.
          </p>
          <input
            type="text"
            value={phrase}
            onChange={(e) => {
              setPhrase(e.target.value);
              setErreur("");
            }}
            placeholder="Phrase de récupération"
            className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm"
          />
          {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}
          <button
            type="button"
            onClick={() => void validerPhrase()}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Retirer le verrou
          </button>
          <button
            type="button"
            onClick={() => {
              setSecours(false);
              setErreur("");
            }}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Revenir au code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[94] flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs space-y-5 text-center">
        <span className="surface mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border text-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-lg font-bold tracking-tight">Action protégée</h1>
        <p className="text-xs text-muted-foreground">
          Confirmez votre code pour accéder à cette page.
        </p>
        <PavePin
          longueur={config.longueur}
          valeur={code}
          onChange={(v) => {
            setCode(v);
            setErreur("");
          }}
          onComplet={valider}
        />
        {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}
        <button
          type="button"
          onClick={() => {
            setSecours(true);
            setErreur("");
          }}
          className="w-full text-xs font-semibold text-primary underline underline-offset-2"
        >
          J'ai oublié mon code
        </button>
        <button
          type="button"
          onClick={() => retourIntelligent(router)}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
        >
          Retour
        </button>
      </div>
    </div>
  );
}
