import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PencilLine, Plus, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { DicteeChamp } from "@/components/DicteeChamp";
import { analyserCompteDicte } from "@/lib/dictee-champs";

type Demande =
  | { type: "creation"; nom: string; solde: number; disponible: boolean }
  | { type: "renommage"; ancien: string; nom: string; ajustement: number }
  | { type: "suppression"; nom: string }
  | null;

export const Route = createFileRoute("/comptes/action")({
  head: () => ({
    meta: [
      { title: "Action — Ajouter et modifier vos comptes" },
      {
        name: "description",
        content:
          "Créez un nouveau compte, renommez ou supprimez un compte existant du foyer, avec confirmation avant chaque opération.",
      },
      { property: "og:title", content: "Action sur les comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Création, renommage et suppression de comptes en francs CFA.",
      },
    ],
  }),
  component: ActionComptes,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function ActionComptes() {
  const {
    comptes,
    comptesExclus,
    definirCompteDisponible,
    transactions,
    transferts,
    soldesParCompte,
    ajouterCompte,
    ajouterTransaction,
    renommerCompte,
    supprimerCompte,
  } = useSuperApp();

  const [modal, setModal] = useState<"creer" | "modifier" | null>(null);
  const [nom, setNom] = useState("");
  const [solde, setSolde] = useState("");
  const [disponible, setDisponible] = useState(true);
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [demande, setDemande] = useState<Demande>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function ouvrirCreation() {
    setNom("");
    setSolde("");
    setDisponible(true);
    setEnEdition(null);
    setModal("creer");
  }

  function ouvrirModification(compte: string) {
    setEnEdition(compte);
    setNom(compte);
    setSolde(String(soldesParCompte[compte] ?? 0));
    setDisponible(!comptesExclus.includes(compte));
    setModal("modifier");
  }

  function fermer() {
    setModal(null);
    setEnEdition(null);
  }

  function auTexteDicte(texte: string) {
    const lu = analyserCompteDicte(texte);
    if (!lu.nom && lu.soldeInitial === null) {
      setErreur("Phrase non comprise. Dites par exemple : « compte mobile money avec 25000 ».");
      return;
    }
    if (lu.nom) setNom(lu.nom.slice(0, 30));
    if (lu.soldeInitial !== null) setSolde(String(lu.soldeInitial));
    toast.success("Dictée prise en compte. Vérifiez avant de valider.");
  }

  function soumettre(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = nom.trim();
    if (!valeur) {
      setErreur("Donnez un nom au compte avant de valider.");
      return;
    }
    if (valeur.length > 30) {
      setErreur("Nom trop long : 30 caractères maximum.");
      return;
    }
    const soldeSaisi = solde.trim() === "" ? 0 : Number(solde.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(soldeSaisi) || soldeSaisi < 0) {
      setErreur("Le solde doit être un nombre positif en francs CFA.");
      return;
    }
    if (modal === "creer") {
      if (comptes.includes(valeur)) {
        setErreur(`Le compte « ${valeur} » existe déjà. Choisissez un autre nom.`);
        return;
      }
      setDemande({ type: "creation", nom: valeur, solde: soldeSaisi, disponible });
      return;
    }
    if (!enEdition) return;
    const ajustement = soldeSaisi - (soldesParCompte[enEdition] ?? 0);
    if (valeur !== enEdition && comptes.includes(valeur)) {
      setErreur(`Le compte « ${valeur} » existe déjà. Choisissez un autre nom.`);
      return;
    }
    const disponibleChange = disponible === comptesExclus.includes(enEdition);
    if (disponibleChange) definirCompteDisponible(enEdition, disponible);
    if (valeur === enEdition && ajustement === 0 && !disponibleChange) {
      setErreur("Rien n'a changé : modifiez le nom, le solde ou le disponible, ou annulez.");
      return;
    }
    if (valeur === enEdition && ajustement === 0) {
      toast.success("Compte modifié.");
      fermer();
      return;
    }
    setDemande({ type: "renommage", ancien: enEdition, nom: valeur, ajustement });
  }

  function retirer(compte: string) {
    if (transactions.some((t) => t.compte === compte)) {
      setErreur("Ce compte contient des opérations : il ne peut pas être supprimé.");
      return;
    }
    if (transferts.some((t) => t.source === compte || t.destination === compte)) {
      setErreur("Ce compte est lié à des transferts : il ne peut pas être supprimé.");
      return;
    }
    if ((soldesParCompte[compte] ?? 0) !== 0) {
      setErreur("Videz d'abord ce compte : son solde n'est pas nul.");
      return;
    }
    setDemande({ type: "suppression", nom: compte });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "creation") {
      ajouterCompte(demande.nom, demande.disponible);
      if (demande.solde > 0) {
        ajouterTransaction({
          type: "revenu",
          montant: demande.solde,
          libelle: "SOLDE INITIAL",
          categorie: "Autre",
          compte: demande.nom,
          date: new Date().toISOString().slice(0, 10),
        });
      }
      toast.success(`Compte « ${demande.nom} » ajouté.`);
    } else if (demande.type === "renommage") {
      if (demande.nom !== demande.ancien) renommerCompte(demande.ancien, demande.nom);
      if (demande.ajustement !== 0) {
        ajouterTransaction({
          type: demande.ajustement > 0 ? "revenu" : "depense",
          montant: Math.abs(demande.ajustement),
          libelle: "AJUSTEMENT DE SOLDE",
          categorie: "Autre",
          compte: demande.nom,
          date: new Date().toISOString().slice(0, 10),
        });
      }
      toast.success("Compte modifié.");
    } else {
      supprimerCompte(demande.nom);
      toast.success("Compte supprimé.");
    }
    setDemande(null);
    fermer();
  }

  const danger = demande?.type === "suppression";
  const titre =
    demande?.type === "creation"
      ? "Confirmer la création"
      : demande?.type === "renommage"
        ? "Confirmer la modification"
        : "Supprimer ce compte ?";
  const message =
    demande?.type === "creation"
      ? "Vérifiez le nom du nouveau compte avant de valider."
      : demande?.type === "renommage"
        ? "Vérifiez le nouveau nom du compte avant de valider."
        : demande?.type === "suppression"
          ? `Le compte « ${demande.nom} » sera définitivement supprimé. Cette action est irréversible.`
          : "";

  return (
    <div className="page-anim space-y-5">
      <BoutonRetour to="/comptes/" label="Retour aux comptes" />

      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Action</h2>

        <div className="space-y-3">
          <button
            type="button"
            onClick={ouvrirCreation}
            className="carte flex w-full items-center gap-3 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/40 active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus aria-hidden className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Créer un nouveau compte</p>
              <p className="text-sm text-muted-foreground">
                Banque, mobile money, espèces, tontine…
              </p>
            </div>
          </button>
        </div>
      </section>

      <section className="carte space-y-3 p-4">
        <div>
          <h2 className="text-lg font-semibold">Comptes existants</h2>
          <p className="text-sm text-muted-foreground">
            Renommez ou supprimez un compte. Un compte lié à des opérations ne peut pas être
            supprimé.
          </p>
        </div>

        {comptes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {comptes.map((c) => (
              <li
                key={c}
                className="rounded-xl border border-border/70 bg-secondary/40 p-3 transition-colors hover:bg-secondary"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Wallet aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFCFA(soldesParCompte[c] ?? 0)}
                        {comptesExclus.includes(c) ? " · hors solde disponible" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => ouvrirModification(c)}
                      aria-label={`Modifier ${c}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent/40"
                    >
                      <PencilLine className="h-3.5 w-3.5" aria-hidden /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => retirer(c)}
                      aria-label={`Supprimer ${c}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Supprimer
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={modal === "creer" ? "Créer un nouveau compte" : "Modifier le compte"}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={fermer}
        >
          <div
            className="carte popup-anim w-full max-w-md space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold">
                  {modal === "creer" ? "Nouveau compte" : "Modifier le compte"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {modal === "creer"
                    ? "Créez un compte du foyer."
                    : `Renommez le compte « ${enEdition} ».`}
                </p>
              </div>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="rounded-full p-1.5 transition-colors hover:bg-secondary"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            <DicteeChamp
              titre="Dicter le compte"
              exemple="compte mobile money avec un solde initial de 25000 francs"
              onTexte={auTexteDicte}
            />

            <form onSubmit={soumettre} className="space-y-3">
              <div>
                <label htmlFor="c-nom" className="text-sm font-medium">
                  Nom du compte
                </label>
                <input
                  id="c-nom"
                  autoFocus
                  value={nom}
                  onChange={(ev) => setNom(ev.target.value)}
                  placeholder="Tontine du quartier"
                  className={champ}
                />
                <p className="mt-1 text-xs text-muted-foreground">30 caractères maximum.</p>
              </div>

              <div>
                <label htmlFor="c-solde" className="text-sm font-medium">
                  {modal === "creer" ? "Solde initial (FCFA)" : "Solde actuel (FCFA)"}
                </label>
                <input
                  id="c-solde"
                  inputMode="numeric"
                  value={solde}
                  onChange={(ev) => setSolde(ev.target.value)}
                  placeholder="0"
                  className={champ}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {modal === "creer"
                    ? "Laissez 0 si le compte est vide."
                    : "Une correction crée une opération d'ajustement."}
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-input bg-background/60 p-3">
                <input
                  type="checkbox"
                  checked={disponible}
                  onChange={(ev) => setDisponible(ev.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    Compter ce compte dans le solde disponible
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Décochez pour une épargne, une caisse ou un compte diamant : son solde et les
                    enveloppes alimentées par ce compte resteront hors du solde disponible.
                  </span>
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
                >
                  {modal === "creer" ? "Ajouter" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={fermer}
                  className="flex-1 rounded-xl border border-input py-3 font-medium transition-colors hover:bg-accent/40"
                >
                  Annuler
                </button>
              </div>
            </form>
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
        titre={titre}
        message={message}
        details={
          demande?.type === "creation"
            ? [
                { label: "Nom", apres: demande.nom },
                { label: "Solde initial", apres: formatFCFA(demande.solde) },
                {
                  label: "Solde disponible",
                  apres: demande.disponible ? "Compté" : "Exclu",
                },
              ]
            : demande?.type === "renommage"
              ? [
                  { label: "Nom", avant: demande.ancien, apres: demande.nom },
                  {
                    label: "Solde",
                    avant: formatFCFA(soldesParCompte[demande.ancien] ?? 0),
                    apres: formatFCFA(
                      (soldesParCompte[demande.ancien] ?? 0) + demande.ajustement,
                    ),
                  },
                ]
              : demande?.type === "suppression"
                ? [
                    { label: "Compte", apres: demande.nom },
                    { label: "Solde", apres: formatFCFA(soldesParCompte[demande.nom] ?? 0) },
                  ]
                : []
        }
        confirmerLabel={
          danger ? "Supprimer" : demande?.type === "creation" ? "Créer" : "Enregistrer"
        }
        danger={danger}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
