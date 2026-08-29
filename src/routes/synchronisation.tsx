import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Copy,
  Download,
  History,
  Mail,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { useSuperApp } from "@/lib/store";
import { horodatageFichier, telecharger } from "@/lib/sauvegarde";
import {
  ecrireReglagesSync,
  fabriquerColis,
  fusionnerNoms,
  fusionnerParId,
  lienEmail,
  lireReglagesSync,
  ouvrirColis,
  REGLAGES_SYNC_INITIAUX,
  type ColisSync,
  type ReglagesSync,
} from "@/lib/sync-email";

export const Route = createFileRoute("/synchronisation")({
  head: () => ({
    meta: [
      { title: "Synchronisation chiffrée par e-mail — SUPER APP" },
      {
        name: "description",
        content:
          "Envoyez un colis chiffré par e-mail et fusionnez vos opérations entre deux appareils, sans serveur ni compte externe.",
      },
      { property: "og:title", content: "Synchronisation chiffrée par e-mail" },
      {
        property: "og:description",
        content:
          "Colis chiffré AES-GCM envoyé par e-mail, fusion sans doublon et historique des échanges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSynchronisation;
});

type Attente =
  | { genre: "fusion"; colis: ColisSync; apercu: { label: string; apres: string }[] }
  | { genre: "viderHistorique" };

function PageSynchronisation() {
  const app = useSuperApp();
  const [reglages, setReglages] = useState<ReglagesSync>(() =>
    typeof window === "undefined" ? REGLAGES_SYNC_INITIAUX : lireReglagesSync(),
  );
  const [phrase, setPhrase] = useState("");
  const [colisGenere, setColisGenere] = useState("");
  const [colisRecu, setColisRecu] = useState("");
  const [phraseRecu, setPhraseRecu] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [attente, setAttente] = useState<Attente | null>(null);

  const total = useMemo(
    () =>
      app.transactions.length +
      app.transferts.length +
      app.budgets.length +
      app.dettes.length +
      app.enveloppes.length,
    [app],
  );

  function enregistrer(r: ReglagesSync) {
    setReglages(r);
    ecrireReglagesSync(r);
  }

  async function genererColis() {
    if (phrase.length < 6) {
      setErreur("La phrase secrète de synchronisation doit contenir au moins 6 caractères.");
      return;
    }
    const etat = app.etatComplet();
    const colis: ColisSync = {
      appareil: reglages.appareil || "APPAREIL",
      creeLe: new Date().toISOString(),
      transactions: etat.transactions,
      transferts: etat.transferts,
      enveloppes: etat.enveloppes,
      categories: etat.categories,
      comptes: etat.comptes,
      budgets: etat.budgets,
      dettes: etat.dettes,
    };
    try {
      const texte = await fabriquerColis(colis, phrase);
      setColisGenere(texte);
      enregistrer({
        ...reglages,
        dernierEnvoi: new Date().toISOString(),
        historique: [
          {
            id: crypto.randomUUID(),
            sens: "envoi",
            date: new Date().toISOString(),
            appareil: colis.appareil,
            elements: total,
            detail: `${etat.transactions.length} opérations, ${etat.budgets.length} planifications`,
          },
          ...reglages.historique,
        ],
      });
      setInfo("Colis chiffré prêt : envoyez-le par e-mail ou copiez-le.");
    } catch {
      setErreur("La génération du colis a échoué sur cet appareil.");
    }
  }

  async function copierColis() {
    try {
      await navigator.clipboard.writeText(colisGenere);
      setInfo("Colis copié dans le presse-papiers.");
    } catch {
      setErreur("Copie impossible : sélectionnez le texte manuellement.");
    }
  }

  function envoyerParEmail() {
    if (!reglages.email.includes("@")) {
      setErreur("Renseignez d'abord une adresse e-mail valide.");
      return;
    }
    window.location.href = lienEmail(reglages.email, reglages.appareil, colisGenere);
  }

  async function preparerFusion() {
    if (!colisRecu.trim()) {
      setErreur("Collez d'abord le colis reçu par e-mail.");
      return;
    }
    if (!phraseRecu) {
      setErreur("Saisissez la phrase secrète utilisée sur l'autre appareil.");
      return;
    }
    try {
      const colis = await ouvrirColis(colisRecu, phraseRecu);
      const apercu = [
        {
          label: "Opérations nouvelles",
          apres: String(
            fusionnerParId(app.transactions, (colis.transactions ?? []) as never[]).ajoutes,
          ),
        },
        {
          label: "Transferts nouveaux",
          apres: String(
            fusionnerParId(app.transferts, (colis.transferts ?? []) as never[]).ajoutes,
          ),
        },
        {
          label: "Enveloppes nouvelles",
          apres: String(
            fusionnerParId(app.enveloppes, (colis.enveloppes ?? []) as never[]).ajoutes,
          ),
        },
        {
          label: "Planifications nouvelles",
          apres: String(fusionnerParId(app.budgets, (colis.budgets ?? []) as never[]).ajoutes),
        },
        {
          label: "Dettes nouvelles",
          apres: String(fusionnerParId(app.dettes, (colis.dettes ?? []) as never[]).ajoutes),
        },
        {
          label: "Comptes nouveaux",
          apres: String(fusionnerNoms(app.comptes, colis.comptes ?? []).ajoutes),
        },
        { label: "Appareil source", apres: colis.appareil ?? "inconnu" },
      ];
      setAttente({ genre: "fusion", colis, apercu });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Colis illisible.");
    }
  }

  function confirmer() {
    if (!attente) return;
    if (attente.genre === "viderHistorique") {
      enregistrer({ ...reglages, historique: [] });
      setAttente(null);
      return;
    }
    const c = attente.colis;
    const transactions = fusionnerParId(app.transactions, (c.transactions ?? []) as never[]);
    const transferts = fusionnerParId(app.transferts, (c.transferts ?? []) as never[]);
    const enveloppes = fusionnerParId(app.enveloppes, (c.enveloppes ?? []) as never[]);
    const categories = fusionnerParId(app.categories, (c.categories ?? []) as never[]);
    const budgets = fusionnerParId(app.budgets, (c.budgets ?? []) as never[]);
    const dettes = fusionnerParId(app.dettes, (c.dettes ?? []) as never[]);
    const comptes = fusionnerNoms(app.comptes, c.comptes ?? []);
    app.remplacerEtat({
      transactions: transactions.liste,
      transferts: transferts.liste,
      enveloppes: enveloppes.liste,
      categories: categories.liste,
      budgets: budgets.liste,
      dettes: dettes.liste,
      comptes: comptes.liste,
    });
    const ajoutes =
      transactions.ajoutes +
      transferts.ajoutes +
      enveloppes.ajoutes +
      budgets.ajoutes +
      dettes.ajoutes;
    enregistrer({
      ...reglages,
      dernierImport: new Date().toISOString(),
      historique: [
        {
          id: crypto.randomUUID(),
          sens: "import",
          date: new Date().toISOString(),
          appareil: c.appareil ?? "inconnu",
          elements: ajoutes,
          detail: `${transactions.ajoutes} opérations, ${budgets.ajoutes} planifications`,
        },
        ...reglages.historique,
      ],
    });
    setInfo(`Fusion terminée : ${ajoutes} élément(s) ajouté(s), aucun doublon.`);
    setColisRecu("");
    setAttente(null);
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2">
        <BoutonRetour to="/parametres" label="Retour aux paramètres" />
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <RefreshCw className="h-6 w-6 text-primary" aria-hidden />
          Synchronisation par e-mail
        </h1>
        <p className="text-sm text-muted-foreground">
          Vos données partent chiffrées dans le corps d'un e-mail que vous envoyez vous-même.
          L'autre appareil colle le colis, saisit la phrase secrète et fusionne sans doublon.
        </p>
      </header>

      {info ? (
        <p className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">{info}</p>
      ) : null}

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Smartphone className="h-4 w-4 text-primary" aria-hidden /> Cet appareil
        </h2>
        <label className="block text-sm font-medium" htmlFor="appareil">
          Nom de l'appareil
        </label>
        <input
          id="appareil"
          value={reglages.appareil}
          onChange={(e) => enregistrer({ ...reglages, appareil: e.target.value })}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <label className="block text-sm font-medium" htmlFor="email">
          Adresse e-mail de destination
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          value={reglages.email}
          onChange={(e) => enregistrer({ ...reglages, email: e.target.value })}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
          placeholder="MOI@EXEMPLE.COM"
        />
        <p className="text-xs text-muted-foreground">
          Dernier envoi :{" "}
          {reglages.dernierEnvoi
            ? new Date(reglages.dernierEnvoi).toLocaleString("fr-FR")
            : "jamais"}{" "}
          · Dernier import :{" "}
          {reglages.dernierImport
            ? new Date(reglages.dernierImport).toLocaleString("fr-FR")
            : "jamais"}
        </p>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Send className="h-4 w-4 text-primary" aria-hidden /> Envoyer mes données
        </h2>
        <label className="block text-sm font-medium" htmlFor="phrase-sync">
          Phrase secrète de synchronisation
        </label>
        <input
          id="phrase-sync"
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
          placeholder="Au moins 6 caractères"
        />
        <p className="text-xs text-muted-foreground">
          Utilisez exactement la même phrase sur les deux appareils. {total} élément(s) seront
          inclus.
        </p>
        <button
          type="button"
          onClick={() => void genererColis()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Générer le colis chiffré
        </button>

        {colisGenere ? (
          <>
            <textarea
              readOnly
              value={colisGenere}
              rows={5}
              aria-label="Colis chiffré généré"
              className="w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-[10px]"
            />
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={envoyerParEmail}
                className="flex items-center justify-center gap-1 rounded-xl border border-input px-2 py-2 text-xs font-semibold"
              >
                <Mail className="h-4 w-4" aria-hidden /> E-mail
              </button>
              <button
                type="button"
                onClick={() => void copierColis()}
                className="flex items-center justify-center gap-1 rounded-xl border border-input px-2 py-2 text-xs font-semibold"
              >
                <Copy className="h-4 w-4" aria-hidden /> Copier
              </button>
              <button
                type="button"
                onClick={() =>
                  telecharger(
                    `superapp-colis-${horodatageFichier()}.txt`,
                    colisGenere,
                    "text/plain;charset=utf-8",
                  )
                }
                className="flex items-center justify-center gap-1 rounded-xl border border-input px-2 py-2 text-xs font-semibold"
              >
                <Download className="h-4 w-4" aria-hidden /> Fichier
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail className="h-4 w-4 text-primary" aria-hidden /> Recevoir et fusionner
        </h2>
        <label className="block text-sm font-medium" htmlFor="colis-recu">
          Colis reçu par e-mail
        </label>
        <textarea
          id="colis-recu"
          rows={5}
          value={colisRecu}
          onChange={(e) => setColisRecu(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-[10px]"
          placeholder="Collez ici le bloc reçu"
        />
        <label className="block text-sm font-medium" htmlFor="phrase-recu">
          Phrase secrète de l'autre appareil
        </label>
        <input
          id="phrase-recu"
          type="password"
          value={phraseRecu}
          onChange={(e) => setPhraseRecu(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void preparerFusion()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Vérifier et fusionner
        </button>
        <p className="text-xs text-muted-foreground">
          La fusion ajoute uniquement ce qui manque : rien n'est écrasé ni dupliqué.
        </p>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="h-4 w-4 text-primary" aria-hidden /> Historique des échanges
        </h2>
        {reglages.historique.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun échange pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {reglages.historique.map((h) => (
              <li key={h.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                <span className="font-semibold">
                  {h.sens === "envoi" ? "Envoi" : "Import"} · {h.appareil}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(h.date).toLocaleString("fr-FR")} · {h.elements} élément(s) · {h.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
        {reglages.historique.length > 0 ? (
          <button
            type="button"
            onClick={() => setAttente({ genre: "viderHistorique" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Vider l'historique
          </button>
        ) : null}
      </section>

      <Confirmation
        ouvert={attente !== null}
        titre={attente?.genre === "fusion" ? "Confirmer la fusion" : "Vider l'historique"}
        message={
          attente?.genre === "fusion"
            ? "Les éléments listés ci-dessous seront ajoutés à cet appareil. Les données existantes sont conservées."
            : "L'historique des échanges sera effacé de cet appareil."
        }
        details={attente?.genre === "fusion" ? attente.apercu : undefined}
        confirmerLabel={attente?.genre === "fusion" ? "Fusionner" : "Vider"}
        danger={attente?.genre !== "fusion"}
        onConfirmer={confirmer}
        onAnnuler={() => setAttente(null)}
      />

      <ErreurPopup ouvert={erreur !== ""} message={erreur} onFermer={() => setErreur("")} />
    </div>
  );
}
