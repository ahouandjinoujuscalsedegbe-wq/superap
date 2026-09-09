import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

import { useSuperApp, type Objectif, type TypeObjectif, type UniteRappel } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import { joursRythme } from "@/lib/rappels-objectifs";
import { libelleRythme } from "@/components/FormulaireObjectif";

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

const UNITES: Record<UniteRappel, { un: string; plusieurs: string }> = {
  jour: { un: "jour", plusieurs: "jours" },
  semaine: { un: "semaine", plusieurs: "semaines" },
  mois: { un: "mois", plusieurs: "mois" },
  annee: { un: "an", plusieurs: "ans" },
};

const ETAPES = ["Nature", "Détails", "Rappels", "Épargne", "Résumé"] as const;

const champ =
  "mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

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
 * Assistant pas à pas de création d'un objectif : l'utilisateur répond aux
 * questions étape par étape, puis relit un résumé complet avant d'enregistrer.
 */
export function AssistantObjectif({ onTermine }: { onTermine: () => void }) {
  const { enveloppes, comptes, comptesExclus, ajouterObjectif, definirCompteDisponible } =
    useSuperApp();

  const [etape, setEtape] = useState(0);
  const [type, setType] = useState<TypeObjectif>("epargne");
  const [libelle, setLibelle] = useState("");
  const [cible, setCible] = useState("");
  const [deja, setDeja] = useState("");
  const [dateCible, setDateCible] = useState("");
  const [enveloppeId, setEnveloppeId] = useState("");
  const [compteSource, setCompteSource] = useState("");
  const [compteEpargne, setCompteEpargne] = useState("");
  const [prelevementAuto, setPrelevementAuto] = useState(true);
  const [tMontant, setTMontant] = useState("");
  const [tParticipants, setTParticipants] = useState("");
  const [tRang, setTRang] = useState("");
  const [tDebut, setTDebut] = useState("");
  const [tOrganisateur, setTOrganisateur] = useState("");
  const [rappelActif, setRappelActif] = useState(true);
  const [rappelIntervalle, setRappelIntervalle] = useState("1");
  const [rappelUnite, setRappelUnite] = useState<UniteRappel>("mois");
  const [rappelDebut, setRappelDebut] = useState("");

  const apercuTontine = useMemo(() => {
    const montant = Number(deGrouperMontant(tMontant));
    const participants = Number(tParticipants);
    const rang = Number(tRang);
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

  /** Montant visé et échéance finalement retenus (calculés pour une tontine). */
  const resultat = useMemo(() => {
    if (type === "tontine") {
      return apercuTontine ?? { cible: 0, dateCible: "" };
    }
    return { cible: Number(deGrouperMontant(cible)) || 0, dateCible };
  }, [type, apercuTontine, cible, dateCible]);

  /** Vérifie les réponses de l'étape en cours avant de passer à la suivante. */
  const etapeValide = (): boolean => {
    if (etape === 0) {
      if (!libelle.trim()) {
        toast.error("Donnez un nom à votre objectif.");
        return false;
      }
      return true;
    }
    if (etape === 1) {
      if (type === "tontine") {
        const montantTour = Number(deGrouperMontant(tMontant));
        const participants = Number(tParticipants);
        const rang = Number(tRang);
        if (!montantTour || montantTour <= 0) {
          toast.error("Indiquez le montant d'une cotisation.");
          return false;
        }
        if (!participants || participants < 2) {
          toast.error("Indiquez le nombre de participants (au moins 2).");
          return false;
        }
        if (!rang || rang < 1 || rang > participants) {
          toast.error("Votre rang doit être compris entre 1 et le nombre de participants.");
          return false;
        }
        if (!tDebut) {
          toast.error("Indiquez la date de la première cotisation.");
          return false;
        }
        return true;
      }
      const montant = Number(deGrouperMontant(cible));
      if (!Number.isFinite(montant) || montant <= 0) {
        toast.error("Montant visé invalide.");
        return false;
      }
      if (!dateCible) {
        toast.error("Choisissez une date à atteindre.");
        return false;
      }
      if (dateCible <= new Date().toISOString().slice(0, 10)) {
        toast.error("La date visée doit être dans le futur.");
        return false;
      }
      return true;
    }
    if (etape === 3 && prelevementAuto) {
      if (!compteSource || !compteEpargne) {
        toast.error("Choisissez le compte à débiter et le compte d'épargne.");
        return false;
      }
      if (compteSource === compteEpargne) {
        toast.error("Le compte d'épargne doit être différent du compte débité.");
        return false;
      }
    }
    return true;
  };

  const suivant = () => {
    if (!etapeValide()) return;
    setEtape((e) => Math.min(ETAPES.length - 1, e + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const precedent = () => {
    if (etape === 0) {
      onTermine();
      return;
    }
    setEtape((e) => e - 1);
  };

  const enregistrer = () => {
    if (!etapeValide()) return;
    if (prelevementAuto && !comptesExclus.includes(compteEpargne)) {
      definirCompteDisponible(compteEpargne, false);
    }
    const infosTontine: Partial<Objectif> =
      type === "tontine"
        ? {
            tontineMontantTour: Number(deGrouperMontant(tMontant)),
            tontineParticipants: Number(tParticipants),
            tontineRang: Number(tRang),
            tontineDebut: tDebut,
            tontineOrganisateur: tOrganisateur.trim() || undefined,
          }
        : {};

    ajouterObjectif({
      libelle: libelle.trim(),
      type,
      cible: resultat.cible,
      deja: Number(deGrouperMontant(deja)) || 0,
      dateCible: resultat.dateCible,
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
      ...infosTontine,
    });
    toast.success("Objectif créé.");
    onTermine();
  };

  return (
    <section className="space-y-4">
      {/* Progression de l'assistant */}
      <ol className="flex items-center gap-1">
        {ETAPES.map((nom, i) => (
          <li key={nom} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${i <= etape ? "bg-primary" : "bg-muted"}`}
              aria-hidden
            />
            <span
              className={`mt-1 block text-[10px] ${
                i === etape ? "font-semibold text-primary" : "text-muted-foreground"
              }`}
            >
              {nom}
            </span>
          </li>
        ))}
      </ol>

      <div className="carte space-y-3 p-4">
        {etape === 0 && (
          <>
            <h2 className="text-sm font-semibold">De quoi s'agit-il ?</h2>
            <div className="grid grid-cols-3 gap-2">
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
            <p className="text-xs text-muted-foreground">{TYPES[type].aide}</p>
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
                className={champ}
              />
            </label>
          </>
        )}

        {etape === 1 && type === "tontine" && (
          <>
            <h2 className="text-sm font-semibold">Paramètres de la tontine</h2>
            <label className="block text-xs font-medium text-muted-foreground">
              Montant d'une cotisation (FCFA)
              <input
                inputMode="numeric"
                value={grouperMontant(tMontant)}
                onChange={(e) => setTMontant(deGrouperMontant(e.target.value))}
                placeholder="10 000"
                className={champ}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Nombre de participants
                <input
                  inputMode="numeric"
                  value={tParticipants}
                  onChange={(e) => setTParticipants(e.target.value.replace(/\D/g, ""))}
                  placeholder="12"
                  className={champ}
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Mon rang de passage
                <input
                  inputMode="numeric"
                  value={tRang}
                  onChange={(e) => setTRang(e.target.value.replace(/\D/g, ""))}
                  placeholder="3"
                  className={champ}
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-muted-foreground">
              Date de la première cotisation
              <input
                type="date"
                value={tDebut}
                onChange={(e) => setTDebut(e.target.value)}
                className={champ}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Organisateur ou groupe (facultatif)
              <input
                value={tOrganisateur}
                onChange={(e) => setTOrganisateur(e.target.value)}
                placeholder="Mama Adjo, groupe du quartier…"
                className={champ}
              />
            </label>
            {apercuTontine && (
              <p className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
                Vous recevrez environ {formatFCFA(apercuTontine.cible)} vers le{" "}
                {apercuTontine.dateCible}.
              </p>
            )}
          </>
        )}

        {etape === 1 && type !== "tontine" && (
          <>
            <h2 className="text-sm font-semibold">
              {type === "achat" ? "Détails de l'achat" : "Détails de l'épargne"}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-muted-foreground">
                {type === "achat" ? "Prix de l'achat (FCFA)" : "Montant visé (FCFA)"}
                <input
                  inputMode="numeric"
                  value={grouperMontant(cible)}
                  onChange={(e) => setCible(deGrouperMontant(e.target.value))}
                  placeholder="500 000"
                  className={champ}
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Déjà de côté (FCFA)
                <input
                  inputMode="numeric"
                  value={grouperMontant(deja)}
                  onChange={(e) => setDeja(deGrouperMontant(e.target.value))}
                  placeholder="0"
                  className={champ}
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-muted-foreground">
              {type === "achat" ? "Date d'achat souhaitée" : "Date à atteindre"}
              <input
                type="date"
                value={dateCible}
                onChange={(e) => setDateCible(e.target.value)}
                className={champ}
              />
            </label>
          </>
        )}

        {etape === 2 && (
          <>
            <h2 className="text-sm font-semibold">Rappels</h2>
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
                      className={champ}
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
                      className={champ}
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
                      className={champ}
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
          </>
        )}

        {etape === 3 && (
          <>
            <h2 className="text-sm font-semibold">Enveloppe et épargne automatique</h2>
            <label className="block text-xs font-medium text-muted-foreground">
              Enveloppe d'épargne associée (facultatif)
              <select
                value={enveloppeId}
                onChange={(e) => setEnveloppeId(e.target.value)}
                className={champ}
              >
                <option value="">Solde global (revenus − dépenses)</option>
                {enveloppes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.emoji} {e.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={prelevementAuto}
                onChange={(e) => setPrelevementAuto(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <span>
                Épargner automatiquement
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
                    className={champ}
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
                    className={champ}
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
          </>
        )}

        {etape === 4 && (
          <>
            <h2 className="text-sm font-semibold">Résumé avant enregistrement</h2>
            <dl className="space-y-1 text-xs">
              <Ligne t="Nature" v={TYPES[type].label} />
              <Ligne t="Nom" v={libelle || "—"} />
              <Ligne t="Montant visé" v={formatFCFA(resultat.cible)} />
              <Ligne t="Échéance" v={resultat.dateCible || "—"} />
              {type !== "tontine" && (
                <Ligne t="Déjà de côté" v={formatFCFA(Number(deGrouperMontant(deja)) || 0)} />
              )}
              {type === "tontine" && (
                <>
                  <Ligne t="Cotisation" v={formatFCFA(Number(deGrouperMontant(tMontant)) || 0)} />
                  <Ligne t="Participants" v={tParticipants || "—"} />
                  <Ligne t="Mon rang" v={tRang || "—"} />
                  <Ligne t="Première cotisation" v={tDebut || "—"} />
                  {tOrganisateur && <Ligne t="Organisateur" v={tOrganisateur} />}
                </>
              )}
              <Ligne
                t="Rappels"
                v={
                  rappelActif
                    ? libelleRythme(Number(rappelIntervalle) || 1, rappelUnite)
                    : "Désactivés"
                }
              />
              <Ligne
                t="Enveloppe"
                v={enveloppes.find((e) => e.id === enveloppeId)?.nom ?? "Solde global"}
              />
              <Ligne
                t="Épargne automatique"
                v={prelevementAuto ? `${compteSource} → ${compteEpargne}` : "Non"}
              />
            </dl>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={precedent}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-input bg-card px-4 py-2 text-sm font-medium"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {etape === 0 ? "Annuler" : "Précédent"}
        </button>
        {etape < ETAPES.length - 1 ? (
          <button
            type="button"
            onClick={suivant}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Continuer <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={enregistrer}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Check className="h-4 w-4" aria-hidden /> Enregistrer
          </button>
        )}
      </div>
    </section>
  );
}

/** Une ligne du résumé final. */
function Ligne({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-1">
      <dt className="text-muted-foreground">{t}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
