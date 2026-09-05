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
export function ConfigurationSauvegarde() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [appareil, setAppareil] = useState("MON TÉLÉPHONE");
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const r = lireReglagesMail();
    if (!r.configure) setVisible(true);
  }, []);

  if (!visible) return null;

  const valider = async () => {
    if (!estEmailValide(email)) {
      setErreur("Entrez une adresse e-mail valide.");
      return;
    }
    if (phrase.trim().length < 8) {
      setErreur("La phrase de récupération doit contenir au moins 8 caractères.");
      return;
    }
    if (phrase !== confirmation) {
      setErreur("Les deux phrases saisies ne sont pas identiques.");
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
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/95 px-3 py-6 sm:items-center">
      <div className="carte w-full max-w-md space-y-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Protéger mes données</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Vos données restent sur ce téléphone. Une copie chiffrée cinq fois est envoyée à votre
          adresse e-mail : si vous changez de téléphone, vous récupérez tout avec votre phrase de
          récupération.
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
          <span className="text-sm font-semibold">Nom de ce téléphone</span>
          <input
            value={appareil}
            onChange={(e) => setAppareil(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Phrase de récupération</span>
          <input
            type="password"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="8 caractères minimum"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Répéter la phrase</span>
          <input
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          />
        </label>

        <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          Notez cette phrase quelque part de sûr. Sans elle, personne — pas même nous — ne peut
          rouvrir vos sauvegardes.
        </p>

        {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void valider()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Mail className="h-4 w-4" /> Activer la sauvegarde
          </button>
          <button
            type="button"
            onClick={() => {
              ecrireReglagesMail({ ...lireReglagesMail(), configure: true, actif: false });
              setVisible(false);
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
