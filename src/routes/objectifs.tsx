import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lightbulb, Pencil, PiggyBank, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Confirmation } from "@/components/Confirmation";
import { useSuperApp, type Objectif, type TypeObjectif, type UniteRappel } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import { suivreObjectifs, type SuiviObjectif } from "@/lib/objectifs";
import { proposerAjustements } from "@/lib/ajustement-objectifs";
import { joursRythme, rythmeObjectif } from "@/lib/rappels-objectifs";

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

/** Les trois natures d'objectif proposées à l'utilisateur. */
const TYPES: Record<TypeObjectif, { label: string; aide: string; emoji: string }> = {
  epargne: {
    label: "Épargne",
    emoji: "🐖",
    aide: "Mettre de l'argent de côté, sans achat précis.",
  },
  achat: {
    label: "Achat programmé",
    emoji: "🛒",
    aide: "Un bien précis à acheter à une date donnée.",
  },
  tontine: {
    label: "Tontine",
    emoji: "🤝",
    aide: "Cotisation régulière dans un groupe, avec un tour de réception.",
  },
};

/** Unités de répétition proposées, au singulier et au pluriel. */
const UNITES: Record<UniteRappel, { un: string; plusieurs: string }> = {
  jour: { un: "jour", plusieurs: "jours" },
  semaine: { un: "semaine", plusieurs: "semaines" },
  mois: { un: "mois", plusieurs: "mois" },
  annee: { un: "an", plusieurs: "ans" },
};

/** Phrase lisible du rythme choisi : « tous les 15 jours ». */
function libelleRythme(intervalle: number, unite: UniteRappel): string {
  const n = Math.max(1, intervalle);
  if (n === 1) return unite === "annee" ? "chaque année" : `chaque ${UNITES[unite].un}`;
  return `tous les ${n} ${UNITES[unite].plusieurs}`;
}

/** Montant total reçu au tour et date estimée de réception d'une tontine. */
function calculerTontine(
  montantTour: number,
  participants: number,
  rang: number,
  debut: string,
  intervalle: number,
  unite: UniteRappel,
): { cible: number; dateCible: string } {
  const cible = Math.max(0, Math.round(montantTour * participants));
  const depart = debut ? new Date(`${debut}T00:00:00`) : new Date();
  const jours = joursRythme({ unite, intervalle }) * Math.max(0, rang - 1);
  const arrivee = new Date(depart.getTime() + jours * 86_400_000);
  return { cible, dateCible: arrivee.toISOString().slice(0, 10) };
}

