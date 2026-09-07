import { useEffect, useState } from "react";
import { Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { useSecurite } from "@/lib/securite";
import { lireOptions, pinDejaSaisiAujourdHui } from "@/lib/securite-avancee";
import { PavePin } from "./PavePin";

/** Écran plein écran affiché tant que l'application est verrouillée. */
export function EcranVerrou() {
  const {
    verrouille,
    doitCreerPin,
    config,
    verifierPin,
    definirPin,
    essais,
    blocageJusqua,
    deverrouillerParBiometrie,
  } = useSecurite();
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etapeCreation, setEtapeCreation] = useState(0);
  const [erreur, setErreur] = useState("");
  const [restant, setRestant] = useState(0);

  const codeDuJourRequis = lireOptions().pinPremierDuJour && !pinDejaSaisiAujourdHui();

  useEffect(() => {
    if (!verrouille) {
      setCode("");
      setErreur("");
    }
  }, [verrouille]);

  useEffect(() => {
    if (!blocageJusqua) return;
    const tick = () => setRestant(Math.max(0, Math.ceil((blocageJusqua - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [blocageJusqua]);

  // Propose la biométrie dès l'affichage de l'écran de verrouillage.
  useEffect(() => {
    if (verrouille && config.biometrie && !codeDuJourRequis) void deverrouillerParBiometrie();
  }, [verrouille, config.biometrie, codeDuJourRequis, deverrouillerParBiometrie]);

  // Code obligatoire : création imposée à la première ouverture.
  if (doitCreerPin && !verrouille) {
    const longueur = 4;
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="surface rounded-full border border-border p-3 text-primary">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="text-lg font-bold tracking-tight">Créez votre code</h1>
            <p className="text-xs text-muted-foreground">
              {etapeCreation === 0
                ? "Choisissez un code à 4 chiffres pour protéger vos données."
                : "Saisissez à nouveau le même code pour confirmer."}
            </p>
          </div>
          <PavePin
            longueur={longueur}
            valeur={etapeCreation === 0 ? code : confirmation}
            onChange={(v) => {
              if (etapeCreation === 0) setCode(v);
              else setConfirmation(v);
              setErreur("");
            }}
            onComplet={(v) => {
              if (etapeCreation === 0) {
                setEtapeCreation(1);
                setConfirmation("");
                return;
              }
              if (v !== code) {
                setErreur("Les deux codes sont différents.");
                setConfirmation("");
                setEtapeCreation(0);
                setCode("");
                return;
              }
              void definirPin(v);
            }}
          />
          {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}
        </div>
      </div>
    );
  }

  if (!verrouille) return null;

  const bloque = restant > 0;

  const valider = async (valeur: string) => {
    const ok = await verifierPin(valeur);
    if (!ok) {
      setCode("");
      setErreur(bloque ? "Saisie temporairement bloquée." : "Code incorrect. Veuillez réessayer.");
    }
  };

  return (
    <div
      id="ecran-verrou"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6"
    >
      <div className="w-full max-w-xs space-y-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="surface rounded-full border border-border p-3 text-primary">
            <Lock className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-lg font-bold tracking-tight">Application verrouillée</h1>
          <p className="text-xs text-muted-foreground">
            Saisissez votre code à {config.longueur} chiffres pour continuer.
          </p>
        </div>

        <PavePin
          longueur={config.longueur}
          valeur={code}
          onChange={(v) => {
            setCode(v);
            setErreur("");
          }}
          onComplet={valider}
          desactive={bloque}
        />

        {erreur && !bloque && <p className="text-sm font-semibold text-destructive">{erreur}</p>}
        {bloque && (
          <p className="text-sm font-semibold text-destructive">
            Trop de tentatives. Réessayez dans {restant} s.
          </p>
        )}
        {!bloque && essais > 0 && (
          <p className="text-xs text-muted-foreground">
            {essais} tentative{essais > 1 ? "s" : ""} incorrecte{essais > 1 ? "s" : ""}.
          </p>
        )}

        {config.biometrie && codeDuJourRequis && (
          <p className="text-xs text-muted-foreground">
            Votre code est demandé pour le premier déverrouillage de la journée.
          </p>
        )}

        {config.biometrie && !codeDuJourRequis && (
          <button
            type="button"
            onClick={() => void deverrouillerParBiometrie()}
            className="mx-auto flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-primary"
          >
            <Fingerprint className="h-4 w-4" aria-hidden />
            Déverrouiller par biométrie
          </button>
        )}
      </div>
    </div>
  );
}
