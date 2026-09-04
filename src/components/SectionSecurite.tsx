import { useState } from "react";
import { Fingerprint, KeyRound, Lock, ShieldCheck, Vault } from "lucide-react";
import { DELAIS, useSecurite } from "@/lib/securite";
import { PavePin } from "./PavePin";
import { Confirmation } from "./Confirmation";
import { ErreurPopup } from "./ErreurPopup";

type Processus = "creer" | "changer" | "desactiver" | "coffre" | "decoffre" | null;

/** Section Paramètres : verrouillage par code PIN et biométrie (100 % local). */
export function SectionSecurite() {
  const {
    config,
    biometrieDisponible,
    definirPin,
    changerPin,
    desactiverPin,
    verrouiller,
    definirDelai,
    activerBiometrie,
    desactiverBiometrie,
    coffreProtege,
    protegerCoffre,
    retirerProtectionCoffre,
  } = useSecurite();

  const [processus, setProcessus] = useState<Processus>(null);
  const [etape, setEtape] = useState(0);
  const [longueur, setLongueur] = useState(config.longueur || 4);
  const [ancien, setAncien] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [demandeConfirmation, setDemandeConfirmation] = useState(false);
  const [erreur, setErreur] = useState("");

  const fermer = () => {
    setProcessus(null);
    setEtape(0);
    setAncien("");
    setCode("");
    setConfirmation("");
    setDemandeConfirmation(false);
  };

  const ouvrir = (p: Exclude<Processus, null>) => {
    setProcessus(p);
    setEtape(0);
    setAncien("");
    setCode("");
    setConfirmation("");
    setLongueur(p === "creer" ? 4 : config.longueur);
  };

  const titreProcessus =
    processus === "creer"
      ? "Créer un code de verrouillage"
      : processus === "changer"
        ? "Changer le code de verrouillage"
        : processus === "coffre"
          ? "Sceller le coffre avec le code"
          : processus === "decoffre"
            ? "Retirer le scellé du coffre"
            : "Désactiver le verrouillage";

  const valider = async () => {
    if (processus === "creer") {
      await definirPin(code);
    } else if (processus === "changer") {
      const ok = await changerPin(ancien, code);
      if (!ok) {
        setDemandeConfirmation(false);
        setErreur("L'ancien code est incorrect. Reprenez votre action.");
        return;
      }
    } else if (processus === "coffre") {
      const ok = await protegerCoffre(ancien);
      if (!ok) {
        setDemandeConfirmation(false);
        setErreur("Le code saisi est incorrect. Reprenez votre action.");
        return;
      }
    } else if (processus === "decoffre") {
      const ok = await retirerProtectionCoffre(ancien);
      if (!ok) {
        setDemandeConfirmation(false);
        setErreur("Le code saisi est incorrect. Reprenez votre action.");
        return;
      }
    } else if (processus === "desactiver") {
      const ok = await desactiverPin(ancien);
      if (!ok) {
        setDemandeConfirmation(false);
        setErreur("Le code saisi est incorrect. Reprenez votre action.");
        return;
      }
    }
    fermer();
  };

  const details =
    processus === "creer"
      ? [{ label: "Verrouillage", avant: "Désactivé", apres: `Activé · ${longueur} chiffres` }]
      : processus === "changer"
        ? [
            {
              label: "Code PIN",
              avant: "Code actuel",
              apres: `Nouveau code · ${code.length} chiffres`,
            },
          ]
        : processus === "coffre"
          ? [{ label: "Coffre chiffré", avant: "Ouvrable sans code", apres: "Scellé par le code" }]
          : processus === "decoffre"
            ? [
                {
                  label: "Coffre chiffré",
                  avant: "Scellé par le code",
                  apres: "Ouvrable sans code",
                },
              ]
            : [{ label: "Verrouillage", avant: "Activé", apres: "Désactivé" }];

  return (
    <section className="carte space-y-3 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="font-semibold">Sécurité d'accès</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Protégez l'ouverture de l'application par un code personnel. Le code n'est jamais stocké en
        clair et ne quitte pas cet appareil.
      </p>

      {!config.actif ? (
        <button
          type="button"
          onClick={() => ouvrir("creer")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          <KeyRound className="h-4 w-4" aria-hidden />
          Activer le code de verrouillage
        </button>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="delai" className="text-sm font-semibold">
              Verrouiller automatiquement
            </label>
            <select
              id="delai"
              value={config.delaiMinutes}
              onChange={(e) => definirDelai(Number(e.target.value))}
              className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
            >
              {DELAIS.map((d) => (
                <option key={d.valeur} value={d.valeur}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {biometrieDisponible && (
            <button
              type="button"
              onClick={() => {
                if (config.biometrie) desactiverBiometrie();
                else
                  void activerBiometrie().then((ok) => {
                    if (!ok)
                      setErreur("La biométrie n'a pas pu être enregistrée sur cet appareil.");
                  });
              }}
              className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-semibold"
            >
              <span className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-primary" aria-hidden />
                Déverrouillage biométrique
              </span>
              <span className={config.biometrie ? "text-primary" : "text-muted-foreground"}>
                {config.biometrie ? "Activé" : "Désactivé"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => ouvrir(coffreProtege ? "decoffre" : "coffre")}
            className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <Vault className="h-4 w-4 text-primary" aria-hidden />
              Sceller mes données par le code
            </span>
            <span className={coffreProtege ? "text-primary" : "text-muted-foreground"}>
              {coffreProtege ? "Activé" : "Désactivé"}
            </span>
          </button>
          <p className="text-xs text-muted-foreground">
            Quand le coffre est scellé, la clé de déchiffrement n'est plus enregistrée en clair sur
            le téléphone : même une copie complète de l'appareil reste illisible sans votre code.
            Attention : si vous oubliez le code, vos données seront définitivement perdues.
          </p>

          <button
            type="button"
            onClick={() => verrouiller()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Lock className="h-4 w-4" aria-hidden />
            Verrouiller maintenant
          </button>

          <button
            type="button"
            onClick={() => ouvrir("changer")}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Changer le code
          </button>

          <button
            type="button"
            onClick={() => ouvrir("desactiver")}
            className="w-full rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive"
          >
            Désactiver le verrouillage
          </button>
        </div>
      )}

      {processus && !demandeConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titreProcessus}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-3 pb-6 pt-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) fermer();
          }}
        >
          <div className="carte max-h-full w-full max-w-md space-y-4 overflow-y-auto p-4">
            <h3 className="text-base font-bold">{titreProcessus}</h3>

            {processus === "creer" && etape === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Combien de chiffres souhaitez-vous pour votre code ?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLongueur(n)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        longueur === n ? "border-primary text-primary" : "border-border"
                      }`}
                    >
                      {n} chiffres
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEtape(1)}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Continuer
                </button>
              </div>
            )}

            {((processus === "changer" && etape === 0) ||
              processus === "desactiver" ||
              processus === "coffre" ||
              processus === "decoffre") && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {processus === "changer"
                    ? "Saisissez votre code actuel."
                    : processus === "coffre"
                      ? "Saisissez votre code : il servira désormais à ouvrir vos données chiffrées."
                      : processus === "decoffre"
                        ? "Saisissez votre code pour retirer le scellé du coffre."
                        : "Saisissez votre code pour confirmer la désactivation."}
                </p>
                <PavePin
                  longueur={config.longueur}
                  valeur={ancien}
                  onChange={setAncien}
                  onComplet={() =>
                    processus === "changer" ? setEtape(1) : setDemandeConfirmation(true)
                  }
                />
              </div>
            )}

            {((processus === "creer" && etape === 1) ||
              (processus === "changer" && etape === 1)) && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Saisissez votre nouveau code à {longueur} chiffres.
                </p>
                <PavePin
                  longueur={longueur}
                  valeur={code}
                  onChange={setCode}
                  onComplet={() => setEtape(2)}
                />
              </div>
            )}

            {etape === 2 && processus !== "desactiver" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Confirmez votre nouveau code.</p>
                <PavePin
                  longueur={longueur}
                  valeur={confirmation}
                  onChange={setConfirmation}
                  onComplet={(v) => {
                    if (v !== code) {
                      setConfirmation("");
                      setCode("");
                      setEtape(1);
                      setErreur("Les deux codes ne correspondent pas. Reprenez votre saisie.");
                      return;
                    }
                    setDemandeConfirmation(true);
                  }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={fermer}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <Confirmation
        ouvert={demandeConfirmation}
        titre={titreProcessus}
        message={
          processus === "coffre"
            ? "Vos données ne pourront plus être ouvertes sans ce code. En cas d'oubli, elles seront définitivement perdues. Confirmez-vous ?"
            : processus === "decoffre"
              ? "La clé de déchiffrement redeviendra enregistrée sur le téléphone. Confirmez-vous ?"
              : processus === "desactiver"
                ? "L'application ne sera plus protégée par un code à l'ouverture. Confirmez-vous ?"
                : "Confirmez-vous l'enregistrement de ce code de verrouillage ?"
        }
        details={details}
        danger={processus === "desactiver"}
        onConfirmer={() => {
          setDemandeConfirmation(false);
          void valider();
        }}
        onAnnuler={() => setDemandeConfirmation(false)}
      />

      <ErreurPopup ouvert={Boolean(erreur)} message={erreur} onFermer={() => setErreur("")} />
    </section>
  );
}
