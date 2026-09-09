import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useSuperApp, type Objectif, type TypeObjectif, type UniteRappel } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import { joursRythme, rythmeObjectif } from "@/lib/rappels-objectifs";

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
export function libelleRythme(intervalle: number, unite: UniteRappel): string {
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

/**
 * Formulaire unique de création et d'ajustement d'un objectif.
 * Accessible uniquement depuis le bouton « Action » de la page Objectifs.
 */
export function FormulaireObjectif({
  objectif,
  onTermine,
}: {
  objectif?: Objectif | null;
  onTermine: () => void;
}) {
  const {
    enveloppes,
    comptes,
    comptesExclus,
    ajouterObjectif,
    modifierObjectif,
    definirCompteDisponible,
  } = useSuperApp();

  const enEdition = objectif?.id ?? null;
  const [type, setType] = useState<TypeObjectif>(objectif?.type ?? "epargne");
  const [libelle, setLibelle] = useState(objectif?.libelle ?? "");
  const [cible, setCible] = useState(objectif ? String(objectif.cible) : "");
  const [deja, setDeja] = useState(objectif ? String(objectif.deja) : "");
  const [dateCible, setDateCible] = useState(objectif?.dateCible ?? "");
  const [enveloppeId, setEnveloppeId] = useState(objectif?.enveloppeId ?? "");
  const [compteSource, setCompteSource] = useState(objectif?.compteSource ?? "");
  const [compteEpargne, setCompteEpargne] = useState(objectif?.compteEpargne ?? "");
  const [prelevementAuto, setPrelevementAuto] = useState(objectif?.prelevementAuto ?? true);
  // Paramètres propres aux tontines.
  const [tMontant, setTMontant] = useState(
    objectif?.tontineMontantTour ? String(objectif.tontineMontantTour) : "",
  );
  const [tParticipants, setTParticipants] = useState(
    objectif?.tontineParticipants ? String(objectif.tontineParticipants) : "",
  );
  const [tRang, setTRang] = useState(objectif?.tontineRang ? String(objectif.tontineRang) : "");
  const [tDebut, setTDebut] = useState(objectif?.tontineDebut ?? "");
  const [tOrganisateur, setTOrganisateur] = useState(objectif?.tontineOrganisateur ?? "");
  // Rappel commun à tous les types d'objectifs.
  const rythmeInitial = objectif ? rythmeObjectif(objectif) : null;
  const [rappelActif, setRappelActif] = useState(
    objectif ? objectif.rappelActif !== false && rythmeInitial !== null : true,
  );
  const [rappelIntervalle, setRappelIntervalle] = useState(
    String(rythmeInitial?.intervalle ?? 1),
  );
  const [rappelUnite, setRappelUnite] = useState<UniteRappel>(rythmeInitial?.unite ?? "mois");
  const [rappelDebut, setRappelDebut] = useState(
    objectif?.rappelDebut ?? objectif?.tontineDebut ?? "",
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
    onTermine();
  };

  return (
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
              Rythme des cotisations : {libelleRythme(Number(rappelIntervalle) || 1, rappelUnite)}{" "}
              (réglable plus bas).
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
          onClick={onTermine}
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
  );
}
