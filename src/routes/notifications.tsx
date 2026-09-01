import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  ChevronDown,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  Wallet,
} from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { DiscussionVocaleCoach } from "@/components/DiscussionVocaleCoach";
import { useSuperApp } from "@/lib/store";
import { EXEMPLES_QUESTIONS } from "@/lib/assistant-local";
import { bilansEnveloppes } from "@/lib/coach-enveloppe";
import { arreterLecture, lireAVoixHaute, vocalisationDisponible } from "@/lib/vocalisation";
import {
  apprendreAvis,
  apprendreQuestion,
  ecrireMemoire,
  lireMemoire,
  mettreAJourJournee,
  MEMOIRE_VIDE,
  poidsEnveloppeDe,
  repondreCoach,
  sujetsFavoris,
  type MemoireCoach,
  type MessageCoach,
} from "@/lib/coach";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Messages du conseiller — SUPER APP" },
      {
        name: "description",
        content:
          "Votre conseiller financier vous écrit chaque jour, répond à vos questions écrites ou parlées et suit chaque enveloppe, sans connexion.",
      },
      { property: "og:title", content: "Messages du conseiller — SUPER APP" },
      {
        property: "og:description",
        content: "Notifications et discussion avec votre coach budget, calculées sur votre téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageNotifications,
});

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function jourLisible(iso: string): string {
  const d = new Date(iso);
  const aujourdhui = new Date();
  if (d.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
}

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

function PageNotifications() {
  const {
    transactions,
    enveloppes,
    budgets,
    dettes,
    comptes,
    soldesParCompte,
    depensesParEnveloppe,
    solde,
  } = useSuperApp();

  const [memoire, setMemoire] = useState<MemoireCoach>(MEMOIRE_VIDE);
  const [prete, setPrete] = useState(false);
  const [question, setQuestion] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [lecture, setLecture] = useState<string | null>(null);
  const bas = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const memoireRef = useRef(memoire);
  memoireRef.current = memoire;

  const donneesCoach = useMemo(
    () => ({ transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde }),
    [transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde],
  );
  const donneesCoachRef = useRef(donneesCoach);
  donneesCoachRef.current = donneesCoach;

  const donneesAssistant = useMemo(
    () => ({
      transactions,
      enveloppes,
      dettes,
      comptes,
      soldesParCompte,
      depensesParEnveloppe,
      solde,
    }),
    [transactions, enveloppes, dettes, comptes, soldesParCompte, depensesParEnveloppe, solde],
  );
  const donneesAssistantRef = useRef(donneesAssistant);
  donneesAssistantRef.current = donneesAssistant;

  const bilans = useMemo(
    () => bilansEnveloppes(enveloppes, transactions, depensesParEnveloppe),
    [enveloppes, transactions, depensesParEnveloppe],
  );

  // Chargement de la mémoire chiffrée, puis bilan du jour si nécessaire.
  useEffect(() => {
    let vivant = true;
    void (async () => {
      const chargee = await lireMemoire();
      if (!vivant) return;
      const aJour = mettreAJourJournee(chargee, donneesCoachRef.current);
      const lue: MemoireCoach = {
        ...aJour,
        messages: aJour.messages.map((m) => ({ ...m, lu: true })),
      };
      setMemoire(lue);
      setPrete(true);
      void ecrireMemoire(lue);
    })();
    return () => {
      vivant = false;
    };
    // Un seul passage : le bilan quotidien ne doit pas se régénérer à chaque calcul.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bas.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [memoire.messages.length]);

  const enregistrer = (suivante: MemoireCoach) => {
    setMemoire(suivante);
    memoireRef.current = suivante;
    void ecrireMemoire(suivante);
  };

  /** Traite une question (écrite ou parlée) et renvoie le texte de la réponse. */
  const traiterQuestion = (texte: string): string => {
    const propre = texte.trim();
    if (!propre) return "";
    const courante = memoireRef.current;
    const { reponse, enveloppeId } = repondreCoach(
      courante,
      propre,
      donneesAssistantRef.current,
      donneesCoachRef.current,
    );
    const maintenant = new Date();
    const messageUtilisateur: MessageCoach = {
      id: crypto.randomUUID(),
      auteur: "utilisateur",
      texte: propre,
      categorie: "question",
      date: maintenant.toISOString(),
      lu: true,
    };
    const messageCoach: MessageCoach = {
      id: crypto.randomUUID(),
      auteur: "coach",
      texte: reponse.reponse,
      details: reponse.details,
      categorie: "reponse",
      ...(enveloppeId ? { enveloppeId } : {}),
      date: new Date(maintenant.getTime() + 500).toISOString(),
      lu: true,
    };
    const apprise = apprendreQuestion(courante, propre, enveloppeId);
    enregistrer({
      ...apprise,
      messages: [...apprise.messages, messageUtilisateur, messageCoach].slice(-400),
    });
    return reponse.reponse;
  };

  const envoyer = (texte: string) => {
    if (!texte.trim()) return;
    traiterQuestion(texte);
    setQuestion("");
    champ.current?.focus();
  };

  const noter = (id: string, avis: "utile" | "inutile") => {
    enregistrer(apprendreAvis(memoireRef.current, id, avis));
  };

  /* Lecture à voix haute : un message précis, ou tout le point du jour. */
  const lire = (cle: string, texte: string) => {
    if (lecture === cle) {
      arreterLecture();
      setLecture(null);
      return;
    }
    arreterLecture();
    setLecture(cle);
    lireAVoixHaute(texte, {
      onFin: () => setLecture(null),
      onErreur: () => setLecture(null),
    });
  };

  const texteMessage = (m: { texte: string; details?: string[] }) =>
    [m.texte, ...(m.details ?? [])].join(". ");

  const messagesDuCoachAujourdhui = memoire.messages.filter(
    (m) =>
      m.auteur === "coach" &&
      new Date(m.date).toDateString() === new Date().toDateString(),
  );
  const texteDuJour = messagesDuCoachAujourdhui.map(texteMessage).join(". ");


  const themesAppris = Object.entries(memoire.poids)
    .filter(([, p]) => p !== 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const favoris = sujetsFavoris(memoire, 4);

  let dernierJour = "";

  return (
    <div className="space-y-4 pt-4">
      <BoutonRetour to="/" label="Accueil" />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BellRing className="h-6 w-6 text-primary" aria-hidden />
          Mon conseiller
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
          Messages, réponses et historique chiffrés sur votre téléphone, sans connexion.
        </p>
      </header>

      <DiscussionVocaleCoach onQuestion={traiterQuestion} />

      {(themesAppris.length > 0 || favoris.length > 0) && (
        <section className="carte flex flex-wrap items-center gap-2 p-3">
          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Ce que j'ai appris de vous ({memoire.echanges} échange
            {memoire.echanges > 1 ? "s" : ""})
          </span>
          {themesAppris.map(([theme, p]) => (
            <span
              key={theme}
              className={`rounded-full px-2.5 py-1 text-[0.7rem] ${
                p >= 1 ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {theme} {p >= 1 ? "· vous suivez" : "· moins de messages"}
            </span>
          ))}
          {favoris.map((mot) => (
            <span key={mot} className="rounded-full bg-accent/30 px-2.5 py-1 text-[0.7rem]">
              {mot}
            </span>
          ))}
        </section>
      )}

      {/* Conseiller par enveloppe : un bilan propre à chaque enveloppe. */}
      {bilans.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" aria-hidden />
            Conseiller par enveloppe
          </h2>
          <div className="space-y-2">
            {bilans.map((b) => {
              const ouvert = ouverte === b.enveloppe.id;
              const interet = poidsEnveloppeDe(memoire, b.enveloppe.id);
              return (
                <article key={b.enveloppe.id} className="carte overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOuverte(ouvert ? null : b.enveloppe.id)}
                    aria-expanded={ouvert}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span aria-hidden className="text-lg">
                      {b.enveloppe.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {b.enveloppe.nom}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {b.resume}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
                        b.score >= 70
                          ? "bg-success/15 text-success"
                          : b.score >= 40
                            ? "bg-accent/30 text-foreground"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {b.score}/100
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        ouvert ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>

                  {ouvert && (
                    <div className="space-y-2 border-t border-border/60 p-3 text-xs">
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Dépensé sur 30 jours : {fcfa(b.depense30)}</li>
                        <li>
                          • Mois précédent : {fcfa(b.depense30Avant)}
                          {b.tendance !== 0 && ` (${b.tendance > 0 ? "+" : ""}${Math.round(b.tendance)} %)`}
                        </li>
                        <li>• Rythme observé : {fcfa(b.rythmeJour)} par jour</li>
                        <li>• Opérations analysées : {b.operations}</li>
                      </ul>
                      {b.conseils.map((c) => (
                        <div key={c.id} className="rounded-xl bg-muted/50 p-2">
                          <p className="font-medium text-foreground">{c.texte}</p>
                          <p className="mt-1 text-muted-foreground">À faire : {c.action}</p>
                        </div>
                      ))}
                      <p className="text-[0.7rem] text-muted-foreground">
                        Intérêt appris pour cette enveloppe : {Math.round(interet * 100)} %
                      </p>
                      <button
                        type="button"
                        onClick={() => envoyer(`Où en est mon enveloppe ${b.enveloppe.nom} ?`)}
                        className="rounded-full border border-input px-3 py-1.5 text-[0.7rem] transition-colors hover:bg-accent/40"
                      >
                        En parler au conseiller
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3" aria-live="polite">
        {!prete && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Votre conseiller relit vos données…
          </p>
        )}

        {memoire.messages.map((m) => {
          const jour = jourLisible(m.date);
          const nouveauJour = jour !== dernierJour;
          dernierJour = jour;
          const duCoach = m.auteur === "coach";
          return (
            <div key={m.id} className="space-y-3">
              {nouveauJour && (
                <p className="text-center text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  {jour}
                </p>
              )}
              <article
                className={`max-w-[88%] space-y-2 rounded-2xl p-3 text-sm ${
                  duCoach
                    ? "carte mr-auto rounded-bl-md"
                    : "ml-auto rounded-br-md bg-primary text-primary-foreground"
                }`}
              >
                <p className={duCoach ? "font-medium" : ""}>{m.texte}</p>
                {m.details && m.details.length > 0 && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {m.details.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[0.65rem] ${
                      duCoach ? "text-muted-foreground" : "text-primary-foreground/70"
                    }`}
                  >
                    {heure(m.date)}
                  </span>
                  {duCoach && (
                    <span className="flex items-center gap-1">
                      {vocalisationDisponible() && (
                        <button
                          type="button"
                          onClick={() => lire(m.id, texteMessage(m))}
                          aria-label={
                            lecture === m.id
                              ? "Arrêter la lecture"
                              : "Écouter ce message"
                          }
                          className={`rounded-full p-1.5 transition-colors ${
                            lecture === m.id ? "bg-primary/15 text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {lecture === m.id ? (
                            <Square className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => noter(m.id, "utile")}
                        aria-label="Ce conseil m'est utile"
                        aria-pressed={m.avis === "utile"}
                        className={`rounded-full p-1.5 transition-colors ${
                          m.avis === "utile" ? "bg-secondary text-primary" : "text-muted-foreground"
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => noter(m.id, "inutile")}
                        aria-label="Ce conseil ne m'intéresse pas"
                        aria-pressed={m.avis === "inutile"}
                        className={`rounded-full p-1.5 transition-colors ${
                          m.avis === "inutile" ? "bg-muted text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  )}
                </div>
              </article>
            </div>
          );
        })}
        <div ref={bas} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Questions rapides</h2>
        <div className="flex flex-wrap gap-2">
          {EXEMPLES_QUESTIONS.slice(0, 6).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => envoyer(q)}
              className="rounded-full border border-input bg-card px-3 py-1.5 text-xs transition-colors hover:bg-accent/40"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      <form
        className="carte sticky bottom-[calc(var(--app-nav-height,4.5rem)+0.5rem)] flex items-center gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(question);
        }}
      >
        <input
          ref={champ}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Écrivez à votre conseiller…"
          aria-label="Message pour votre conseiller"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!question.trim()}
          aria-label="Envoyer mon message au conseiller"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
          Envoyer
        </button>
      </form>
    </div>
  );
}
