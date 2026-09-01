import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PERIODES, useSuperApp, type Periode } from "@/lib/store";
import { apprendreIcone, apprendreDepuisEnveloppes, suggererIcone } from "@/lib/icone-auto";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { DicteeChamp } from "@/components/DicteeChamp";
import { DialogueVocal, type EtapeVocale } from "@/components/DialogueVocal";
import { analyserEnveloppeDictee } from "@/lib/dictee-champs";

export const Route = createFileRoute("/enveloppes/creer")({
  head: () => ({
    meta: [
      { title: "Créer une enveloppe — SUPER APP" },
      {
        name: "description",
        content:
          "Page dédiée à la création d'une nouvelle enveloppe budgétaire : nom, plafond, somme attribuée, catégorie et sous-catégorie en francs CFA.",
      },
      { property: "og:title", content: "Créer une enveloppe — SUPER APP" },
      {
        property: "og:description",
        content: "Créez une enveloppe budgétaire guidée par des questions claires, en FCFA.",
      },
    ],
  }),
  component: CreerEnveloppePage,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none transition-shadow focus:ring-2 focus:ring-ring";

function CreerEnveloppePage() {
  const {
    ajouterEnveloppe,
    remplirEnveloppe,
    categories: listeCategories,
    comptes,
    soldesParCompte,
  } = useSuperApp();
  const navigate = useNavigate();

  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💡");
  const [emojiManuel, setEmojiManuel] = useState(false);
  const [plafond, setPlafond] = useState("");
  const [dotation, setDotation] = useState("");
  const [categorie, setCategorie] = useState("");
  const [sousCategorie, setSousCategorie] = useState("");
  const [compteSource, setCompteSource] = useState("");
  const [periodeRenouvellement, setPeriodeRenouvellement] = useState<Periode>("mois");
  const [dateRenouvellement, setDateRenouvellement] = useState("");
  const [modeRemplissage, setModeRemplissage] = useState<"fixe" | "pourcentage">("fixe");
  const [pourcentageRevenu, setPourcentageRevenu] = useState("");
  const [ajustementAuto, setAjustementAuto] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [confirmation, setConfirmation] = useState<{
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
    ajustementAuto: boolean;
  } | null>(null);

  // Apprentissage local : les enveloppes déjà validées nourrissent l'IA d'icônes.
  const { enveloppes: enveloppesExistantes } = useSuperApp();
  useEffect(() => {
    apprendreDepuisEnveloppes(enveloppesExistantes);
  }, [enveloppesExistantes]);

  const categorieChoisie = listeCategories.find((c) => c.nom === categorie.trim());
  const sousCategories = categorieChoisie?.sousCategories ?? [];

  /** Dictée locale : remplit seul le nom, la somme placée et le plafond. */
  function appliquerDictee(texte: string) {
    const lu = analyserEnveloppeDictee(texte);
    if (lu.nom) {
      setNom(lu.nom);
      if (!emojiManuel) setEmoji(suggererIcone(lu.nom, "enveloppe"));
    }
    if (lu.dotation !== null) setDotation(String(lu.dotation));
    if (lu.plafond !== null) setPlafond(String(lu.plafond));
    if (!lu.nom && lu.dotation === null) {
      toast.warning(`« ${texte} » : rien compris, complétez à la main.`);
      return;
    }
    toast.success(
      `Compris : ${lu.nom || "sans nom"}${lu.dotation !== null ? ` · ${formatFCFA(lu.dotation)}` : ""}${
        lu.plafond !== null ? ` · plafond ${formatFCFA(lu.plafond)}` : ""
      }`,
    );
  }

  /**
   * Discussion vocale guidée : chaque champ du formulaire devient une question
   * posée à voix haute par l'application, à laquelle l'utilisateur répond.
   */
  const etapesVocales = useMemo<EtapeVocale[]>(
    () => [
      {
        id: "nom",
        question: "Comment s'appelle cette enveloppe ?",
        type: "texte",
        appliquer: (v) => {
          const valeur = String(v).toUpperCase();
          setNom(valeur);
          if (!emojiManuel) setEmoji(suggererIcone(valeur, "enveloppe"));
        },
        confirmation: (v) => `Enveloppe ${String(v)}.`,
      },
      {
        id: "dotation",
        question: "Quelle somme placez-vous réellement dans cette enveloppe, en francs CFA ?",
        type: "nombre",
        appliquer: (v) => setDotation(String(v)),
        confirmation: (v) => `Somme attribuée : ${formatFCFA(Number(v))}.`,
      },
      {
        id: "plafond",
        question: "Quel plafond de dépenses ne faut-il pas dépasser ?",
        type: "nombre",
        appliquer: (v) => setPlafond(String(v)),
        confirmation: (v) => `Plafond : ${formatFCFA(Number(v))}.`,
      },
      {
        id: "categorie",
        question: "Dans quelle catégorie faut-il classer cette enveloppe ?",
        type: "choix",
        options: listeCategories.map((c) => ({ valeur: c.nom, label: c.nom })),
        ignorer: listeCategories.length === 0,
        appliquer: (v) => {
          setCategorie(String(v));
          setSousCategorie("");
        },
        confirmation: (v) => `Catégorie ${String(v)}.`,
      },
      {
        id: "sousCategorie",
        question: "Quelle sous-catégorie choisissez-vous ?",
        type: "choix",
        options: sousCategories.map((s) => ({ valeur: s, label: s })),
        ignorer: sousCategories.length === 0,
        appliquer: (v) => setSousCategorie(String(v)),
        confirmation: (v) => `Sous-catégorie ${String(v)}.`,
      },
      {
        id: "compte",
        question: "Quel compte alimente cette enveloppe ?",
        type: "choix",
        options: comptes.map((c) => ({ valeur: c, label: c })),
        ignorer: comptes.length === 0,
        appliquer: (v) => setCompteSource(String(v)),
        confirmation: (v) => `Compte source : ${String(v)}.`,
      },
      {
        id: "periode",
        question: "À quelle période l'enveloppe se renouvelle-t-elle ?",
        type: "choix",
        options: PERIODES.map((p) => ({ valeur: p.id, label: p.label })),
        appliquer: (v) => setPeriodeRenouvellement(String(v) as Periode),
        confirmation: (v) =>
          `Renouvellement : ${PERIODES.find((p) => p.id === v)?.label ?? String(v)}.`,
      },
      {
        id: "mode",
        question:
          "L'enveloppe se remplit-elle avec un montant fixe par période, ou avec un pourcentage de chaque revenu ?",
        type: "choix",
        options: [
          { valeur: "fixe", label: "Montant fixe par période" },
          { valeur: "pourcentage", label: "Pourcentage de chaque revenu" },
        ],
        appliquer: (v) => setModeRemplissage(v === "pourcentage" ? "pourcentage" : "fixe"),
        confirmation: (v) =>
          v === "pourcentage" ? "Remplissage par pourcentage." : "Montant fixe par période.",
      },
      {
        id: "part",
        question: "Quel pourcentage de chaque revenu faut-il verser dans cette enveloppe ?",
        type: "nombre",
        ignorer: modeRemplissage !== "pourcentage",
        appliquer: (v) => setPourcentageRevenu(String(v)),
        confirmation: (v) => `${Number(v)} pour cent de chaque revenu.`,
      },
      {
        id: "ajustement",
        question: "Dois-je ajuster seul le montant selon vos habitudes de dépense ?",
        type: "ouiNon",
        ignorer: modeRemplissage === "pourcentage",
        appliquer: (v) => setAjustementAuto(Boolean(v)),
        confirmation: (v) => (v ? "J'ajusterai automatiquement." : "Pas d'ajustement automatique."),
      },
    ],
    [comptes, emojiManuel, listeCategories, modeRemplissage, sousCategories],
  );

  function valider(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(plafond);
    if (!nom.trim()) {
      setErreur("Donnez un nom à l'enveloppe.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      setErreur("Plafond invalide.");
      return;
    }
    const somme = Number(dotation);
    if (!Number.isFinite(somme) || somme <= 0) {
      setErreur("Indiquez la somme attribuée à cette enveloppe (montant placé dedans).");
      return;
    }
    if (somme < valeur) {
      setErreur(
        "Le plafond ne peut pas dépasser la somme attribuée : le plafond est le montant de dépenses à ne pas dépasser.",
      );
      return;
    }
    if (!categorie.trim()) {
      setErreur(
        "La catégorie est obligatoire : choisissez-en une dans la liste avant de créer l'enveloppe.",
      );
      return;
    }
    if (!categorieChoisie) {
      setErreur(
        `La catégorie « ${categorie.trim()} » n'existe pas. Créez-la depuis « Gérer les catégories et sous-catégories ».`,
      );
      return;
    }
    if (sousCategories.length > 0 && !sousCategorie.trim()) {
      setErreur(
        "Cette catégorie possède des sous-catégories : choisissez-en une avant de créer l'enveloppe.",
      );
      return;
    }
    if (!compteSource.trim()) {
      setErreur(
        "Choisissez le compte qui alimente cette enveloppe : son contenu y est réservé.",
      );
      return;
    }
    const part = Number(pourcentageRevenu);
    if (modeRemplissage === "pourcentage" && (!Number.isFinite(part) || part <= 0 || part > 100)) {
      setErreur("Indiquez le pourcentage de chaque revenu à verser dans cette enveloppe (1 à 100).");
      return;
    }
    if ((soldesParCompte[compteSource.trim()] ?? 0) < somme) {
      setErreur(
        `Le compte « ${compteSource.trim()} » ne contient que ${formatFCFA(
          soldesParCompte[compteSource.trim()] ?? 0,
        )} : impossible d'y réserver ${formatFCFA(somme)}.`,
      );
      return;
    }
    if (modeRemplissage === "fixe" && !dateRenouvellement) {
      setErreur(
        "Précisez la date du premier renouvellement automatique de cette enveloppe.",
      );
      return;
    }
    setConfirmation({
      nom: nom.trim(),
      emoji: emoji.trim() || "💡",
      plafond: valeur,
      dotation: somme,
      categorie: categorie.trim(),
      sousCategorie: sousCategorie.trim(),
      compteSource: compteSource.trim(),
      periodeRenouvellement,
      dateRenouvellement: modeRemplissage === "fixe" ? dateRenouvellement : "",
      modeRemplissage,
      pourcentageRevenu: modeRemplissage === "pourcentage" ? part : 0,
      ajustementAuto,
    });
  }

  function confirmerCreation() {
    if (!confirmation) return;
    // La dotation part à 0 : le premier contenu est versé par le compte source,
    // ce qui débite ce compte et lance le cycle de renouvellement.
    const id = ajouterEnveloppe({
      ...confirmation,
      dotation: 0,
      montantPeriode: confirmation.dotation,
    });
    if (id) {
      remplirEnveloppe(id, confirmation.dotation, confirmation.compteSource, "periode");
    }
    // L'IA locale retient l'association nom → icône pour s'améliorer.
    apprendreIcone(confirmation.nom, confirmation.emoji);
    setConfirmation(null);
    toast.success("Enveloppe ajoutée.");
    void navigate({ to: "/enveloppes/action" });
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour aux actions" />

      <section className="carte space-y-1 p-4">
        <h2 className="text-lg font-semibold">Créer une nouvelle enveloppe</h2>
        <p className="text-sm text-muted-foreground">
          Répondez aux questions ci-dessous pour créer votre enveloppe budgétaire.
        </p>
      </section>

      <DialogueVocal
        titre="Créer l'enveloppe en parlant"
        sousTitre="L'application pose chaque question à voix haute, vous répondez. Dites « passer » ou « stop » à tout moment."
        etapes={etapesVocales}
      />

      <DicteeChamp
        titre="Dicter l'enveloppe en une phrase"
        exemple="enveloppe transport avec 30000 francs, plafond 25000"
        onTexte={appliquerDictee}
      />

      <form onSubmit={valider} className="space-y-4">
        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">Comment s'appelle cette enveloppe ?</p>
          <div className="flex gap-2">
            <div className="w-20">
              <label htmlFor="e-emoji" className="text-xs text-muted-foreground">
                Emoji
              </label>
              <input
                id="e-emoji"
                value={emoji}
                onChange={(ev) => {
                  setEmojiManuel(true);
                  setEmoji(ev.target.value);
                }}
                className={champ}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="e-nom" className="text-xs text-muted-foreground">
                Nom
              </label>
              <input
                id="e-nom"
                value={nom}
                onChange={(ev) => {
                  const valeur = ev.target.value;
                  setNom(valeur);
                  if (!emojiManuel) setEmoji(suggererIcone(valeur, "enveloppe"));
                }}
                placeholder="Santé"
                className={champ}
              />
            </div>
          </div>
        </section>

        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">
            Quelle somme placez-vous réellement dans cette enveloppe ?
          </p>
          <input
            id="e-dotation"
            inputMode="numeric"
            value={grouperMontant(dotation)}
            onChange={(ev) => setDotation(ev.target.value.replace(/[^\d]/g, ""))}
            placeholder="30000"
            className={champ}
            aria-label="Somme attribuée en FCFA"
          />
          <p className="text-xs text-muted-foreground">
            Montant réellement disponible dans l'enveloppe (FCFA).
          </p>
        </section>

        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">
            Quel plafond de dépenses ne faut-il pas dépasser ?
          </p>
          <input
            id="e-plafond"
            inputMode="numeric"
            value={grouperMontant(plafond)}
            onChange={(ev) => setPlafond(ev.target.value.replace(/[^\d]/g, ""))}
            placeholder="25000"
            className={champ}
            aria-label="Plafond en FCFA"
          />
          <p className="text-xs text-muted-foreground">
            Au-delà du plafond, vous entrez en réserve. Il doit rester inférieur ou égal à la somme
            attribuée.
          </p>
        </section>

        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">Dans quelle catégorie la classer ?</p>
          <select
            id="e-categorie"
            value={categorie}
            onChange={(ev) => {
              setCategorie(ev.target.value);
              setSousCategorie("");
            }}
            className={champ}
            aria-label="Catégorie"
          >
            <option value="">Choisir une catégorie…</option>
            {listeCategories.map((c) => (
              <option key={c.id} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>

          <label htmlFor="e-sous-categorie" className="text-xs text-muted-foreground">
            Sous-catégorie{sousCategories.length > 0 ? " (obligatoire)" : ""}
          </label>
          <select
            id="e-sous-categorie"
            value={sousCategorie}
            onChange={(ev) => setSousCategorie(ev.target.value)}
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
          <p className="text-xs text-muted-foreground">
            Exemple : Transport › Carburant, Factures › Facture SONEB.
          </p>
        </section>

        <section className="carte space-y-3 p-4">
          <p className="text-sm font-semibold">Comment cette enveloppe se remplit-elle ?</p>

          <label htmlFor="e-compte" className="text-xs text-muted-foreground">
            Compte qui alimente l'enveloppe (obligatoire)
          </label>
          <select
            id="e-compte"
            value={compteSource}
            onChange={(ev) => setCompteSource(ev.target.value)}
            className={champ}
          >
            <option value="">Choisir un compte…</option>
            {comptes.map((c) => (
              <option key={c} value={c}>
                {c} — {formatFCFA(soldesParCompte[c] ?? 0)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Le contenu de l'enveloppe reste dans ce compte : il y est seulement réservé.
            Seules les dépenses faites depuis l'enveloppe diminuent le compte.
          </p>

          <label htmlFor="e-periode" className="text-xs text-muted-foreground">
            Période de renouvellement du contenu
          </label>
          <select
            id="e-periode"
            value={periodeRenouvellement}
            onChange={(ev) => setPeriodeRenouvellement(ev.target.value as Periode)}
            className={champ}
          >
            {PERIODES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {modeRemplissage === "fixe" && (
            <>
              <label htmlFor="e-date-renouv" className="text-xs text-muted-foreground">
                Date du premier renouvellement automatique (obligatoire)
              </label>
              <input
                id="e-date-renouv"
                type="date"
                value={dateRenouvellement}
                onChange={(ev) => setDateRenouvellement(ev.target.value)}
                className={champ}
              />
              <p className="text-xs text-muted-foreground">
                Le renouvellement n'aura lieu qu'à cette date, puis à chaque période.
              </p>
            </>
          )}

          <div className="flex gap-2">
            {(
              [
                { id: "fixe", label: "Montant fixe par période" },
                { id: "pourcentage", label: "% de chaque revenu" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModeRemplissage(m.id)}
                className={`flex-1 rounded-xl border px-2 py-2 text-xs font-medium ${
                  modeRemplissage === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {modeRemplissage === "pourcentage" ? (
            <>
              <label htmlFor="e-part" className="text-xs text-muted-foreground">
                Part de chaque revenu (%)
              </label>
              <input
                id="e-part"
                inputMode="numeric"
                value={pourcentageRevenu}
                onChange={(ev) => setPourcentageRevenu(ev.target.value.replace(/[^\d]/g, ""))}
                placeholder="10"
                className={champ}
              />
              <p className="text-xs text-muted-foreground">
                À chaque revenu encaissé sur ce compte, cette part est versée automatiquement.
              </p>
            </>
          ) : (
            <label className="flex items-center justify-between gap-3 text-xs font-medium">
              Ajuster seul le montant selon mes habitudes de dépense
              <input
                type="checkbox"
                checked={ajustementAuto}
                onChange={(ev) => setAjustementAuto(ev.target.checked)}
                className="h-5 w-5"
              />
            </label>
          )}
        </section>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Créer l'enveloppe
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: "/enveloppes/action" })}
            className="flex-1 rounded-xl border border-input py-3 font-medium"
          >
            Annuler
          </button>
        </div>
      </form>

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />

      <Confirmation
        ouvert={confirmation !== null}
        titre="Confirmer la création"
        message="Vérifiez les champs de la nouvelle enveloppe avant de valider."
        details={
          confirmation
            ? [
                { label: "Emoji", apres: confirmation.emoji },
                { label: "Nom", apres: confirmation.nom },
                { label: "Plafond", apres: formatFCFA(confirmation.plafond) },
                { label: "Somme attribuée", apres: formatFCFA(confirmation.dotation) },
                { label: "Catégorie", apres: confirmation.categorie || "Sans catégorie" },
                { label: "Sous-catégorie", apres: confirmation.sousCategorie || "Général" },
                { label: "Compte source", apres: confirmation.compteSource },
                {
                  label: "Renouvellement",
                  apres:
                    confirmation.modeRemplissage === "pourcentage"
                      ? `${confirmation.pourcentageRevenu}% de chaque revenu`
                      : `${formatFCFA(confirmation.dotation)} ${
                          PERIODES.find((p) => p.id === confirmation.periodeRenouvellement)?.label ??
                          ""
                        }`,
                },
                {
                  label: "Date de renouvellement",
                  apres: confirmation.dateRenouvellement || "Aucune",
                },
              ]
            : []
        }
        confirmerLabel="Créer"
        onConfirmer={confirmerCreation}
        onAnnuler={() => setConfirmation(null)}
      />
    </div>
  );
}
