import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { enregistrerPhrase, lirePhrase, lireReglagesMail } from "@/lib/sauvegarde-email";

/**
 * Permet de remplacer la phrase de récupération tant que l'utilisateur a
 * encore accès à son téléphone. Les sauvegardes déjà envoyées gardent
 * l'ancienne phrase ; les suivantes utilisent la nouvelle.
 */
export function ChangerPhraseRecuperation() {
  const [aUnePhrase, setAUnePhrase] = useState(false);
  const [ancienne, setAncienne] = useState("");
  const [nouvelle, setNouvelle] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  useEffect(() => {
    void (async () => {
      const p = await lirePhrase();
      setAUnePhrase(Boolean(p));
    })();
  }, []);

  const valider = async () => {
    setErreur("");
    setSucces("");
    const actuelle = await lirePhrase();
    if (actuelle && ancienne !== actuelle) {
      setErreur("La phrase actuelle ne correspond pas.");
      return;
    }
    if (nouvelle.trim().length < 8) {
      setErreur("La nouvelle phrase doit contenir au moins 8 caractères.");
      return;
    }
    if (nouvelle !== confirmation) {
      setErreur("Les deux nouvelles phrases ne sont pas identiques.");
      return;
    }
    await enregistrerPhrase(nouvelle);
    setAUnePhrase(true);
    setAncienne("");
    setNouvelle("");
    setConfirmation("");
    setSucces(
      lireReglagesMail().actif
        ? "Phrase modifiée. Les prochaines copies envoyées par e-mail s'ouvriront avec cette nouvelle phrase."
        : "Phrase modifiée sur cet appareil.",
    );
  };

  return (
    <section className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden /> Modifier ma phrase de récupération
      </h2>
      <p className="text-xs text-muted-foreground">
        Cette phrase protège les copies envoyées à votre adresse e-mail. Vous pouvez la remplacer
        tant que vous avez accès à ce téléphone. Les copies déjà envoyées restent liées à
        l'ancienne phrase : conservez-la si vous voulez encore les ouvrir.
      </p>

      {aUnePhrase ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Phrase actuelle</span>
          <input
            type="password"
            value={ancienne}
            onChange={(e) => setAncienne(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Nouvelle phrase</span>
        <input
          type="password"
          value={nouvelle}
          onChange={(e) => setNouvelle(e.target.value)}
          placeholder="8 caractères minimum"
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Répéter la nouvelle phrase</span>
        <input
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </label>

      {erreur ? <p className="text-sm font-semibold text-destructive">{erreur}</p> : null}
      {succes ? (
        <p className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {succes}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void valider()}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Enregistrer la nouvelle phrase
      </button>
    </section>
  );
}
