import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PiggyBank, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import { suivreObjectifs, type SuiviObjectif } from "@/lib/objectifs";

export const Route = createFileRoute("/objectifs")({
  head: () => ({
    meta: [
      { title: "Objectifs d'épargne — SUPER APP" },
      {
        name: "description",
        content:
          "Fixez un montant et une date, et laissez l'application calculer l'effort mensuel nécessaire et vous alerter en cas de retard.",
      },
      { property: "og:title", content: "Objectifs d'épargne intelligents" },
      {
        property: "og:description",
        content: "Effort mensuel calculé, progression suivie et alerte en cas de retard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageObjectifs,
});

const COULEURS: Record<SuiviObjectif["etat"], string> = {
  atteint: "text-success",
  en_avance: "text-success",
  sur_la_bonne_voie: "text-primary",
  en_retard: "text-warning",
  en_danger: "text-destructive",
};

const ETIQUETTES: Record<SuiviObjectif["etat"], string> = {
  atteint: "Atteint",
  en_avance: "En avance",
  sur_la_bonne_voie: "Sur la bonne voie",
  en_retard: "En retard",
  en_danger: "En danger",
};

function PageObjectifs() {
  const {
    objectifs,
    transactions,
    transferts,
    enveloppes,
    comptes,
    comptesExclus,
    ajouterObjectif,
    supprimerObjectif,
    definirCompteDisponible,
  } = useSuperApp();
  const [ouvert, setOuvert] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [cible, setCible] = useState("");
  const [deja, setDeja] = useState("");
  const [dateCible, setDateCible] = useState("");
  const [enveloppeId, setEnveloppeId] = useState("");
  const [compteSource, setCompteSource] = useState("");
  const [compteEpargne, setCompteEpargne] = useState("");
  const [prelevementAuto, setPrelevementAuto] = useState(true);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  const suivis = useMemo(
    () => suivreObjectifs(objectifs, transactions, new Date(), transferts),
    [objectifs, transactions, transferts],
  );

  const enregistrer = () => {
    const montant = Number(cible.replace(/\s/g, ""));
    if (!libelle.trim()) {
      toast.error("Donnez un nom à votre objectif.");
      return;
    }
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error("Montant visé invalide.");
      return;
    }
    if (!dateCible) {
      toast.error("Choisissez une date à atteindre.");
      return;
    }
    if (dateCible <= new Date().toISOString().slice(0, 10)) {
      toast.error("La date visée doit être dans le futur.");
      return;
    }
    if (prelevementAuto) {
      if (!compteSource || !compteEpargne) {
        toast.error("Choisissez le compte à débiter et le compte d'épargne.");
        return;
      }
      if (compteSource === compteEpargne) {
        toast.error("Le compte d'épargne doit être différent du compte débité.");
        return;
      }
      // L'épargne d'un objectif ne doit jamais compter dans le solde disponible.
      if (!comptesExclus.includes(compteEpargne)) definirCompteDisponible(compteEpargne, false);
    }
    ajouterObjectif({
      libelle: libelle.trim(),
      cible: montant,
      deja: Number(deja.replace(/\s/g, "")) || 0,
      dateCible,
      enveloppeId: enveloppeId || undefined,
      compteSource: prelevementAuto ? compteSource : undefined,
      compteEpargne: prelevementAuto ? compteEpargne : undefined,
      prelevementAuto,
    });
    toast.success(
      prelevementAuto
        ? "Objectif créé : le prélèvement mensuel démarre aussitôt."
        : "Objectif créé.",
    );
    setLibelle("");
    setCible("");
    setDeja("");
    setDateCible("");
    setEnveloppeId("");
    setCompteSource("");
    setCompteEpargne("");
    setPrelevementAuto(true);
    setOuvert(false);
  };

  return (
    <div className="space-y-4 pt-4">
      <BoutonRetour to="/" label="Accueil" />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Target className="h-6 w-6 text-primary" aria-hidden />
          Objectifs d'épargne
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          L'application calcule seule l'effort mensuel nécessaire et vous alerte en cas de retard.
        </p>
      </header>

      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nouvel objectif
      </button>

      {ouvert && (
        <section className="carte space-y-3 p-4">
          <h2 className="text-sm font-semibold">Créer un objectif</h2>
          <label className="block text-xs font-medium text-muted-foreground">
            Nom de l'objectif
            <input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Voyage, moto, scolarité…"
              className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Montant visé (FCFA)
              <input
                inputMode="numeric"
                value={grouperMontant(cible)}
                onChange={(e) => setCible(deGrouperMontant(e.target.value))}
                placeholder="500000"
                className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Déjà de côté
              <input
                inputMode="numeric"
                value={grouperMontant(deja)}
                onChange={(e) => setDeja(deGrouperMontant(e.target.value))}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Date à atteindre
            <input
              type="date"
              value={dateCible}
              onChange={(e) => setDateCible(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Enveloppe d'épargne associée (facultatif)
            <select
              value={enveloppeId}
              onChange={(e) => setEnveloppeId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">Solde global (revenus − dépenses)</option>
              {enveloppes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emoji} {e.nom}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-3">
            <label className="flex items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={prelevementAuto}
                onChange={(e) => setPrelevementAuto(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <span>
                Épargner automatiquement chaque mois
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Le montant nécessaire est prélevé du compte choisi et déplacé vers un compte
                  d'épargne exclu du solde disponible.
                </span>
              </span>
            </label>

            {prelevementAuto && (
              <>
                <label className="block text-xs font-medium text-muted-foreground">
                  Compte à débiter
                  <select
                    value={compteSource}
                    onChange={(e) => setCompteSource(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Choisir un compte…</option>
                    {comptes
                      .filter((c) => !comptesExclus.includes(c))
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  Compte d'épargne de l'objectif
                  <select
                    value={compteEpargne}
                    onChange={(e) => setCompteEpargne(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Choisir un compte…</option>
                    {comptes
                      .filter((c) => c !== compteSource)
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                          {comptesExclus.includes(c) ? " (hors solde disponible)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">
                  Ce compte sera automatiquement exclu du solde disponible.
                </p>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="flex-1 rounded-xl border border-input bg-card px-4 py-2 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Enregistrer
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {suivis.length === 0 && !ouvert && (
          <div className="carte flex flex-col items-center gap-2 p-8 text-center">
            <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucun objectif pour le moment. Créez-en un pour suivre votre épargne.
            </p>
          </div>
        )}

        {suivis.map((s) => (
          <article key={s.objectif.id} className="carte space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{s.objectif.libelle}</h2>
                <p className="text-xs text-muted-foreground">
                  {formatFCFA(s.reuni)} sur {formatFCFA(s.objectif.cible)} · échéance{" "}
                  {s.objectif.dateCible}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setASupprimer(s.objectif.id)}
                aria-label={`Supprimer l'objectif ${s.objectif.libelle}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(s.progression)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progression de ${s.objectif.libelle}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(2, s.progression)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-muted-foreground">Restant</p>
                <p className="mt-0.5 font-semibold">{formatFCFA(s.restant)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-muted-foreground">Par mois</p>
                <p className="mt-0.5 font-semibold">{formatFCFA(s.effortMensuel)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-muted-foreground">Jours</p>
                <p className="mt-0.5 font-semibold">{s.joursRestants}</p>
              </div>
            </div>

            <p className={`text-sm font-medium ${COULEURS[s.etat]}`}>
              {ETIQUETTES[s.etat]} — {s.message}
            </p>
            {s.datePrevue && s.etat !== "atteint" && (
              <p className="text-xs text-muted-foreground">
                Au rythme actuel ({formatFCFA(s.rythmeMensuel)}/mois), objectif atteint vers le{" "}
                {s.datePrevue}.
              </p>
            )}
            {s.objectif.prelevementAuto && s.objectif.compteEpargne && (
              <p className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
                Épargne automatique : {formatFCFA(s.effortMensuel)}/mois prélevés de «{" "}
                {s.objectif.compteSource} » vers « {s.objectif.compteEpargne} », hors solde
                disponible.
              </p>
            )}
          </article>
        ))}
      </section>

      {aSupprimer && (
        <Confirmation
          ouvert
          danger
          confirmerLabel="Supprimer"
          titre="Supprimer cet objectif ?"
          message="Le suivi sera définitivement retiré. Vos opérations ne sont pas touchées."
          onAnnuler={() => setASupprimer(null)}
          onConfirmer={() => {
            supprimerObjectif(aSupprimer);
            setASupprimer(null);
            toast.success("Objectif supprimé.");
          }}
        />
      )}
    </div>
  );
}