function PageObjectifs() {
  const {
    objectifs,
    transactions,
    transferts,
    enveloppes,
    comptes,
    comptesExclus,
    ajouterObjectif,
    modifierObjectif,
    supprimerObjectif,
    definirCompteDisponible,
  } = useSuperApp();
  const [ouvert, setOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [type, setType] = useState<TypeObjectif>("epargne");
  const [libelle, setLibelle] = useState("");
  const [cible, setCible] = useState("");
  const [deja, setDeja] = useState("");
  const [dateCible, setDateCible] = useState("");
  const [enveloppeId, setEnveloppeId] = useState("");
  const [compteSource, setCompteSource] = useState("");
  const [compteEpargne, setCompteEpargne] = useState("");
  const [prelevementAuto, setPrelevementAuto] = useState(true);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [ignores, setIgnores] = useState<string[]>([]);
  const [filtre, setFiltre] = useState<"tous" | TypeObjectif>("tous");
  // Paramètres propres aux tontines.
  const [tMontant, setTMontant] = useState("");

  const [tParticipants, setTParticipants] = useState("");
  const [tRang, setTRang] = useState("");
  const [tDebut, setTDebut] = useState("");
  const [tOrganisateur, setTOrganisateur] = useState("");
  // Rappel commun à tous les types d'objectifs.
  const [rappelActif, setRappelActif] = useState(true);
  const [rappelIntervalle, setRappelIntervalle] = useState("1");
  const [rappelUnite, setRappelUnite] = useState<UniteRappel>("mois");
  const [rappelDebut, setRappelDebut] = useState("");

  const suivis = useMemo(
    () => suivreObjectifs(objectifs, transactions, new Date(), transferts),
    [objectifs, transactions, transferts],
  );

  const visibles = useMemo(
    () => suivis.filter((s) => filtre === "tous" || (s.objectif.type ?? "epargne") === filtre),
    [suivis, filtre],
  );

  const ajustements = useMemo(
    () => proposerAjustements(suivis, transactions).filter((a) => !ignores.includes(a.objectif.id)),
    [suivis, transactions, ignores],
  );

  /** Aperçu du pot et de la date de réception pendant la saisie d'une tontine. */
  const apercuTontine = useMemo(() => {
    const montant = Number(tMontant.replace(/\s/g, ""));
    const participants = Number(tParticipants.replace(/\s/g, ""));
    const rang = Number(tRang.replace(/\s/g, ""));
    if (!montant || !participants || !rang || !tDebut) return null;
    return calculerTontine(
      montant,
      participants,
      rang,
      tDebut,
      Number(rappelIntervalle) || 1,
      rappelUnite,
    );
  }, [tMontant, tParticipants, tRang, tDebut, rappelIntervalle, rappelUnite]);

  const reinitialiser = () => {
    setEnEdition(null);
    setType("epargne");
    setLibelle("");
    setCible("");
    setDeja("");
    setDateCible("");
    setEnveloppeId("");
    setCompteSource("");
    setCompteEpargne("");
    setPrelevementAuto(true);
    setTMontant("");
    setTParticipants("");
    setTRang("");
    setTDebut("");
    setTOrganisateur("");
    setRappelActif(true);
    setRappelIntervalle("1");
    setRappelUnite("mois");
    setRappelDebut("");
    setOuvert(false);
  };

  /** Ouvre le formulaire pré-rempli pour ajuster un objectif existant. */
  const modifier = (o: Objectif) => {
    setEnEdition(o.id);
    setType(o.type ?? "epargne");
    setLibelle(o.libelle);
    setCible(String(o.cible));
    setDeja(String(o.deja));
    setDateCible(o.dateCible);
    setEnveloppeId(o.enveloppeId ?? "");
    setCompteSource(o.compteSource ?? "");
    setCompteEpargne(o.compteEpargne ?? "");
    setPrelevementAuto(o.prelevementAuto ?? false);
    setTMontant(o.tontineMontantTour ? String(o.tontineMontantTour) : "");
    setTParticipants(o.tontineParticipants ? String(o.tontineParticipants) : "");
    setTRang(o.tontineRang ? String(o.tontineRang) : "");
    setTDebut(o.tontineDebut ?? "");
    setTOrganisateur(o.tontineOrganisateur ?? "");
    const rythme = rythmeObjectif(o);
    setRappelActif(o.rappelActif !== false && rythme !== null);
    setRappelIntervalle(String(rythme?.intervalle ?? 1));
    setRappelUnite(rythme?.unite ?? "mois");
    setRappelDebut(o.rappelDebut ?? o.tontineDebut ?? "");
    setOuvert(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const enregistrer = () => {
    if (!libelle.trim()) {
      toast.error("Donnez un nom à votre objectif.");
      return;
    }

    let montant = Number(cible.replace(/\s/g, ""));
    let echeance = dateCible;
    let infosTontine: Partial<Objectif> = {};

    if (type === "tontine") {
      const montantTour = Number(tMontant.replace(/\s/g, ""));
      const participants = Number(tParticipants.replace(/\s/g, ""));
      const rang = Number(tRang.replace(/\s/g, ""));
      if (!montantTour || montantTour <= 0) {
        toast.error("Indiquez le montant d'une cotisation.");
        return;
      }
      if (!participants || participants < 2) {
        toast.error("Indiquez le nombre de participants (au moins 2).");
        return;
      }
      if (!rang || rang < 1 || rang > participants) {
        toast.error(
          "Votre rang de passage doit être compris entre 1 et le nombre de participants.",
        );
        return;
      }
      if (!tDebut) {
        toast.error("Indiquez la date de la première cotisation.");
        return;
      }
      const calcul = calculerTontine(
        montantTour,
        participants,
        rang,
        tDebut,
        Number(rappelIntervalle) || 1,
        rappelUnite,
      );
      montant = calcul.cible;
      echeance = calcul.dateCible;
      infosTontine = {
        tontineMontantTour: montantTour,
        tontineParticipants: participants,
        tontineRang: rang,
        tontineDebut: tDebut,
        tontineOrganisateur: tOrganisateur.trim() || undefined,
      };
    } else {
      if (!Number.isFinite(montant) || montant <= 0) {
        toast.error("Montant visé invalide.");
        return;
      }
      if (!echeance) {
        toast.error("Choisissez une date à atteindre.");
        return;
      }
      if (echeance <= new Date().toISOString().slice(0, 10)) {
        toast.error("La date visée doit être dans le futur.");
        return;
      }
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
    const donnees = {
      libelle: libelle.trim(),
      type,
      cible: montant,
      deja: Number(deja.replace(/\s/g, "")) || 0,
      dateCible: echeance,
      enveloppeId: enveloppeId || undefined,
      compteSource: prelevementAuto ? compteSource : undefined,
      compteEpargne: prelevementAuto ? compteEpargne : undefined,
      prelevementAuto,
      rappelActif: rappelActif ? undefined : false,
      rappelUnite: rappelActif ? rappelUnite : undefined,
      rappelIntervalle: rappelActif
        ? Math.min(31, Math.max(1, Number(rappelIntervalle) || 1))
        : undefined,
      rappelDebut: rappelActif
        ? type === "tontine"
          ? tDebut
          : rappelDebut || undefined
        : undefined,
      rappelFrequence: undefined,
      tontineMontantTour: undefined,
      tontineFrequence: undefined,
      tontineParticipants: undefined,
      tontineRang: undefined,
      tontineDebut: undefined,
      tontineOrganisateur: undefined,
      ...infosTontine,
    };
    if (enEdition) {
      modifierObjectif(enEdition, donnees);
      toast.success("Objectif ajusté.");
    } else {
      ajouterObjectif(donnees);
      toast.success(
        prelevementAuto
          ? "Objectif créé : le prélèvement démarre aussitôt."
          : `${TYPES[type].label} enregistrée.`,
      );
    }
    reinitialiser();
  };

  return (
    <div className="space-y-4 pt-4">
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
        onClick={() => {
          setEnEdition(null);
          setOuvert(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nouvel objectif
      </button>

      {ajustements.length > 0 && (
        <section className="space-y-2">
          {ajustements.map((a) => (
            <div
              key={a.objectif.id}
              className="carte space-y-2 border-warning/40 p-4"
              role="status"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold text-warning">
                <Lightbulb className="h-4 w-4" aria-hidden />
                Ajustement suggéré — {a.objectif.libelle}
              </h2>
              <p className="text-xs text-muted-foreground">{a.message}</p>
              {a.dateProposee && (
                <p className="text-xs">
                  En épargnant {formatFCFA(a.effortTenable)}/mois, l'objectif serait atteint vers le{" "}
                  {a.dateProposee}.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {a.dateProposee && (
                  <button
                    type="button"
                    onClick={() => {
                      modifierObjectif(a.objectif.id, { dateCible: a.dateProposee! });
                      toast.success("Échéance repoussée à une date tenable.");
                    }}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Repousser l'échéance
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => modifier(a.objectif)}
                  className="rounded-xl border border-input px-3 py-2 text-xs font-medium"
                >
                  Modifier moi-même
                </button>
                <button
                  type="button"
                  onClick={() => setIgnores((v) => [...v, a.objectif.id])}
                  className="rounded-xl px-3 py-2 text-xs text-muted-foreground"
                >
                  Ignorer
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {ouvert && (
        <section className="carte space-y-3 p-4">
          <h2 className="text-sm font-semibold">
            {enEdition ? "Ajuster l'objectif" : "Créer un objectif"}
          </h2>

          <div>
            <p className="text-xs font-medium text-muted-foreground">De quoi s'agit-il ?</p>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(Object.keys(TYPES) as TypeObjectif[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                    type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-card text-muted-foreground"
                  }`}
                >
                  <span aria-hidden>{TYPES[t].emoji}</span> {TYPES[t].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{TYPES[type].aide}</p>
          </div>

          <label className="block text-xs font-medium text-muted-foreground">
            {type === "tontine" ? "Nom de la tontine" : "Nom de l'objectif"}
            <input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder={
                type === "tontine"
                  ? "Tontine du marché, groupe collègues…"
                  : type === "achat"
                    ? "Moto, téléphone, terrain…"
                    : "Voyage, scolarité, réserve…"
              }
              className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          {type === "tontine" ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-3">
              <p className="text-xs font-semibold">Paramètres de la tontine</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  Cotisation (FCFA)
                  <input
                    inputMode="numeric"
                    value={grouperMontant(tMontant)}
                    onChange={(e) => setTMontant(deGrouperMontant(e.target.value))}
                    placeholder="10000"
                    className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </label>
                <p className="self-end text-xs text-muted-foreground">
                  Rythme des cotisations :{" "}
                  {libelleRythme(Number(rappelIntervalle) || 1, rappelUnite)} (réglable plus bas).
                </p>
                <label className="block text-xs font-medium text-muted-foreground">
                  Participants
                  <input
                    inputMode="numeric"
                    value={tParticipants}
                    onChange={(e) => setTParticipants(e.target.value.replace(/\D/g, ""))}
                    placeholder="12"
                    className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  Mon rang de passage
                  <input
                    inputMode="numeric"
                    value={tRang}
                    onChange={(e) => setTRang(e.target.value.replace(/\D/g, ""))}
                    placeholder="3"
                    className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-muted-foreground">
                Première cotisation
                <input
                  type="date"
                  value={tDebut}
                  onChange={(e) => setTDebut(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Organisateur / groupe (facultatif)
                <input
                  value={tOrganisateur}
                  onChange={(e) => setTOrganisateur(e.target.value)}
                  placeholder="Mama Adjo, groupe du quartier…"
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              {apercuTontine && (
                <p className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
                  Vous recevrez environ {formatFCFA(apercuTontine.cible)} vers le{" "}
                  {apercuTontine.dateCible}.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  {type === "achat" ? "Prix de l'achat (FCFA)" : "Montant visé (FCFA)"}
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
                {type === "achat" ? "Date d'achat souhaitée" : "Date à atteindre"}
                <input
                  type="date"
                  value={dateCible}
                  onChange={(e) => setDateCible(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            </>
          )}

          {/* Alarme de rappel : proposée pour tous les objectifs. */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-3">
            <label className="flex items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={rappelActif}
                onChange={(e) => setRappelActif(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <span>
                Me rappeler par une alarme
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Le téléphone sonne au rythme choisi et vous confirmez d'un geste si le versement a
                  été fait.
                </span>
              </span>
            </label>

            {rappelActif && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Répéter tous les
                    <select
                      value={rappelIntervalle}
                      onChange={(e) => setRappelIntervalle(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={String(n)}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Unité
                    <select
                      value={rappelUnite}
                      onChange={(e) => setRappelUnite(e.target.value as UniteRappel)}
                      className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      {(Object.keys(UNITES) as UniteRappel[]).map((u) => (
                        <option key={u} value={u}>
                          {(Number(rappelIntervalle) || 1) > 1 ? UNITES[u].plusieurs : UNITES[u].un}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {type !== "tontine" && (
                  <label className="block text-xs font-medium text-muted-foreground">
                    Premier rappel (facultatif)
                    <input
                      type="date"
                      value={rappelDebut}
                      onChange={(e) => setRappelDebut(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>
                )}
                <p className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
                  Rappel {libelleRythme(Number(rappelIntervalle) || 1, rappelUnite)}
                  {type === "tontine"
                    ? tDebut
                      ? `, à partir du ${tDebut}.`
                      : ", à partir de la première cotisation."
                    : rappelDebut
                      ? `, à partir du ${rappelDebut}.`
                      : ", à partir d'aujourd'hui."}
                </p>
              </>
            )}
          </div>
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
              onClick={reinitialiser}
              className="flex-1 rounded-xl border border-input bg-card px-4 py-2 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {enEdition ? "Enregistrer les changements" : "Enregistrer"}
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {suivis.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(["tous", "epargne", "achat", "tontine"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtre === f}
                onClick={() => setFiltre(f)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  filtre === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-card text-muted-foreground"
                }`}
              >
                {f === "tous"
                  ? `Tous (${suivis.length})`
                  : `${TYPES[f].label} (${suivis.filter((s) => (s.objectif.type ?? "epargne") === f).length})`}
              </button>
            ))}
          </div>
        )}

        {suivis.length === 0 && !ouvert && (
          <div className="carte flex flex-col items-center gap-2 p-8 text-center">
            <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucun objectif pour le moment. Créez une épargne, un achat programmé ou une tontine.
            </p>
          </div>
        )}

        {suivis.length > 0 && visibles.length === 0 && (
          <p className="carte p-4 text-center text-sm text-muted-foreground">
            Aucun élément de ce type pour le moment.
          </p>
        )}

        {visibles.map((s) => (
          <article key={s.objectif.id} className="carte space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-semibold">{s.objectif.libelle}</h2>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {TYPES[s.objectif.type ?? "epargne"].label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatFCFA(s.reuni)} sur {formatFCFA(s.objectif.cible)} ·{" "}
                  {s.objectif.type === "tontine" ? "réception prévue" : "échéance"}{" "}
                  {s.objectif.dateCible}
                </p>
                {s.objectif.type === "tontine" && s.objectif.tontineMontantTour && (
                  <p className="text-xs text-muted-foreground">
                    {formatFCFA(s.objectif.tontineMontantTour)} · rang {s.objectif.tontineRang ?? 1}
                    /{s.objectif.tontineParticipants ?? 1}
                    {s.objectif.tontineOrganisateur ? ` · ${s.objectif.tontineOrganisateur}` : ""}
                  </p>
                )}
                {(() => {
                  const r = rythmeObjectif(s.objectif);
                  return r ? (
                    <p className="text-xs text-primary">
                      🔔 Rappel {libelleRythme(r.intervalle, r.unite)}
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => modifier(s.objectif)}
                  aria-label={`Modifier l'objectif ${s.objectif.libelle}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setASupprimer(s.objectif.id)}
                  aria-label={`Supprimer l'objectif ${s.objectif.libelle}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
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
