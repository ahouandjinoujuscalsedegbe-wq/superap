import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { MessageCircleQuestion, Send, ShieldCheck } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { useSuperApp } from "@/lib/store";
import { EXEMPLES_QUESTIONS, repondre, type ReponseAssistant } from "@/lib/assistant-local";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Assistant budget hors ligne — SUPER APP" },
      {
        name: "description",
        content:
          "Posez vos questions d'argent en français et obtenez une réponse calculée sur votre téléphone, sans internet ni service extérieur.",
      },
      { property: "og:title", content: "Assistant budget hors ligne" },
      {
        property: "og:description",
        content: "Vos questions financières analysées localement, en français, sans connexion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageAssistant,
});

type Echange = { id: string; question: string; reponse: ReponseAssistant };

function PageAssistant() {
  const { transactions, enveloppes, dettes, comptes, soldesParCompte, depensesParEnveloppe, solde } =
    useSuperApp();
  const [question, setQuestion] = useState("");
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const champ = useRef<HTMLInputElement>(null);

  const donnees = useMemo(
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

  const demander = (texte: string) => {
    const propre = texte.trim();
    if (!propre) return;
    const reponse = repondre(propre, donnees);
    setEchanges((liste) => [{ id: crypto.randomUUID(), question: propre, reponse }, ...liste]);
    setQuestion("");
    champ.current?.focus();
  };

  return (
    <div className="space-y-4 pt-4">
      <BoutonRetour to="/" label="Accueil" />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageCircleQuestion className="h-6 w-6 text-primary" aria-hidden />
          Assistant
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
          Réponses calculées sur votre téléphone, sans aucune connexion.
        </p>
      </header>

      <form
        className="carte flex items-center gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          demander(question);
        }}
      >
        <input
          ref={champ}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Combien j'ai dépensé ce mois ?"
          aria-label="Votre question"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          aria-label="Poser la question"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Questions fréquentes</h2>
        <div className="flex flex-wrap gap-2">
          {EXEMPLES_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => demander(q)}
              className="rounded-full border border-input bg-card px-3 py-1.5 text-xs transition-colors hover:bg-accent/40"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {echanges.map((e) => (
          <article key={e.id} className="carte space-y-2 p-4">
            <p className="text-xs font-medium text-muted-foreground">« {e.question} »</p>
            <p
              className={
                e.reponse.incompris ? "text-sm text-muted-foreground" : "text-base font-semibold"
              }
            >
              {e.reponse.reponse}
            </p>
            {e.reponse.details.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {e.reponse.details.map((d, i) => (
                  <li key={i}>• {d}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
        {echanges.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Posez une question ou choisissez un exemple ci-dessus.
          </p>
        )}
      </section>
    </div>
  );
}
