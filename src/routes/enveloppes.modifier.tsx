import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { enregistrerActionEnveloppe } from "@/lib/historique-enveloppes";
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
  const navigate = useNavigate();
  const {
    enveloppes,
    categories: listeCategories,
    depensesParEnveloppe,
    modifierEnveloppe,
    supprimerEnveloppe,
    nomUtilisateur,
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
  // Règle unique : renouvellement le 1er de chaque mois.
  const ePeriode: Periode = "mois";
  const [eMode, setEMode] = useState<"fixe" | "pourcentage">("fixe");
  const [ePart, setEPart] = useState("");
  const [eMontantPeriode, setEMontantPeriode] = useState("");
  const [eAjustement, setEAjustement] = useState(true);

  const [demande, setDemande] = useState<Demande>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  type ChampsErreur = {
    nom?: string;
    plafond?: string;
    dotation?: string;
    categorie?: string;
    sousCategorie?: string;
    compte?: string;
    montant?: string;
  };
  const [erreurs, setErreurs] = useState<ChampsErreur>({});
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
    const somme = Number(eDotation);
    const part = Number(ePart);
    const parPeriode = Number(eMontantPeriode);
    const prochaines: ChampsErreur = {};

    if (!eNom.trim()) prochaines.nom = "Le nom de l'enveloppe ne peut pas être vide.";
    else if (eNom.trim().length > 40) prochaines.nom = "Nom trop long : 40 caractères maximum.";

    if (!Number.isFinite(valeur) || valeur < 0)
      prochaines.plafond = "Le plafond saisi est invalide : indiquez un montant en FCFA.";

    if (!Number.isFinite(somme) || somme <= 0)
      prochaines.dotation =
        "La somme attribuée est invalide : indiquez le montant placé dans l'enveloppe.";
    else if (Number.isFinite(valeur) && valeur >= 0 && somme < valeur)
      prochaines.dotation =
        "La somme attribuée doit rester supérieure ou égale au plafond de dépenses.";

    if (!eCategorie.trim())
      prochaines.categorie =
        "La catégorie est obligatoire : choisissez-en une dans la liste déroulante.";
    else if (!categorieChoisie)
      prochaines.categorie = `La catégorie « ${eCategorie.trim()} » n'existe pas. Créez-la depuis « Gérer les catégories et sous-catégories ».`;

    if (sousCategories.length > 0 && !eSousCategorie.trim())
      prochaines.sousCategorie = "Cette catégorie possède des sous-catégories : choisissez-en une.";
    else if (eSousCategorie.trim() && !sousCategories.includes(eSousCategorie.trim()))
      prochaines.sousCategorie = `La sous-catégorie « ${eSousCategorie.trim()} » n'existe pas dans cette catégorie.`;

    if (!eCompte.trim())
      prochaines.compte = "Choisissez le compte qui alimente cette enveloppe.";

    if (eMode === "pourcentage" && (!Number.isFinite(part) || part <= 0 || part > 100))
      prochaines.montant = "Indiquez la part de chaque revenu à verser (1 à 100 %).";
    if (eMode === "fixe" && (!Number.isFinite(parPeriode) || parPeriode <= 0))
      prochaines.montant = "Indiquez le montant versé à chaque période.";

    setErreurs(prochaines);
    if (Object.keys(prochaines).length > 0) return;

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
      dateRenouvellement: "",
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
      const avant = enveloppes.find((x) => x.id === demande.id);
      const renomme = Boolean(avant && avant.nom !== demande.nom);
      enregistrerActionEnveloppe({
        enveloppe: demande.nom,
        ancienNom: renomme ? avant?.nom : undefined,
        action: renomme ? "renommage" : "modification",
        auteur: nomUtilisateur?.trim() || "Utilisateur",
        details: [
          renomme ? `nom : « ${avant?.nom} » → « ${demande.nom} »` : null,
          `plafond ${formatFCFA(demande.plafond)}`,
          `somme ${formatFCFA(demande.dotation)}`,
          `${demande.categorie}${demande.sousCategorie ? ` › ${demande.sousCategorie}` : ""}`,
          `compte ${demande.compteSource}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      setEdition(null);
      setErreurs({});
      toast.success(`Enveloppe « ${demande.nom} » enregistrée.`, {
        description: "Retour à la liste des enveloppes.",
      });
      setDemande(null);
      void navigate({ to: "/enveloppes/details" });
      return;
    } else {
      supprimerEnveloppe(demande.id);
      if (edition === demande.id) setEdition(null);
      enregistrerActionEnveloppe({
        enveloppe: demande.nom,
        action: "suppression",
        auteur: nomUtilisateur?.trim() || "Utilisateur",
        details: "Enveloppe retirée du budget.",
      });
      toast.success(`Enveloppe « ${demande.nom} » supprimée.`, {
        description: "Retour à la liste des enveloppes.",
      });
      setDemande(null);
      void navigate({ to: "/enveloppes/details" });
      return;
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
                    {s.enveloppes.map((e) => {
                      const etat = etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0);
                      const pourcentage = etat.pourcentage;
                      const depasse = etat.plafondAtteint;
                      const couleurBarre = depasse
                        ? "bg-destructive"
                        : pourcentage >= 80
                          ? "bg-amber-500"
                          : "bg-success";
                      return (
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
                                  {formatFCFA(etat.restant)} restants · plafond{" "}
                                  {formatFCFA(e.plafond)}
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

                          <div
                            className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-border/40 bg-secondary"
                            role="progressbar"
                            aria-valuenow={Math.round(pourcentage)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Consommation du plafond de l'enveloppe ${e.nom} : ${Math.round(pourcentage)} %`}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${couleurBarre}`}
                              style={{ width: `${pourcentage}%` }}
                            />
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
                      );
                    })}
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
                  {erreurs.nom && (
                    <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                      {erreurs.nom}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="edit-plafond" className="text-sm font-medium">
                  Quel est le plafond de cette enveloppe ? (FCFA)
                </label>
                <input
                  id="edit-plafond"
                  inputMode="numeric"
                  value={grouperMontant(ePlafond)}
                  onChange={(ev) => setEPlafond(ev.target.value.replace(/[^\d]/g, ""))}
                  className={champ}
                />
                {erreurs.plafond && (
                  <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {erreurs.plafond}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="edit-dotation" className="text-sm font-medium">
                  Quelle somme est attribuée à cette enveloppe ? (FCFA)
                </label>
                <input
                  id="edit-dotation"
                  inputMode="numeric"
                  value={grouperMontant(eDotation)}
                  onChange={(ev) => setEDotation(ev.target.value.replace(/[^\d]/g, ""))}
                  className={champ}
                />
                {erreurs.dotation && (
                  <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {erreurs.dotation}
                  </p>
                )}
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
                {erreurs.categorie && (
                  <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {erreurs.categorie}
                  </p>
                )}
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
                {erreurs.sousCategorie && (
                  <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {erreurs.sousCategorie}
                  </p>
                )}
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
                {erreurs.compte && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {erreurs.compte}
                  </p>
                )}

                <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">
                  Renouvellement automatique le 1er de chaque mois, pour toutes les enveloppes : il
                  n'y a plus de date à choisir.
                </p>

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
                        eMode === m.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {eMode === "pourcentage" ? (
                  <input
                    inputMode="numeric"
                    value={grouperMontant(ePart)}
                    onChange={(ev) => setEPart(ev.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Part de chaque revenu (%)"
                    aria-label="Part de chaque revenu en pourcentage"
                    className={champ}
                  />
                ) : (
                  <>
                    <input
                      inputMode="numeric"
                      value={grouperMontant(eMontantPeriode)}
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
                {erreurs.montant && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {erreurs.montant}
                  </p>
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
              { label: "Logo", apres: avant?.emoji ?? "💡" },
              { label: "Enveloppe", apres: demande.nom },
              { label: "Somme attribuée", apres: formatFCFA(avant?.dotation ?? 0) },
              { label: "Compte source", apres: avant?.compteSource || "—" },
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
            {
              label: "Compte source",
              avant: avant?.compteSource || "—",
              apres: demande.compteSource,
            },
            {
              label: "Renouvellement",
              apres:
                demande.modeRemplissage === "pourcentage"
                  ? `${demande.pourcentageRevenu}% de chaque revenu`
                  : `${formatFCFA(demande.montantPeriode)} le 1er de chaque mois`,
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
