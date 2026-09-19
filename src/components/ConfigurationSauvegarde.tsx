import { useEffect, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import {
  ecrireReglagesMail,
  enregistrerPhrase,
  estEmailValide,
  lireReglagesMail,
} from "@/lib/sauvegarde-email";

/**
 * Premier lancement : l'utilisateur indique l'adresse e-mail qui recevra ses
 * sauvegardes chiffrées et la phrase de récupération qui permettra de les
 * rouvrir sur un autre téléphone.
 */
export function ConfigurationSauvegarde({
  forceOpen,
  onFermer,
}: {
  forceOpen?: boolean;
  onFermer?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [appareil, setAppareil] = useState("MON TÉLÉPHONE");
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [phraseNotee, setPhraseNotee] = useState(false);

  useEffect(() => {
    const r = lireReglagesMail();
    setEmail(r.email || "");
    setAppareil(r.appareil || "MON TÉLÉPHONE");
    // Jamais imposée à l'ouverture : l'écran s'affiche seulement depuis la
    // page Sauvegarde, pour ne bloquer personne au démarrage.
    if (forceOpen) setVisible(true);
  }, [forceOpen]);

  if (!visible) return null;

  const fermer = () => {
    setVisible(false);
    onFermer?.();
  };

  const valider = async () => {
    if (!estEmailValide(email)) {
      setErreur("Entrez une adresse e-mail valide.");
      return;
    }
    if (phrase.trim().length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    await enregistrerPhrase(phrase);
    ecrireReglagesMail({
      ...lireReglagesMail(),
      email: email.trim(),
      appareil: appareil.trim() || "MON TÉLÉPHONE",
      configure: true,
      actif: true,
    });
    fermer();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/95 px-3 py-6 sm:items-center">
      <div className="carte w-full max-w-md space-y-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Protéger mes données</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Entrez votre adresse e-mail et un mot de passe. Vos données restent sur ce téléphone, et
          une copie chiffrée est rangée dans l'espace de votre adresse e-mail : sur un autre
          téléphone, les mêmes identifiants ramènent tout.
        </p>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Mon adresse e-mail</span>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemple@mail.com"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Mot de passe</span>
          <input
            type="password"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="8 caractères minimum"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          />
        </label>

        {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void valider()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Mail className="h-4 w-4" /> Se connecter
          </button>
          <button
            type="button"
            onClick={() => {
              ecrireReglagesMail({ ...lireReglagesMail(), configure: true, actif: false });
              fermer();
            }}
            className="w-full rounded-xl border border-input px-4 py-2.5 text-sm font-semibold"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
