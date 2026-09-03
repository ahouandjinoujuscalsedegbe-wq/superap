import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ChoixIcone } from "@/components/ChoixIcone";
import { apprendreIcone, suggererIcone } from "@/lib/icone-auto";
import { enregistrerActionEnveloppe } from "@/lib/historique-enveloppes";
import { ErreurPopup } from "@/components/ErreurPopup";

export const Route = createFileRoute("/enveloppes/modifier/$id")({
  head: () => ({
    meta: [
      { title: "Modifier l'enveloppe — SUPER APP" },
      {
        name: "description",
        content:
          "Page dédiée à la modification d'une enveloppe budgétaire : nom, logo proposé par l'intelligence locale, plafond, somme attribuée et renouvellement mensuel.",
      },
      { property: "og:title", content: "Modifier l'enveloppe — SUPER APP" },
      {
        property: "og:description",
        content:
          "Modifiez une enveloppe sur une page complète, avec logos suggérés et confirmation avant enregistrement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModifierUneEnveloppe,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

type ChampsErreur = {
  nom?: string;
  plafond?: string;
  dotation?: string;
  categorie?: string;
  sousCategorie?: string;
  compte?: string;
  montant?: string;
};

function ModifierUneEnveloppe() {
  const { id } = useParams({ from: "/enveloppes/modifier/$id" });
  const navigate = useNavigate();
  const {
    enveloppes,
    categories: listeCategories,
    modifierEnveloppe,
    supprimerEnveloppe,
    nomUtilisateur,
    comptes,
  } = useSuperApp();

  const enveloppe = useMemo(() => enveloppes.find((e) => e.id === id), [enveloppes, id]);

  const [eNom, setENom] = useState(enveloppe?.nom ?? "");
  const [eEmoji, setEEmoji] = useState(enveloppe?.emoji ?? "💡");
  const [emojiManuel, setEmojiManuel] = useState(false);
  const [ePlafond, setEPlafond] = useState(String(enveloppe?.plafond ?? ""));
  const [eDotation, setEDotation] = useState(
    String(enveloppe?.dotation ?? enveloppe?.plafond ?? ""),
  );
  const [eCategorie, setECategorie] = useState(enveloppe?.categorie ?? "");
  const [eSousCategorie, setESousCategorie] = useState(enveloppe?.sousCategorie ?? "");
  const [eCompte, setECompte] = useState(enveloppe?.compteSource ?? "");
  const ePeriode: Periode = "mois";
  const [eMode, setEMode] = useState<"fixe" | "pourcentage">(enveloppe?.modeRemplissage ?? "fixe");
  const [ePart, setEPart] = useState(
    enveloppe?.pourcentageRevenu ? String(enveloppe.pourcentageRevenu) : "",
  );
  const [eMontantPeriode, setEMontantPeriode] = useState(
    String(enveloppe?.montantPeriode ?? enveloppe?.dotation ?? enveloppe?.plafond ?? ""),
  );
  const [eAjustement, setEAjustement] = useState(enveloppe?.ajustementAuto ?? true);

  const [erreurs, setErreurs] = useState<ChampsErreur>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [demande, setDemande] = useState<"modification" | "suppression" | null>(null);

  const categorieChoisie = listeCategories.find((c) => c.nom === eCategorie.trim());
  const sousCategories = categorieChoisie?.sousCategories ?? [];

  if (!enveloppe) {
    return (
      <div className="space-y-4">
        <BoutonRetour to="/enveloppes/modifier" label="Retour aux enveloppes" />
        <p className="carte p-4 text-sm text-muted-foreground">
          Cette enveloppe n'existe plus. Revenez à la liste pour en choisir une autre.
        </p>
      </div>
    );
  }

  const valeurs = {
    nom: eNom.trim(),
    emoji: eEmoji.trim() || "💡",
    plafond: Number(ePlafond),
    dotation: Number(eDotation),
    categorie: eCategorie.trim(),
    sousCategorie: eSousCategorie.trim(),
    compteSource: eCompte.trim(),
    part: Number(ePart),
    parPeriode: Number(eMontantPeriode),
  };

  function verifier(): boolean {
    const p: ChampsErreur = {};
    if (!valeurs.nom) p.nom = "Le nom de l'enveloppe ne peut pas être vide.";
    else if (valeurs.nom.length > 40) p.nom = "Nom trop long : 40 caractères maximum.";

    if (!Number.isFinite(valeurs.plafond) || valeurs.plafond < 0)
      p.plafond = "Le plafond saisi est invalide : indiquez un montant en FCFA.";

    if (!Number.isFinite(valeurs.dotation) || valeurs.dotation <= 0)
      p.dotation = "La somme attribuée est invalide : indiquez le montant placé dans l'enveloppe.";
    else if (
      Number.isFinite(valeurs.plafond) &&
      valeurs.plafond >= 0 &&
      valeurs.dotation < valeurs.plafond
    )
      p.dotation = "La somme attribuée doit rester supérieure ou égale au plafond de dépenses.";

    if (!valeurs.categorie)
      p.categorie = "La catégorie est obligatoire : choisissez-en une dans la liste déroulante.";
    else if (!categorieChoisie)
      p.categorie = `La catégorie « ${valeurs.categorie} » n'existe pas. Créez-la depuis « Gérer les catégories et sous-catégories ».`;

    if (sousCategories.length > 0 && !valeurs.sousCategorie)
      p.sousCategorie = "Cette catégorie possède des sous-catégories : choisissez-en une.";
    else if (valeurs.sousCategorie && !sousCategories.includes(valeurs.sousCategorie))
      p.sousCategorie = `La sous-catégorie « ${valeurs.sousCategorie} » n'existe pas dans cette catégorie.`;

    if (!valeurs.compteSource) p.compte = "Choisissez le compte qui alimente cette enveloppe.";

    if (
      eMode === "pourcentage" &&
      (!Number.isFinite(valeurs.part) || valeurs.part <= 0 || valeurs.part > 100)
    )
      p.montant = "Indiquez la part de chaque revenu à verser (1 à 100 %).";
    if (eMode === "fixe" && (!Number.isFinite(valeurs.parPeriode) || valeurs.parPeriode <= 0))
      p.montant = "Indiquez le montant versé à chaque période.";

    setErreurs(p);
    return Object.keys(p).length === 0;
  }

  function enregistrer() {
    if (!enveloppe) return;
    modifierEnveloppe(enveloppe.id, {
      nom: valeurs.nom,
      emoji: valeurs.emoji,
      plafond: valeurs.plafond,
      dotation: valeurs.dotation,
      categorie: valeurs.categorie,
      sousCategorie: valeurs.sousCategorie,
      compteSource: valeurs.compteSource,
      periodeRenouvellement: ePeriode,
      dateRenouvellement: "",
      modeRemplissage: eMode,
      pourcentageRevenu: eMode === "pourcentage" ? valeurs.part : 0,
      montantPeriode: eMode === "fixe" ? valeurs.parPeriode : 0,
      ajustementAuto: eAjustement,
    });
    apprendreIcone(valeurs.nom, valeurs.emoji);
    const renomme = enveloppe.nom !== valeurs.nom;
    enregistrerActionEnveloppe({
      enveloppe: valeurs.nom,
      ancienNom: renomme ? enveloppe.nom : undefined,
      action: renomme ? "renommage" : "modification",
      auteur: nomUtilisateur?.trim() || "Utilisateur",
      details: [
        renomme ? `nom : « ${enveloppe.nom} » → « ${valeurs.nom} »` : null,
        `plafond ${formatFCFA(valeurs.plafond)}`,
        `somme ${formatFCFA(valeurs.dotation)}`,
        `${valeurs.categorie}${valeurs.sousCategorie ? ` › ${valeurs.sousCategorie}` : ""}`,
        `compte ${valeurs.compteSource}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    setDemande(null);
    toast.success(`Enveloppe « ${valeurs.nom} » enregistrée.`, {
      description: "Retour à la liste des enveloppes.",
    });
    void navigate({ to: "/enveloppes/modifier" });
  }

  function supprimer() {
    if (!enveloppe) return;
    supprimerEnveloppe(enveloppe.id);
    enregistrerActionEnveloppe({
      enveloppe: enveloppe.nom,
      action: "suppression",
      auteur: nomUtilisateur?.trim() || "Utilisateur",
      details: "Enveloppe retirée du budget.",
    });
    setDemande(null);
    toast.success(`Enveloppe « ${enveloppe.nom} » supprimée.`, {
      description: "Retour à la liste des enveloppes.",
    });
    void navigate({ to: "/enveloppes/modifier" });
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/modifier" label="Retour aux enveloppes" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Modifier l'enveloppe</h1>
        <p className="text-sm text-muted-foreground">
          <span aria-hidden>{enveloppe.emoji}</span> {enveloppe.nom} — modifiez chaque champ, puis
          validez la confirmation.
        </p>
      </header>

      <div className="carte space-y-3 p-4">
        <div>
          <label htmlFor="edit-nom" className="text-sm font-medium">
            Quel est le nom de l'enveloppe ?
          </label>
          <input
            id="edit-nom"
            value={eNom}
            onChange={(ev) => {
              const valeur = ev.target.value;
              setENom(valeur);
              // L'intelligence locale propose un logo dès que le nom change.
              if (!emojiManuel) setEEmoji(suggererIcone(valeur, "enveloppe"));
            }}
            className={champ}
          />
          {erreurs.nom && (
            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
              {erreurs.nom}
            </p>
          )}
        </div>

        <ChoixIcone
          nom={eNom}
          domaine="enveloppe"
          valeur={eEmoji}
          titre="Logos proposés pour cette enveloppe"
          onChoisir={(emoji) => {
            setEEmoji(emoji);
            setEmojiManuel(true);
          }}
        />

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
            Cette somme diminue à chaque dépense. Au-delà du plafond, vous puisez dans la réserve.
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
            onChange={(ev) => setESousCategorie(ev.target.value)}
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
            Renouvellement automatique le 1er de chaque mois, pour toutes les enveloppes : il n'y a
            plus de date à choisir.
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

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setDemande("suppression")}
            className="flex-1 rounded-xl border border-destructive py-3 font-medium text-destructive"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => {
              if (verifier()) setDemande("modification");
            }}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Enregistrer
          </button>
        </div>
      </div>

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />

      <Confirmation
        ouvert={demande !== null}
        titre={
          demande === "suppression" ? "Supprimer cette enveloppe ?" : "Confirmer la modification"
        }
        message={
          demande === "suppression"
            ? "Cette suppression est irréversible. Vérifiez l'enveloppe concernée."
            : "Vérifiez les champs modifiés avant d'enregistrer."
        }
        details={
          demande === "suppression"
            ? [
                { label: "Logo", apres: enveloppe.emoji },
                { label: "Enveloppe", apres: enveloppe.nom },
                { label: "Somme attribuée", apres: formatFCFA(enveloppe.dotation ?? 0) },
                { label: "Compte source", apres: enveloppe.compteSource || "—" },
                { label: "Plafond", apres: formatFCFA(enveloppe.plafond) },
                { label: "Catégorie", apres: enveloppe.categorie || "Sans catégorie" },
                { label: "Sous-catégorie", apres: enveloppe.sousCategorie || "Général" },
              ]
            : [
                { label: "Logo", avant: enveloppe.emoji, apres: valeurs.emoji },
                { label: "Nom", avant: enveloppe.nom, apres: valeurs.nom },
                {
                  label: "Plafond",
                  avant: formatFCFA(enveloppe.plafond),
                  apres: formatFCFA(valeurs.plafond),
                },
                {
                  label: "Somme attribuée",
                  avant: formatFCFA(enveloppe.dotation ?? enveloppe.plafond),
                  apres: formatFCFA(valeurs.dotation),
                },
                {
                  label: "Catégorie",
                  avant: enveloppe.categorie || "Sans catégorie",
                  apres: valeurs.categorie || "Sans catégorie",
                },
                {
                  label: "Sous-catégorie",
                  avant: enveloppe.sousCategorie || "Général",
                  apres: valeurs.sousCategorie || "Général",
                },
                {
                  label: "Compte source",
                  avant: enveloppe.compteSource || "—",
                  apres: valeurs.compteSource,
                },
                {
                  label: "Renouvellement",
                  apres:
                    eMode === "pourcentage"
                      ? `${valeurs.part}% de chaque revenu`
                      : `${formatFCFA(valeurs.parPeriode)} le 1er de chaque mois`,
                },
              ]
        }
        confirmerLabel={demande === "suppression" ? "Supprimer" : "Enregistrer"}
        danger={demande === "suppression"}
        onConfirmer={demande === "suppression" ? supprimer : enregistrer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
