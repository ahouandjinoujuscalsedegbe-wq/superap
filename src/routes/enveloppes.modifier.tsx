import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { PERIODES, useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { DicteeChamp } from "@/components/DicteeChamp";
import { analyserEnveloppeDictee } from "@/lib/dictee-champs";
import { grouperParCategorie } from "@/lib/categories";
import { etatEnveloppe } from "@/lib/enveloppe-etat";
import { CarteEnveloppe } from "./enveloppes.details";

export const Route = createFileRoute("/enveloppes/modifier")({
  head: () => ({
    meta: [
      { title: "Modifier une enveloppe — SUPER APP" },
      {
        name: "description",
        content:
          "Page dédiée à la modification et à la suppression des enveloppes budgétaires du foyer, avec confirmation avant chaque action.",
      },
      { property: "og:title", content: "Modifier une enveloppe — SUPER APP" },
      {
        property: "og:description",
        content:
          "Modifiez le nom, l'emoji et le plafond de vos enveloppes en FCFA, ou supprimez-les après confirmation.",
      },
    ],
  }),
  component: ModifierEnveloppe,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

type Demande =
  | {
      type: "modification";
      id: string;
      nom: string;
      emoji: string;
      plafond: number;
      dotation: number;
      categorie: string;
      sousCategorie: string;
      compteSource: string;
      periodeRenouvellement: Periode;
      dateRenouvellement: string;
      modeRemplissage: "fixe" | "pourcentage";
      pourcentageRevenu: number;
      montantPeriode: number;
      ajustementAuto: boolean;
    }
  | { type: "suppression"; id: string; nom: string }
  | null;

function ModifierEnveloppe() {
  const {
    enveloppes,
    categories: listeCategories,
    depensesParEnveloppe,
    modifierEnveloppe,
    supprimerEnveloppe,
    comptes,
  } = useSuperApp();

  // Processus dédié : la modification se fait dans une fenêtre pop-up guidée.
  const [edition, setEdition] = useState<string | null>(null);
  const [eNom, setENom] = useState("");
  const [eEmoji, setEEmoji] = useState("");
  const [ePlafond, setEPlafond] = useState("");
  const [eDotation, setEDotation] = useState("");
  const [eCategorie, setECategorie] = useState("");
  const [eSousCategorie, setESousCategorie] = useState("");
  const [eCompte, setECompte] = useState("");
  const [ePeriode, setEPeriode] = useState<Periode>("mois");
  const [eDateRenouv, setEDateRenouv] = useState("");
  const [eMode, setEMode] = useState<"fixe" | "pourcentage">("fixe");
  const [ePart, setEPart] = useState("");
  const [eMontantPeriode, setEMontantPeriode] = useState("");
  const [eAjustement, setEAjustement] = useState(true);

  const [demande, setDemande] = useState<Demande>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [operations, setOperations] = useState<string | null>(null);

  const categorieChoisie = listeCategories.find((c) => c.nom === eCategorie.trim());
  const sousCategories = categorieChoisie?.sousCategories ?? [];
  const groupes = grouperParCategorie(enveloppes);
  const enveloppeEditee = enveloppes.find((x) => x.id === edition);

  function ouvrirProcess(id: string) {
    const e = enveloppes.find((x) => x.id === id);
    if (!e) return;
    setEdition(id);
    setENom(e.nom);
    setEEmoji(e.emoji);
    setEPlafond(String(e.plafond));
    setEDotation(String(e.dotation ?? e.plafond));
    setECategorie(e.categorie ?? "");
    setESousCategorie(e.sousCategorie ?? "");
    setECompte(e.compteSource ?? "");
    setEPeriode(e.periodeRenouvellement ?? "mois");
    setEDateRenouv(e.dateRenouvellement ? e.dateRenouvellement.slice(0, 10) : "");
    setEMode(e.modeRemplissage ?? "fixe");
    setEPart(e.pourcentageRevenu ? String(e.pourcentageRevenu) : "");
    setEMontantPeriode(String(e.montantPeriode ?? e.dotation ?? e.plafond));
    setEAjustement(e.ajustementAuto ?? true);
  }

  function fermerProcess() {
    setEdition(null);
  }

  function demanderModification(id: string) {
    const valeur = Number(ePlafond);
    if (!eNom.trim()) {
      setErreur("Le nom de l'enveloppe ne peut pas être vide.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      setErreur("Le plafond saisi est invalide : indiquez un montant en FCFA.");
      return;
    }
    const somme = Number(eDotation);
    if (!Number.isFinite(somme) || somme <= 0) {
      setErreur("La somme attribuée est invalide : indiquez le montant placé dans l'enveloppe.");
      return;
    }
    if (somme < valeur) {
      setErreur(
        "Le plafond ne peut pas dépasser la somme attribuée à l'enveloppe : le plafond est le montant de dépenses à ne pas dépasser.",
      );
      return;
    }
    if (!eCategorie.trim()) {
      setErreur("La catégorie est obligatoire : choisissez-en une dans la liste déroulante.");
      return;
    }
    if (!categorieChoisie) {
      setErreur(
        `La catégorie « ${eCategorie.trim()} » n'existe pas. Choisissez une catégorie de la liste ou créez-la depuis « Gérer les catégories et sous-catégories ».`,
      );
      return;
    }
    if (sousCategories.length > 0 && !eSousCategorie.trim()) {
      setErreur("Cette catégorie possède des sous-catégories : choisissez-en une.");
      return;
    }
    if (eSousCategorie.trim() && !sousCategories.includes(eSousCategorie.trim())) {
      setErreur(
        `La sous-catégorie « ${eSousCategorie.trim()} » n'existe pas dans la catégorie « ${eCategorie.trim()} ». Reprenez votre choix.`,
      );
      return;
    }
    if (!eCompte.trim()) {
      setErreur("Choisissez le compte qui alimente cette enveloppe.");
      return;
    }
    const part = Number(ePart);
    if (eMode === "pourcentage" && (!Number.isFinite(part) || part <= 0 || part > 100)) {
      setErreur("Indiquez la part de chaque revenu à verser (1 à 100 %).");
      return;
    }
    const parPeriode = Number(eMontantPeriode);
    if (eMode === "fixe" && (!Number.isFinite(parPeriode) || parPeriode <= 0)) {
      setErreur("Indiquez le montant versé à chaque période.");
      return;
    }
    setDemande({
      type: "modification",
      id,
      nom: eNom.trim(),
      emoji: eEmoji.trim() || "💡",
      plafond: valeur,
      dotation: somme,
      categorie: eCategorie.trim(),
      sousCategorie: eSousCategorie.trim(),
      compteSource: eCompte.trim(),
      periodeRenouvellement: ePeriode,
      dateRenouvellement: eMode === "fixe" ? eDateRenouv : "",
      modeRemplissage: eMode,
      pourcentageRevenu: eMode === "pourcentage" ? part : 0,
      montantPeriode: eMode === "fixe" ? parPeriode : 0,
      ajustementAuto: eAjustement,
    });
  }

  function demanderSuppression(id: string) {
    const e = enveloppes.find((x) => x.id === id);
    if (!e) return;
    setDemande({ type: "suppression", id, nom: e.nom });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "modification") {
      modifierEnveloppe(demande.id, {
        nom: demande.nom,
        emoji: demande.emoji,
        plafond: demande.plafond,
        dotation: demande.dotation,
        categorie: demande.categorie,
        sousCategorie: demande.sousCategorie,
        compteSource: demande.compteSource,
        periodeRenouvellement: demande.periodeRenouvellement,
        dateRenouvellement: demande.dateRenouvellement,
        modeRemplissage: demande.modeRemplissage,
        pourcentageRevenu: demande.pourcentageRevenu,
        montantPeriode: demande.montantPeriode,
        ajustementAuto: demande.ajustementAuto,
      });
      setEdition(null);
      toast.success("Enveloppe modifiée.");
    } else {
      supprimerEnveloppe(demande.id);
      if (edition === demande.id) setEdition(null);
      toast.success("Enveloppe supprimée.");
    }
    setDemande(null);
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour à Action" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Modifier une enveloppe existante</h1>
        <p className="text-sm text-muted-foreground">
          {enveloppes.length} enveloppe{enveloppes.length > 1 ? "s" : ""} · la modification se fait
          dans une fenêtre dédiée, puis une confirmation est demandée.
        </p>
      </header>

      {enveloppes.length === 0 ? (
        <p className="carte p-4 text-sm text-muted-foreground">Aucune enveloppe à modifier.</p>
      ) : (
        <div className="space-y-5">
          {groupes.map((g) => (
            <section key={g.categorie} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
                {g.categorie}
              </h2>
              {g.sousCategories.map((s) => (
                <div key={s.sousCategorie} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.sousCategorie}
                  </p>
                  <ul className="space-y-3">
                    {s.enveloppes.map((e) => (
                      <li key={e.id} className="carte p-4">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setDetail(detail === e.id ? null : e.id)}
                            aria-expanded={detail === e.id}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <ChevronDown
                              aria-hidden
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                                detail === e.id ? "rotate-180" : ""
                              }`}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                <span aria-hidden>{e.emoji}</span> {e.nom}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatFCFA(
                                  etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0).restant,
                                )}{" "}
                                restants · plafond {formatFCFA(e.plafond)}
                              </span>
                            </span>
                          </button>
                          <span className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => ouvrirProcess(e.id)}
                              aria-label="Modifier"
                              title="Modifier"
                              className="flex items-center justify-center rounded-lg border border-input p-2 text-xs font-medium"
                            >
                              <Pencil aria-hidden className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => demanderSuppression(e.id)}
                              aria-label="Supprimer"
                              title="Supprimer"
                              className="flex items-center justify-center rounded-lg border border-input p-2 text-xs font-medium text-destructive"
                            >
                              <Trash2 aria-hidden className="h-4 w-4" />
                            </button>
                          </span>
                        </div>

                        {detail === e.id && (
                          <div className="mt-3 border-t border-border/70 pt-3">
                            <CarteEnveloppe
                              e={e}
                              estOuverte={operations === e.id}
                              onToggle={() => setOperations(operations === e.id ? null : e.id)}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {enveloppeEditee && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Modifier l'enveloppe"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={fermerProcess}
        >
          <div
            className="carte max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <header>
              <h2 className="text-lg font-semibold">Modifier l'enveloppe</h2>
              <p className="text-sm text-muted-foreground">
                <span aria-hidden>{enveloppeEditee.emoji}</span> {enveloppeEditee.nom} — répondez à
                chaque question, puis validez la confirmation.
              </p>
            </header>

            <DicteeChamp
              titre="Dicter les nouvelles valeurs"
              exemple="transport avec 30000 francs, plafond 25000"
              onTexte={(texte) => {
                const lu = analyserEnveloppeDictee(texte);
                if (lu.nom) setENom(lu.nom);
                if (lu.dotation !== null) setEDotation(String(lu.dotation));
                if (lu.plafond !== null) setEPlafond(String(lu.plafond));
                if (!lu.nom && lu.dotation === null && lu.plafond === null) {
                  toast.warning(`« ${texte} » : rien compris, complétez à la main.`);
                } else {
                  toast.success("Champs remplis par la dictée.");
                }
              }}
            />

            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-20">
                  <label htmlFor="edit-emoji" className="text-sm font-medium">
                    Emoji
                  </label>
                  <input
                    id="edit-emoji"
                    value={eEmoji}
                    onChange={(ev) => setEEmoji(ev.target.value)}
                    className={champ}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="edit-nom" className="text-sm font-medium">
                    Quel est le nom de l'enveloppe ?
                  </label>
                  <input
                    id="edit-nom"
                    value={eNom}
                    onChange={(ev) => setENom(ev.target.value)}
                    className={champ}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-plafond" className="text-sm font-medium">
                  Quel est le plafond de cette enveloppe ? (FCFA)
                </label>
                <input
                  id="edit-plafond"
                  inputMode="numeric"
                  value={ePlafond}
                  onChange={(ev) => setEPlafond(ev.target.value.replace(/[^\d]/g, ""))}
                  className={champ}
                />
              </div>

              <div>
                <label htmlFor="edit-dotation" className="text-sm font-medium">
                  Quelle somme est attribuée à cette enveloppe ? (FCFA)
                </label>
                <input
                  id="edit-dotation"
                  inputMode="numeric"
                  value={eDotation}
                  onChange={(ev) => setEDotation(ev.target.value.replace(/[^\d]/g, ""))}
                  className={champ}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Cette somme diminue à chaque dépense. Au-delà du plafond, vous puisez dans la
                  réserve.
                </p>
              </div>

              <div>
                <label htmlFor="edit-categorie" className="text-sm font-medium">
                  Dans quelle catégorie classer cette enveloppe ? (obligatoire)
                </label>
                <select
                  id="edit-categorie"
                  value={eCategorie}
                  onChange={(ev) => {
                    const valeur = ev.target.value;
                    if (valeur && !listeCategories.some((c) => c.nom === valeur)) {
                      setErreur(
                        `La catégorie « ${valeur} » n'existe pas dans la liste. Choisissez une catégorie proposée ou créez-la depuis « Gérer les catégories et sous-catégories ».`,
                      );
                      return;
                    }
                    setECategorie(valeur);
                    setESousCategorie("");
                  }}
                  className={champ}
                >
                  <option value="">Choisir une catégorie…</option>
                  {listeCategories.map((c) => (
                    <option key={c.id} value={c.nom}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-sous-categorie" className="text-sm font-medium">
                  Quelle sous-catégorie ?{sousCategories.length > 0 ? " (obligatoire)" : ""}
                </label>
                <select
                  id="edit-sous-categorie"
                  value={eSousCategorie}
                  onChange={(ev) => {
                    const valeur = ev.target.value;
                    if (valeur && !sousCategories.includes(valeur)) {
                      setErreur(
                        `La sous-catégorie « ${valeur} » n'existe pas dans la catégorie « ${eCategorie.trim()} ». Choisissez une sous-catégorie proposée dans la liste.`,
                      );
                      return;
                    }
                    setESousCategorie(valeur);
                  }}
                  disabled={!categorieChoisie || sousCategories.length === 0}
                  className={champ}
                >
                  <option value="">
                    {sousCategories.length === 0 ? "Général" : "Choisir une sous-catégorie…"}
                  </option>
                  {sousCategories.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 rounded-xl border border-input p-3">
                <p className="text-sm font-medium">Renouvellement automatique</p>

                <label htmlFor="edit-compte" className="text-xs text-muted-foreground">
                  Compte qui alimente l'enveloppe
                </label>
                <select
                  id="edit-compte"
                  value={eCompte}
                  onChange={(ev) => setECompte(ev.target.value)}
                  className={champ}
                >
                  <option value="">Choisir un compte…</option>
                  {comptes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <label htmlFor="edit-periode" className="text-xs text-muted-foreground">
                  Période de renouvellement
                </label>
                <select
                  id="edit-periode"
                  value={ePeriode}
                  onChange={(ev) => setEPeriode(ev.target.value as Periode)}
                  className={champ}
                >
                  {PERIODES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                {eMode === "fixe" && (
                  <>
                    <label htmlFor="edit-date-renouv" className="text-xs text-muted-foreground">
                      Date du prochain renouvellement automatique
                    </label>
                    <input
                      id="edit-date-renouv"
                      type="date"
                      value={eDateRenouv}
                      onChange={(ev) => setEDateRenouv(ev.target.value)}
                      className={champ}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sans date, aucun renouvellement automatique n'est effectué.
                    </p>
                  </>
                )}

                <div className="flex gap-2">
                  {(
                    [
                      { id: "fixe", label: "Montant fixe" },
                      { id: "pourcentage", label: "% du revenu" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEMode(m.id)}
                      className={`flex-1 rounded-xl border px-2 py-2 text-xs font-medium ${
                        eMode === m.id ? "border-primary bg-primary/10 text-primary" : "border-input"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {eMode === "pourcentage" ? (
                  <input
                    inputMode="numeric"
                    value={ePart}
                    onChange={(ev) => setEPart(ev.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Part de chaque revenu (%)"
                    aria-label="Part de chaque revenu en pourcentage"
                    className={champ}
                  />
                ) : (
                  <>
                    <input
                      inputMode="numeric"
                      value={eMontantPeriode}
                      onChange={(ev) => setEMontantPeriode(ev.target.value.replace(/[^\d]/g, ""))}
                      placeholder="Montant versé à chaque période (FCFA)"
                      aria-label="Montant versé à chaque période"
                      className={champ}
                    />
                    <label className="flex items-center justify-between gap-3 text-xs font-medium">
                      Ajuster seul selon mes habitudes de dépense
                      <input
                        type="checkbox"
                        checked={eAjustement}
                        onChange={(ev) => setEAjustement(ev.target.checked)}
                        className="h-5 w-5"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={fermerProcess}
                className="flex-1 rounded-xl border border-input py-3 font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => demanderModification(enveloppeEditee.id)}
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />

      <Confirmation
        ouvert={demande !== null}
        titre={
          demande?.type === "suppression"
            ? "Supprimer cette enveloppe ?"
            : "Confirmer la modification"
        }
        message={
          demande?.type === "suppression"
            ? "Cette suppression est irréversible. Vérifiez l'enveloppe concernée."
            : "Vérifiez les champs modifiés avant d'enregistrer."
        }
        details={(() => {
          if (!demande) return [];
          const avant = enveloppes.find((x) => x.id === demande.id);
          if (demande.type === "suppression") {
            return [
              { label: "Enveloppe", apres: demande.nom },
              { label: "Plafond", apres: formatFCFA(avant?.plafond ?? 0) },
              { label: "Catégorie", apres: avant?.categorie || "Sans catégorie" },
              { label: "Sous-catégorie", apres: avant?.sousCategorie || "Général" },
            ];
          }
          return [
            { label: "Emoji", avant: avant?.emoji ?? "", apres: demande.emoji },
            { label: "Nom", avant: avant?.nom ?? "", apres: demande.nom },
            {
              label: "Plafond",
              avant: formatFCFA(avant?.plafond ?? 0),
              apres: formatFCFA(demande.plafond),
            },
            {
              label: "Somme attribuée",
              avant: formatFCFA(avant?.dotation ?? avant?.plafond ?? 0),
              apres: formatFCFA(demande.dotation),
            },
            {
              label: "Catégorie",
              avant: avant?.categorie || "Sans catégorie",
              apres: demande.categorie || "Sans catégorie",
            },
            {
              label: "Sous-catégorie",
              avant: avant?.sousCategorie || "Général",
              apres: demande.sousCategorie || "Général",
            },
          ];
        })()}
        confirmerLabel={demande?.type === "suppression" ? "Supprimer" : "Enregistrer"}
        danger={demande?.type === "suppression"}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
