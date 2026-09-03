import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Copy,
  Download,
  History,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { SectionSyncAuto } from "@/components/SectionSyncAuto";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { useSuperApp } from "@/lib/store";
import { horodatageFichier, telecharger } from "@/lib/sauvegarde";
import {
  ecrireReglagesSync,
  fusionnerNoms,
  lienEmail,
  lireReglagesSync,
  REGLAGES_SYNC_INITIAUX,
  type ColisSync,
  type ReglagesSync,
} from "@/lib/sync-email";
import {
  detecterConflits,
  ecrireReglagesPlus,
  evaluerRappel,
  fabriquerColisPlus,
  filtrerDepuis,
  fusionnerAvecChoix,
  lireReglagesPlus,
  nouvelIdentifiant,
  ouvrirColisPlus,
  REGLAGES_PLUS_INITIAUX,
  SELECTION_COMPLETE,
  TYPES_DONNEES,
  type Appareil,
  type ChoixConflit,
  type Conflit,
  type FrequenceSync,
  type InfosColis,
  type ReglagesSyncPlus,
  type Selection,
  type TypeDonnees,
} from "@/lib/sync-plus";

export const Route = createFileRoute("/synchronisation")({
  head: () => ({
    meta: [
      { title: "Synchronisation chiffrée par e-mail — SUPER APP" },
      {
        name: "description",
        content:
          "Envoyez un colis chiffré par e-mail, gérez plusieurs appareils partenaires et fusionnez vos données avec détection de conflits.",
      },
      { property: "og:title", content: "Synchronisation chiffrée par e-mail" },
      {
        property: "og:description",
        content:
          "Colis chiffré AES-GCM, compression, empreinte d'intégrité, fusion sélective et historique des échanges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSynchronisation,
});

type Attente =
  | {
      genre: "fusion";
      colis: ColisSync;
      apercu: { label: string; apres: string }[];
    }
  | { genre: "viderHistorique" }
  | { genre: "ajoutAppareil"; appareil: Appareil }
  | { genre: "supprimerAppareil"; appareil: Appareil }
  | { genre: "rotationPhrase"; appareil: Appareil; indice: string };

const FREQUENCES: { id: FrequenceSync; label: string }[] = [
  { id: "jamais", label: "Aucun rappel" },
  { id: "quotidienne", label: "Quotidienne" },
  { id: "hebdomadaire", label: "Hebdomadaire" },
  { id: "mensuelle", label: "Mensuelle" },
];

const champ = "w-full rounded-xl border border-input bg-card px-3 py-2 text-sm";

function PageSynchronisation() {
  const app = useSuperApp();
  const [reglages, setReglages] = useState<ReglagesSync>(() =>
    typeof window === "undefined" ? REGLAGES_SYNC_INITIAUX : lireReglagesSync(),
  );
  const [plus, setPlus] = useState<ReglagesSyncPlus>(() =>
    typeof window === "undefined" ? REGLAGES_PLUS_INITIAUX : lireReglagesPlus(),
  );

  const [phrase, setPhrase] = useState("");
  const [colisGenere, setColisGenere] = useState<InfosColis | null>(null);
  const [colisRecu, setColisRecu] = useState("");
  const [phraseRecu, setPhraseRecu] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [attente, setAttente] = useState<Attente | null>(null);

  const [selection, setSelection] = useState<Selection>({ ...SELECTION_COMPLETE });
  const [conflits, setConflits] = useState<Conflit[]>([]);
  const [choix, setChoix] = useState<Record<string, ChoixConflit>>({});

  const [nouvNom, setNouvNom] = useState("");
  const [nouvEmail, setNouvEmail] = useState("");
  const [nouvIndice, setNouvIndice] = useState("");
  const [formulaireAppareil, setFormulaireAppareil] = useState(false);
  const [rotation, setRotation] = useState("");

  const rappel = useMemo(() => evaluerRappel(plus), [plus]);

  const total = useMemo(
    () =>
      app.transactions.length +
      app.transferts.length +
      app.budgets.length +
      app.dettes.length +
      app.enveloppes.length,
    [app],
  );

  const appareilActif = useMemo(
    () => plus.appareils.find((a) => a.id === plus.appareilActifId) ?? plus.appareils[0],
    [plus],
  );

  function enregistrer(r: ReglagesSync) {
    setReglages(r);
    ecrireReglagesSync(r);
  }

  function enregistrerPlus(p: ReglagesSyncPlus) {
    setPlus(p);
    ecrireReglagesPlus(p);
  }

  /* ---------------- Génération du colis ---------------- */

  async function genererColis() {
    if (phrase.length < 6) {
      setErreur("La phrase secrète de synchronisation doit contenir au moins 6 caractères.");
      return;
    }
    const etat = app.etatComplet();
    const borne = plus.differentiel ? plus.dernierEnvoiGlobal : undefined;
    const colis: ColisSync = {
      appareil: reglages.appareil || "APPAREIL",
      creeLe: new Date().toISOString(),
      transactions: filtrerDepuis(etat.transactions, borne),
      transferts: filtrerDepuis(etat.transferts, borne),
      enveloppes: etat.enveloppes,
      categories: etat.categories,
      comptes: etat.comptes,
      budgets: filtrerDepuis(etat.budgets, borne),
      dettes: filtrerDepuis(etat.dettes, borne),
    };
    try {
      const infos = await fabriquerColisPlus(colis, phrase, { compresser: plus.compresser });
      setColisGenere(infos);
      const maintenant = new Date().toISOString();
      enregistrer({
        ...reglages,
        dernierEnvoi: maintenant,
        historique: [
          {
            id: nouvelIdentifiant(),
            sens: "envoi",
            date: maintenant,
            appareil: colis.appareil,
            elements: total,
            detail: `${colis.transactions.length} opérations · ${colis.budgets.length} planifications · empreinte ${infos.empreinte.slice(0, 8)}`,
          },
          ...reglages.historique,
        ],
      });
      enregistrerPlus({
        ...plus,
        dernierEnvoiGlobal: maintenant,
        appareils: plus.appareils.map((a) =>
          a.id === appareilActif?.id ? { ...a, dernierEnvoi: maintenant } : a,
        ),
      });
      setInfo(
        `Colis prêt (${infos.compresse ? "compressé" : "non compressé"}, ${infos.taille} caractères, empreinte ${infos.empreinte.slice(0, 8)}).`,
      );
    } catch {
      setErreur("La génération du colis a échoué sur cet appareil.");
    }
  }

  async function copierColis() {
    if (!colisGenere) return;
    try {
      await navigator.clipboard.writeText(colisGenere.texte);
      setInfo("Colis copié dans le presse-papiers.");
    } catch {
      setErreur("Copie impossible : sélectionnez le texte manuellement.");
    }
  }

  function envoyerParEmail() {
    const destinataire = appareilActif?.email || reglages.email;
    if (!destinataire.includes("@")) {
      setErreur("Renseignez d'abord une adresse e-mail valide.");
      return;
    }
    if (!colisGenere) return;
    window.location.href = lienEmail(destinataire, reglages.appareil, colisGenere.texte);
  }

  /* ---------------- Réception et fusion ---------------- */

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
      const { colis, empreinte } = await ouvrirColisPlus(colisRecu, phraseRecu);
      const tousConflits: Conflit[] = [
        ...detecterConflits(
          "transactions",
          app.transactions,
          (colis.transactions ?? []) as never[],
        ),
        ...detecterConflits("transferts", app.transferts, (colis.transferts ?? []) as never[]),
        ...detecterConflits("enveloppes", app.enveloppes, (colis.enveloppes ?? []) as never[]),
        ...detecterConflits("categories", app.categories, (colis.categories ?? []) as never[]),
        ...detecterConflits("budgets", app.budgets, (colis.budgets ?? []) as never[]),
        ...detecterConflits("dettes", app.dettes, (colis.dettes ?? []) as never[]),
      ].filter((c) => selection[c.type]);
      setConflits(tousConflits);
      setChoix(Object.fromEntries(tousConflits.map((c) => [c.cle, "local" as ChoixConflit])));

      const apercu: { label: string; apres: string }[] = [];
      const compte = (type: TypeDonnees, actuel: { id: string }[], entrant: unknown[]) =>
        selection[type]
          ? fusionnerAvecChoix(type, actuel as never[], (entrant ?? []) as never[], {}).ajoutes
          : 0;
      apercu.push({
        label: "Opérations nouvelles",
        apres: String(compte("transactions", app.transactions, colis.transactions)),
      });
      apercu.push({
        label: "Transferts nouveaux",
        apres: String(compte("transferts", app.transferts, colis.transferts)),
      });
      apercu.push({
        label: "Enveloppes nouvelles",
        apres: String(compte("enveloppes", app.enveloppes, colis.enveloppes)),
      });
      apercu.push({
        label: "Planifications nouvelles",
        apres: String(compte("budgets", app.budgets, colis.budgets)),
      });
      apercu.push({
        label: "Dettes nouvelles",
        apres: String(compte("dettes", app.dettes, colis.dettes)),
      });
      apercu.push({
        label: "Comptes nouveaux",
        apres: String(
          selection.comptes ? fusionnerNoms(app.comptes, colis.comptes ?? []).ajoutes : 0,
        ),
      });
      apercu.push({ label: "Conflits détectés", apres: String(tousConflits.length) });
      apercu.push({ label: "Empreinte vérifiée", apres: empreinte.slice(0, 16) });
      apercu.push({ label: "Appareil source", apres: colis.appareil ?? "inconnu" });

      setAttente({ genre: "fusion", colis, apercu });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Colis illisible.");
    }
  }

  function appliquerFusion(c: ColisSync) {
    const maj: Record<string, unknown> = {};
    let ajoutes = 0;
    let remplaces = 0;
    const traiter = (type: TypeDonnees, actuel: { id: string }[], entrant: unknown[]) => {
      if (!selection[type]) return;
      const r = fusionnerAvecChoix(type, actuel as never[], (entrant ?? []) as never[], choix);
      maj[type] = r.liste;
      ajoutes += r.ajoutes;
      remplaces += r.remplaces;
    };
    traiter("transactions", app.transactions, c.transactions);
    traiter("transferts", app.transferts, c.transferts);
    traiter("enveloppes", app.enveloppes, c.enveloppes);
    traiter("categories", app.categories, c.categories);
    traiter("budgets", app.budgets, c.budgets);
    traiter("dettes", app.dettes, c.dettes);
    if (selection.comptes) {
      maj["comptes"] = fusionnerNoms(app.comptes, c.comptes ?? []).liste;
    }
    app.remplacerEtat(maj as never);

    const maintenant = new Date().toISOString();
    enregistrer({
      ...reglages,
      dernierImport: maintenant,
      historique: [
        {
          id: nouvelIdentifiant(),
          sens: "import",
          date: maintenant,
          appareil: c.appareil ?? "inconnu",
          elements: ajoutes,
          detail: `${ajoutes} ajout(s) · ${remplaces} remplacement(s) · ${conflits.length} conflit(s)`,
        },
        ...reglages.historique,
      ],
    });
    enregistrerPlus({
      ...plus,
      appareils: plus.appareils.map((a) =>
        a.nom.toLowerCase() === String(c.appareil ?? "").toLowerCase()
          ? { ...a, dernierImport: maintenant }
          : a,
      ),
    });
    setInfo(`Fusion terminée : ${ajoutes} ajout(s), ${remplaces} remplacement(s).`);
    setColisRecu("");
    setConflits([]);
    setChoix({});
  }

  /* ---------------- Appareils partenaires ---------------- */

  function demanderAjoutAppareil() {
    const nom = nouvNom.trim();
    if (!nom) {
      setErreur("Donnez un nom à l'appareil partenaire.");
      return;
    }
    if (plus.appareils.some((a) => a.nom.toLowerCase() === nom.toLowerCase())) {
      setErreur("Un appareil partenaire porte déjà ce nom.");
      return;
    }
    if (!nouvEmail.includes("@")) {
      setErreur("Renseignez une adresse e-mail valide pour cet appareil.");
      return;
    }
    setAttente({
      genre: "ajoutAppareil",
      appareil: {
        id: nouvelIdentifiant(),
        nom,
        email: nouvEmail.trim(),
        indicePhrase: nouvIndice.trim() || undefined,
        creeLe: new Date().toISOString(),
      },
    });
  }

  function confirmer() {
    if (!attente) return;
    if (attente.genre === "viderHistorique") {
      enregistrer({ ...reglages, historique: [] });
    } else if (attente.genre === "fusion") {
      appliquerFusion(attente.colis);
    } else if (attente.genre === "ajoutAppareil") {
      enregistrerPlus({
        ...plus,
        appareils: [...plus.appareils, attente.appareil],
        appareilActifId: plus.appareilActifId ?? attente.appareil.id,
      });
      setNouvNom("");
      setNouvEmail("");
      setNouvIndice("");
      setFormulaireAppareil(false);
      setInfo(`Appareil partenaire « ${attente.appareil.nom} » enregistré.`);
    } else if (attente.genre === "supprimerAppareil") {
      const restants = plus.appareils.filter((a) => a.id !== attente.appareil.id);
      enregistrerPlus({
        ...plus,
        appareils: restants,
        appareilActifId:
          plus.appareilActifId === attente.appareil.id ? restants[0]?.id : plus.appareilActifId,
      });
    } else if (attente.genre === "rotationPhrase") {
      enregistrerPlus({
        ...plus,
        appareils: plus.appareils.map((a) =>
          a.id === attente.appareil.id ? { ...a, indicePhrase: attente.indice } : a,
        ),
      });
      setRotation("");
      setInfo(
        "Indice de phrase mis à jour : utilisez la nouvelle phrase sur les deux appareils au prochain échange.",
      );
    }
    setAttente(null);
  }

  const titreAttente =
    attente?.genre === "fusion"
      ? "Confirmer la fusion"
      : attente?.genre === "viderHistorique"
        ? "Vider l'historique"
        : attente?.genre === "ajoutAppareil"
          ? "Enregistrer l'appareil partenaire"
          : attente?.genre === "supprimerAppareil"
            ? "Supprimer l'appareil partenaire"
            : "Changer la phrase secrète";

  const messageAttente =
    attente?.genre === "fusion"
      ? "Les éléments ci-dessous seront ajoutés. Les conflits suivent vos choix ; rien d'autre n'est écrasé."
      : attente?.genre === "viderHistorique"
        ? "L'historique des échanges sera effacé de cet appareil."
        : attente?.genre === "ajoutAppareil"
          ? "Cet appareil sera enregistré comme destinataire de vos colis chiffrés."
          : attente?.genre === "supprimerAppareil"
            ? "Cet appareil partenaire ne recevra plus vos colis."
            : "L'indice de phrase secrète de cet appareil sera remplacé.";

  const detailsAttente =
    attente?.genre === "fusion"
      ? attente.apercu
      : attente?.genre === "ajoutAppareil"
        ? [
            { label: "Nom", apres: attente.appareil.nom },
            { label: "E-mail", apres: attente.appareil.email },
            { label: "Indice de phrase", apres: attente.appareil.indicePhrase ?? "aucun" },
          ]
        : attente?.genre === "supprimerAppareil"
          ? [
              { label: "Appareil", apres: attente.appareil.nom },
              { label: "E-mail", apres: attente.appareil.email },
            ]
          : attente?.genre === "rotationPhrase"
            ? [
                { label: "Appareil", apres: attente.appareil.nom },
                {
                  label: "Indice",
                  avant: attente.appareil.indicePhrase ?? "aucun",
                  apres: attente.indice || "aucun",
                },
              ]
            : undefined;

  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <RefreshCw className="h-6 w-6 text-primary" aria-hidden />
          Synchronisation par e-mail
        </h1>
        <p className="text-sm text-muted-foreground">
          Vos données partent chiffrées dans le corps d'un e-mail que vous envoyez vous-même.
          L'autre appareil colle le colis, vérifie l'empreinte et fusionne sans doublon.
        </p>
      </header>

      <SectionSyncAuto />

      {rappel.enAttente || rappel.alerteSilence ? (
        <p
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
            rappel.alerteSilence
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-primary/40 bg-primary/10"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {rappel.alerteSilence ? "Synchronisation en retard" : "Synchronisation en attente"} —{" "}
            {rappel.message}
          </span>
        </p>
      ) : null}

      {info ? (
        <p className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {info}
        </p>
      ) : null}

      {/* Cet appareil */}
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
          className={champ}
        />
        <label className="block text-sm font-medium" htmlFor="email">
          Adresse e-mail par défaut
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          value={reglages.email}
          onChange={(e) => enregistrer({ ...reglages, email: e.target.value })}
          className={champ}
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

      {/* Appareils partenaires */}
      <section className="carte space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Smartphone className="h-4 w-4 text-primary" aria-hidden /> Appareils partenaires
          </h2>
          <button
            type="button"
            onClick={() => setFormulaireAppareil((v) => !v)}
            className="flex items-center gap-1 rounded-xl border border-input px-2 py-1 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Ajouter
          </button>
        </div>

        {formulaireAppareil ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <input
              value={nouvNom}
              onChange={(e) => setNouvNom(e.target.value)}
              className={champ}
              placeholder="NOM DE L'APPAREIL"
              aria-label="Nom de l'appareil partenaire"
            />
            <input
              type="email"
              inputMode="email"
              value={nouvEmail}
              onChange={(e) => setNouvEmail(e.target.value)}
              className={champ}
              placeholder="ADRESSE@EXEMPLE.COM"
              aria-label="E-mail de l'appareil partenaire"
            />
            <input
              value={nouvIndice}
              onChange={(e) => setNouvIndice(e.target.value)}
              className={champ}
              placeholder="Indice de phrase secrète (facultatif)"
              aria-label="Indice de phrase secrète"
            />
            <button
              type="button"
              onClick={demanderAjoutAppareil}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Enregistrer cet appareil
            </button>
          </div>
        ) : null}

        {plus.appareils.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun appareil partenaire enregistré.</p>
        ) : (
          <ul className="space-y-2">
            {plus.appareils.map((a) => (
              <li key={a.id} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {a.nom}
                      {appareilActif?.id === a.id ? " · destinataire actif" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.email} · indice : {a.indicePhrase || "aucun"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Envoi :{" "}
                      {a.dernierEnvoi ? new Date(a.dernierEnvoi).toLocaleDateString("fr-FR") : "—"}{" "}
                      · Import :{" "}
                      {a.dernierImport
                        ? new Date(a.dernierImport).toLocaleDateString("fr-FR")
                        : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttente({ genre: "supprimerAppareil", appareil: a })}
                    className="rounded-lg border border-destructive/40 p-1.5 text-destructive"
                    aria-label={`Supprimer ${a.nom}`}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => enregistrerPlus({ ...plus, appareilActifId: a.id })}
                    className="rounded-xl border border-input px-2 py-1 text-xs font-semibold"
                  >
                    Choisir comme destinataire
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAttente({ genre: "rotationPhrase", appareil: a, indice: rotation.trim() })
                    }
                    className="flex items-center gap-1 rounded-xl border border-input px-2 py-1 text-xs font-semibold"
                  >
                    <KeyRound className="h-3.5 w-3.5" aria-hidden /> Changer la phrase
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {plus.appareils.length > 0 ? (
          <input
            value={rotation}
            onChange={(e) => setRotation(e.target.value)}
            className={champ}
            placeholder="Nouvel indice de phrase secrète"
            aria-label="Nouvel indice de phrase secrète"
          />
        ) : null}
      </section>

      {/* Réglages avancés */}
      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Réglages de synchronisation
        </h2>
        <label className="block text-sm font-medium" htmlFor="frequence">
          Rappel de préparation
        </label>
        <select
          id="frequence"
          value={plus.frequence}
          onChange={(e) => enregistrerPlus({ ...plus, frequence: e.target.value as FrequenceSync })}
          className={champ}
        >
          {FREQUENCES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="block text-sm font-medium" htmlFor="seuil">
          Alerte si aucun échange depuis (jours)
        </label>
        <input
          id="seuil"
          type="number"
          inputMode="numeric"
          min={1}
          value={plus.seuilRappelJours}
          onChange={(e) =>
            enregistrerPlus({
              ...plus,
              seuilRappelJours: Math.max(1, Number(e.target.value) || 1),
            })
          }
          className={champ}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={plus.compresser}
            onChange={(e) => enregistrerPlus({ ...plus, compresser: e.target.checked })}
          />
          Compresser le colis (colis plus court pour l'e-mail)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={plus.differentiel}
            onChange={(e) => enregistrerPlus({ ...plus, differentiel: e.target.checked })}
          />
          Colis différentiel (seulement les nouveautés depuis le dernier envoi)
        </label>
        <p className="text-xs text-muted-foreground">{rappel.message}</p>
      </section>

      {/* Envoi */}
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
          className={champ}
          placeholder="Au moins 6 caractères"
        />
        <p className="text-xs text-muted-foreground">
          Utilisez exactement la même phrase sur les deux appareils. {total} élément(s) disponibles.
          {appareilActif ? ` Destinataire : ${appareilActif.nom} (${appareilActif.email}).` : ""}
          {appareilActif?.indicePhrase ? ` Indice : ${appareilActif.indicePhrase}.` : ""}
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
            <p className="text-xs text-muted-foreground">
              Empreinte d'intégrité : <span className="font-mono">{colisGenere.empreinte}</span> ·{" "}
              {colisGenere.compresse
                ? `compressé (${colisGenere.tailleBrute} → ${colisGenere.taille} caractères)`
                : `${colisGenere.taille} caractères`}
            </p>
            <textarea
              readOnly
              value={colisGenere.texte}
              rows={5}
              aria-label="Colis chiffré généré"
              data-majuscules="non"
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
                    colisGenere.texte,
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

      {/* Réception */}
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
          data-majuscules="non"
        />
        <label className="block text-sm font-medium" htmlFor="phrase-recu">
          Phrase secrète de l'autre appareil
        </label>
        <input
          id="phrase-recu"
          type="password"
          value={phraseRecu}
          onChange={(e) => setPhraseRecu(e.target.value)}
          className={champ}
        />

        <fieldset className="space-y-1 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">Données à fusionner</legend>
          {TYPES_DONNEES.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selection[t.id]}
                onChange={(e) => setSelection({ ...selection, [t.id]: e.target.checked })}
              />
              {t.label}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={() => void preparerFusion()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Vérifier et fusionner
        </button>
        <p className="text-xs text-muted-foreground">
          L'empreinte du colis est vérifiée avant tout déchiffrement. La fusion ajoute ce qui manque
          : rien n'est écrasé sans votre choix.
        </p>

        {conflits.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-destructive/40 p-3">
            <p className="text-sm font-semibold text-destructive">
              {conflits.length} conflit(s) détecté(s) — choisissez la version à conserver
            </p>
            {conflits.map((c) => (
              <div key={c.cle} className="space-y-1 rounded-lg border border-border p-2">
                <p className="text-sm font-semibold">{c.titre}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setChoix({ ...choix, [c.cle]: "local" })}
                    className={`rounded-lg border px-2 py-1 text-left ${
                      choix[c.cle] === "local" ? "border-primary bg-primary/10" : "border-input"
                    }`}
                  >
                    <span className="block font-semibold">Cet appareil</span>
                    {c.local}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoix({ ...choix, [c.cle]: "entrant" })}
                    className={`rounded-lg border px-2 py-1 text-left ${
                      choix[c.cle] === "entrant" ? "border-primary bg-primary/10" : "border-input"
                    }`}
                  >
                    <span className="block font-semibold">Colis reçu</span>
                    {c.entrant}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Historique */}
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
        titre={titreAttente}
        message={messageAttente}
        details={detailsAttente}
        confirmerLabel={
          attente?.genre === "fusion"
            ? "Fusionner"
            : attente?.genre === "supprimerAppareil" || attente?.genre === "viderHistorique"
              ? "Supprimer"
              : "Confirmer"
        }
        danger={attente?.genre === "supprimerAppareil" || attente?.genre === "viderHistorique"}
        onConfirmer={confirmer}
        onAnnuler={() => setAttente(null)}
      />

      <ErreurPopup ouvert={erreur !== ""} message={erreur} onFermer={() => setErreur("")} />
    </div>
  );
}
