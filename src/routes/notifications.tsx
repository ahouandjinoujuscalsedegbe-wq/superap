import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Send, ShieldCheck, ThumbsDown, ThumbsUp, Sparkles } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { useSuperApp } from "@/lib/store";
import { EXEMPLES_QUESTIONS, repondre } from "@/lib/assistant-local";
import {
  apprendreAvis,
  apprendreQuestion,
  ecrireMemoire,
  lireMemoire,
  mettreAJourJournee,
  MEMOIRE_VIDE,
  poidsDe,
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
          "Votre conseiller financier vous écrit chaque jour et répond à vos questions, à partir de vos données, sans connexion.",
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
  const memeJour = d.toDateString() === aujourdhui.toDateString();
  if (memeJour) return "Aujourd'hui";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
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
  const bas = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  const donneesCoach = useMemo(
    () => ({ transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde }),
    [transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde],
  );

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

  // Chargement de la mémoire, puis bilan du jour si nécessaire.
  useEffect(() => {
    let vivant = true;
    void (async () => {
      const chargee = await lireMemoire();
      if (!vivant) return;
      const aJour = mettreAJourJournee(chargee, donneesCoach);
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
    void ecrireMemoire(suivante);
  };

  const envoyer = (texte: string) => {
    const propre = texte.trim();
    if (!propre) return;
    const reponse = repondre(propre, donneesAssistant);
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
      date: new Date(maintenant.getTime() + 500).toISOString(),
      lu: true,
    };
    const apprise = apprendreQuestion(memoire, propre);
    enregistrer({
      ...apprise,
      messages: [...apprise.messages, messageUtilisateur, messageCoach].slice(-400),
    });
    setQuestion("");
    champ.current?.focus();
  };

  const noter = (id: string, avis: "utile" | "inutile") => {
    enregistrer(apprendreAvis(memoire, id, avis));
  };

  const themesAppris = Object.entries(memoire.poids)
    .filter(([, p]) => p !== 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

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
          Messages et réponses calculés sur votre téléphone, sans connexion.
        </p>
      </header>

      {themesAppris.length > 0 && (
        <section className="carte flex flex-wrap items-center gap-2 p-3">
          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Ce que j'ai appris de vous
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
                  {duCoach && m.categorie !== "reponse" && (
                    <span className="flex items-center gap-1">
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
          aria-label="Envoyer le message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
