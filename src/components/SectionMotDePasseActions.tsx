import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  abonnerMdp,
  changerMotDePasse,
  definirMotDePasse,
  lireReglagesMdp,
  oublierValidationMdp,
  retirerMotDePasse,
  type ReglagesMdpActions,
} from "@/lib/mot-de-passe-actions";

/** Réglage du mot de passe exigé avant toute modification ou suppression. */
export function SectionMotDePasseActions() {
  const [reglages, setReglages] = useState<ReglagesMdpActions>({
    actif: false,
    empreinte: null,
    sel: null,
  });
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    setReglages(lireReglagesMdp());
    return abonnerMdp(setReglages);
  }, []);

  const defini = reglages.actif && Boolean(reglages.empreinte);

  const enregistrer = async () => {
    if (nouveau.length < 4) {
      toast.error("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    if (nouveau !== confirmation) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (defini) {
      if (!(await changerMotDePasse(ancien, nouveau))) {
        toast.error("Ancien mot de passe incorrect.");
        return;
      }
    } else {
      await definirMotDePasse(nouveau);
    }
    oublierValidationMdp();
    setAncien("");
    setNouveau("");
    setConfirmation("");
    toast.success("Mot de passe des actions enregistré.");
  };

  const retirer = async () => {
    if (!(await retirerMotDePasse(ancien))) {
      toast.error("Mot de passe incorrect.");
      return;
    }
    oublierValidationMdp();
    setAncien("");
    toast.success("Protection retirée.");
  };

  return (
    <section className="surface space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-bold tracking-tight">Mot de passe des modifications</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Une fois défini, ce mot de passe est demandé avant chaque modification et chaque suppression
        (opérations, comptes, enveloppes, budgets, dettes, objectifs, corbeille).
      </p>
      <p className="text-xs font-semibold">
        État : {defini ? "protection active" : "aucun mot de passe défini"}
      </p>

      {defini && (
        <input
          type="password"
          value={ancien}
          onChange={(e) => setAncien(e.target.value)}
          placeholder="Mot de passe actuel"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        />
      )}
      <input
        type="password"
        value={nouveau}
        onChange={(e) => setNouveau(e.target.value)}
        placeholder={defini ? "Nouveau mot de passe" : "Mot de passe"}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      <input
        type="password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder="Confirmer le mot de passe"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {defini ? "Changer" : "Activer"}
        </button>
        {defini && (
          <button
            type="button"
            onClick={retirer}
            className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"
          >
            Retirer
          </button>
        )}
      </div>
    </section>
  );
}
