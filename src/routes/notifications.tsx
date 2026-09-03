import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Mic,
  MoreVertical,
  Pin,
  PinOff,
  Search,
  Send,
  Smile,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DiscussionVocaleCoach } from "@/components/DiscussionVocaleCoach";
import { PanneauConseiller } from "@/components/PanneauConseiller";
import { SelecteurEnveloppes } from "@/components/SelecteurEnveloppes";
import { useSuperApp } from "@/lib/store";
import { EXEMPLES_QUESTIONS } from "@/lib/assistant-local";
import { bilansEnveloppes } from "@/lib/coach-enveloppe";
import { arreterLecture, lireAVoixHaute, vocalisationDisponible } from "@/lib/vocalisation";
import { bilanSaisonnier, projectionSaisonniere } from "@/lib/saison";
import {
  apprendreAvis,
  apprendreQuestion,
  ecrireMemoire,
  lireMemoire,
  mettreAJourJournee,
  MEMOIRE_VIDE,
  bilanMensuel,
  repondreCoach,
  type MemoireCoach,
  type MessageCoach,
} from "@/lib/coach";
import { noterAvisConseiller } from "@/lib/apprentissage-conseiller";
import { EVENEMENT_ALERTE } from "@/lib/alertes-conseiller";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Discussion avec mon conseiller — SUPER APP" },
      {
        name: "description",
        content:
          "Une vraie messagerie avec votre conseiller financier : réponses, citations, réactions, vocal et recherche, sans connexion.",
      },
      { property: "og:title", content: "Discussion avec mon conseiller — SUPER APP" },
      {
        property: "og:description",
        content: "Messagerie privée avec votre coach budget, calculée sur votre téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageNotifications,
});

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function jourLisible(iso: string): string {
  const d = new Date(iso);
  const aujourdhui = new Date();
  const hier = new Date(aujourdhui.getTime() - 86400000);
  if (d.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === hier.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
}

function PageNotifications() {
  const router = useRouter();
  const {
    transactions,
    enveloppes,
    budgets,
    dettes,
    comptes,
    soldesParCompte,
    depensesParEnveloppe,
    solde,
    objectifs,
  } = useSuperApp();

  const [memoire, setMemoire] = useState<MemoireCoach>(MEMOIRE_VIDE);
  const [prete, setPrete] = useState(false);
  const [question, setQuestion] = useState("");
  const [ecrit, setEcrit] = useState(false);
  const [lecture, setLecture] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [citation, setCitation] = useState<MessageCoach | null>(null);
  const [recherche, setRecherche] = useState<string | null>(null);
  const [panneau, setPanneau] = useState(false);
  const [menu, setMenu] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const [rapides, setRapides] = useState(false);
  const [vocal, setVocal] = useState(false);
  const [enBas, setEnBas] = useState(true);
  const [selecteur, setSelecteur] = useState(false);

  const bas = useRef<HTMLDivElement>(null);
  const fil = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const appui = useRef<number | null>(null);
  const memoireRef = useRef(memoire);
  memoireRef.current = memoire;

  const donneesCoach = useMemo(
    () => ({ transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde, objectifs }),
    [transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde, objectifs],
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
  const mensuel = useMemo(() => bilanMensuel(donneesCoach), [donneesCoach]);
  const saison = useMemo(
    () => bilanSaisonnier(enveloppes, transactions),
    [enveloppes, transactions],
  );
  const projection = useMemo(
    () => projectionSaisonniere(transactions, solde, 6),
    [transactions, solde],
  );

  // Chargement de la mémoire chiffrée puis bilan du jour.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Une alerte publiée pendant que la page est ouverte s'ajoute au fil.
  useEffect(() => {
    const recharger = () => {
      void (async () => {
        const chargee = await lireMemoire();
        const lue: MemoireCoach = {
          ...chargee,
          messages: chargee.messages.map((m) => ({ ...m, lu: true })),
        };
        setMemoire(lue);
        memoireRef.current = lue;
      })();
    };
    window.addEventListener(EVENEMENT_ALERTE, recharger);
    return () => window.removeEventListener(EVENEMENT_ALERTE, recharger);
  }, []);

  useEffect(() => {
    if (enBas) bas.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [memoire.messages.length, ecrit, enBas]);

  const enregistrer = (suivante: MemoireCoach) => {
    setMemoire(suivante);
    memoireRef.current = suivante;
    void ecrireMemoire(suivante);
  };

  const majMessage = (id: string, patch: Partial<MessageCoach>) => {
    const courante = memoireRef.current;
    enregistrer({
      ...courante,
      messages: courante.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  /** Traite une question (écrite ou parlée) et renvoie le texte de la réponse. */
  const traiterQuestion = (texte: string, reponseA?: string): string => {
    const propre = texte.trim();
    if (!propre) return "";
    const courante = memoireRef.current;
    const { reponse, enveloppeId, conseilDit } = repondreCoach(
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
      ...(reponseA ? { reponseA } : {}),
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
      reponseA: messageUtilisateur.id,
    };
    const apprise = apprendreQuestion(courante, propre, enveloppeId);
    enregistrer({
      ...apprise,
      conseilsDits: conseilDit
        ? [...apprise.conseilsDits.filter((c) => c !== conseilDit), conseilDit].slice(-60)
        : apprise.conseilsDits,
      messages: [...apprise.messages, messageUtilisateur, messageCoach].slice(-400),
    });
    return reponse.reponse;
  };

  /** Envoi écrit : le conseiller « écrit… » un instant avant de répondre. */
  const envoyer = (texte: string) => {
    const propre = texte.trim();
    if (!propre) return;
    const cite = citation?.id;
    setQuestion("");
    setCitation(null);
    setEmojis(false);
    setEnBas(true);
    setEcrit(true);
    champ.current?.focus();
    window.setTimeout(() => {
      traiterQuestion(propre, cite);
      setEcrit(false);
    }, 650);
  };

  const noter = (id: string, avis: "utile" | "inutile") => {
    const message = memoireRef.current.messages.find((m) => m.id === id);
    // Le conseiller apprend de chaque retour : thème, ton et fréquence.
    if (message) noterAvisConseiller(message.texte, avis);
    enregistrer(apprendreAvis(memoireRef.current, id, avis));
    setSelection(null);
  };

  const reagir = (id: string, emoji: string) => {
    const actuel = memoireRef.current.messages.find((m) => m.id === id)?.reactions ?? [];
    const suivantes = actuel.includes(emoji)
      ? actuel.filter((e) => e !== emoji)
      : [...actuel, emoji];
    majMessage(id, { reactions: suivantes });
    setSelection(null);
  };

  const lire = (cle: string, texte: string) => {
    if (lecture === cle) {
      arreterLecture();
      setLecture(null);
      return;
    }
    arreterLecture();
    setLecture(cle);
    lireAVoixHaute(texte, { onFin: () => setLecture(null), onErreur: () => setLecture(null) });
  };

  const texteMessage = (m: { texte: string; details?: string[] }) =>
    [m.texte, ...(m.details ?? [])].join(". ");

  const copier = async (texte: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      toast.success("Message copié");
    } catch {
      toast.error("Copie impossible sur cet appareil");
    }
    setSelection(null);
  };

  const supprimer = (id: string) => {
    majMessage(id, { supprime: true, texte: "", details: [] });
    setSelection(null);
  };

  const viderDiscussion = () => {
    enregistrer({ ...memoireRef.current, messages: [] });
    setMenu(false);
    toast.success("Discussion effacée de votre téléphone");
  };

  const messagesDuCoachAujourdhui = memoire.messages.filter(
    (m) => m.auteur === "coach" && new Date(m.date).toDateString() === new Date().toDateString(),
  );
  const texteDuJour = messagesDuCoachAujourdhui.map(texteMessage).join(". ");

  const filtre = (recherche ?? "").trim().toLowerCase();
  const affiches = filtre
    ? memoire.messages.filter((m) => m.texte.toLowerCase().includes(filtre))
    : memoire.messages;
  const epingles = memoire.messages.filter((m) => m.epingle && !m.supprime);
  const parId = new Map(memoire.messages.map((m) => [m.id, m]));
  const selectionne = selection ? parId.get(selection) : undefined;

  let dernierJour = "";

  return (
    <div className="fixed inset-0 z-30 flex flex-col">
      {/* En-tête de conversation */}
      <header className="flex items-center gap-2 bg-primary px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] text-primary-foreground">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Retour"
          className="rounded-full p-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPanneau(true)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-foreground/20 text-base font-bold">
            MC
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Mon conseiller</span>
            <span className="block truncate text-[0.7rem] text-primary-foreground/80">
              {ecrit ? "en train d'écrire…" : "en ligne · analyse locale"}
            </span>
          </span>
        </button>
        {vocalisationDisponible() && texteDuJour.length > 0 && (
          <button
            type="button"
            onClick={() => lire("jour", texteDuJour)}
            aria-label="Écouter le point du jour"
            className="rounded-full p-2"
          >
            {lecture === "jour" ? (
              <Square className="h-5 w-5" aria-hidden />
            ) : (
              <Volume2 className="h-5 w-5" aria-hidden />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setRecherche(recherche === null ? "" : null)}
          aria-label="Rechercher dans la discussion"
          className="rounded-full p-2"
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-label="Menu de la discussion"
          className="rounded-full p-2"
        >
          <MoreVertical className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {menu && (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-40"
            onClick={() => setMenu(false)}
          />
          <div className="absolute right-2 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-50 w-56 overflow-hidden rounded-xl border border-border bg-card text-sm shadow-lg">
            <button
              type="button"
              onClick={() => {
                setPanneau(true);
                setMenu(false);
              }}
              className="block w-full px-3 py-2.5 text-left"
            >
              Tableau de bord du conseiller
            </button>
            <button
              type="button"
              onClick={() => {
                setRapides(true);
                setMenu(false);
              }}
              className="block w-full px-3 py-2.5 text-left"
            >
              Questions rapides
            </button>
            <button
              type="button"
              onClick={() => {
                setVocal((v) => !v);
                setMenu(false);
              }}
              className="block w-full px-3 py-2.5 text-left"
            >
              Discussion vocale
            </button>
            <button
              type="button"
              onClick={viderDiscussion}
              className="block w-full px-3 py-2.5 text-left text-destructive"
            >
              Effacer la discussion
            </button>
          </div>
        </>
      )}

      {recherche !== null && (
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher dans la discussion…"
            aria-label="Rechercher dans la discussion"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{affiches.length}</span>
          <button type="button" onClick={() => setRecherche(null)} aria-label="Fermer la recherche">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {epingles.length > 0 && (
        <div className="flex items-start gap-2 border-b border-border bg-card/90 px-3 py-2 text-xs">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <p className="line-clamp-2 flex-1 text-muted-foreground">{epingles.at(-1)!.texte}</p>
          <button
            type="button"
            onClick={() => majMessage(epingles.at(-1)!.id, { epingle: false })}
            aria-label="Détacher le message épinglé"
          >
            <PinOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </button>
        </div>
      )}

      {/* Fil de discussion */}
      <div
        ref={fil}
        onScroll={(e) => {
          const el = e.currentTarget;
          setEnBas(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
        className="fond-discussion flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {!prete && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Votre conseiller relit vos données…
          </p>
        )}
        {prete && affiches.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {filtre ? "Aucun message trouvé." : "Écrivez à votre conseiller pour commencer."}
          </p>
        )}

        {affiches.map((m) => {
          const jour = jourLisible(m.date);
          const nouveauJour = jour !== dernierJour;
          dernierJour = jour;
          const duCoach = m.auteur === "coach";
          const citee = m.reponseA ? parId.get(m.reponseA) : undefined;
          return (
            <div key={m.id}>
              {nouveauJour && (
                <p className="my-3 text-center">
                  <span className="rounded-full bg-card/90 px-3 py-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {jour}
                  </span>
                </p>
              )}
              <div className={`flex ${duCoach ? "justify-start" : "justify-end"}`}>
                <article
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelection(m.id);
                  }}
                  onPointerDown={() => {
                    appui.current = window.setTimeout(() => setSelection(m.id), 400);
                  }}
                  onPointerUp={() => {
                    if (appui.current) window.clearTimeout(appui.current);
                  }}
                  onPointerLeave={() => {
                    if (appui.current) window.clearTimeout(appui.current);
                  }}
                  onDoubleClick={() => setCitation(m)}
                  className={`relative max-w-[88%] rounded-2xl px-3 py-2 text-[0.95rem] leading-snug shadow-sm sm:max-w-[75%] ${
                    duCoach ? "bulle-coach" : "bulle-moi"
                  } ${selection === m.id ? "ring-2 ring-primary" : ""}`}
                >
                  {citee && (
                    <div className="mb-1.5 rounded-lg border-l-4 border-primary bg-muted/60 px-2 py-1 text-[0.7rem] text-muted-foreground">
                      <span className="block font-semibold text-primary">
                        {citee.auteur === "coach" ? "Mon conseiller" : "Vous"}
                      </span>
                      <span className="line-clamp-2">{citee.texte || "Message supprimé"}</span>
                    </div>
                  )}
                  {m.supprime ? (
                    <p className="italic text-muted-foreground">🚫 Ce message a été supprimé</p>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap break-words">{m.texte}</p>
                      {m.details && m.details.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {m.details.map((d, i) => (
                            <li key={i}>• {d}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[0.62rem] text-muted-foreground">
                    {m.avis === "utile" && (
                      <ThumbsUp className="h-3 w-3 text-primary" aria-hidden />
                    )}
                    {m.avis === "inutile" && <ThumbsDown className="h-3 w-3" aria-hidden />}
                    {m.epingle && <Pin className="h-3 w-3" aria-hidden />}
                    <span>{heure(m.date)}</span>
                    {!duCoach &&
                      (m.lu ? (
                        <CheckCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ))}
                  </div>
                  {m.reactions && m.reactions.length > 0 && (
                    <div className="absolute -bottom-2.5 left-2 flex gap-0.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-[0.7rem] shadow-sm">
                      {m.reactions.map((e) => (
                        <span key={e}>{e}</span>
                      ))}
                    </div>
                  )}
                </article>
              </div>
            </div>
          );
        })}

        {ecrit && (
          <div className="flex justify-start">
            <div className="bulle-coach flex items-center gap-1 rounded-2xl px-3 py-2.5 shadow-sm">
              <span className="point-ecrit h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="point-ecrit h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="point-ecrit h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bas} />
      </div>

      {!enBas && (
        <button
          type="button"
          onClick={() => {
            setEnBas(true);
            bas.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }}
          aria-label="Revenir au dernier message"
          className="absolute bottom-28 right-4 grid h-10 w-10 place-items-center rounded-full bg-card shadow-lg"
        >
          <ArrowDown className="h-5 w-5 text-primary" aria-hidden />
        </button>
      )}

      {/* Actions sur un message sélectionné */}
      {selectionne && (
        <>
          <button
            type="button"
            aria-label="Fermer les actions"
            className="fixed inset-0 z-40 bg-foreground/30"
            onClick={() => setSelection(null)}
          />
          <div className="fixed inset-x-3 bottom-4 z-50 space-y-2 rounded-2xl border border-border bg-card p-3 shadow-xl">
            <div className="flex justify-around">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => reagir(selectionne.id, e)}
                  aria-label={`Réagir ${e}`}
                  className="rounded-full p-1.5 text-xl active:scale-90"
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setCitation(selectionne);
                  setSelection(null);
                  champ.current?.focus();
                }}
                className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
              >
                <CornerUpLeft className="h-4 w-4" aria-hidden /> Répondre
              </button>
              <button
                type="button"
                onClick={() => void copier(texteMessage(selectionne))}
                className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
              >
                <Copy className="h-4 w-4" aria-hidden /> Copier
              </button>
              <button
                type="button"
                onClick={() => {
                  majMessage(selectionne.id, { epingle: !selectionne.epingle });
                  setSelection(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
              >
                <Pin className="h-4 w-4" aria-hidden />
                {selectionne.epingle ? "Détacher" : "Épingler"}
              </button>
              {vocalisationDisponible() && (
                <button
                  type="button"
                  onClick={() => {
                    lire(selectionne.id, texteMessage(selectionne));
                    setSelection(null);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
                >
                  <Volume2 className="h-4 w-4" aria-hidden /> Écouter
                </button>
              )}
              {selectionne.auteur === "coach" && (
                <>
                  <button
                    type="button"
                    onClick={() => noter(selectionne.id, "utile")}
                    className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
                  >
                    <ThumbsUp className="h-4 w-4" aria-hidden /> Utile
                  </button>
                  <button
                    type="button"
                    onClick={() => noter(selectionne.id, "inutile")}
                    className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
                  >
                    <ThumbsDown className="h-4 w-4" aria-hidden /> Pas utile
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => supprimer(selectionne.id)}
                className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Supprimer
              </button>
            </div>
          </div>
        </>
      )}

      {/* Questions rapides façon réponses suggérées */}
      {rapides && (
        <div className="max-h-40 overflow-y-auto border-t border-border bg-card p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground">Questions rapides</span>
            <button type="button" onClick={() => setRapides(false)} aria-label="Fermer">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXEMPLES_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  envoyer(q);
                  setRapides(false);
                }}
                className="rounded-full border border-input px-3 py-1.5 text-xs"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {vocal && (
        <div className="border-t border-border bg-card p-2">
          <DiscussionVocaleCoach
            demarrageAuto
            onQuestion={traiterQuestion}
            onArret={() => setVocal(false)}
          />
        </div>
      )}

      {emojis && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-card p-2">
          {[
            "😀",
            "😊",
            "😂",
            "🤔",
            "😅",
            "😍",
            "👍",
            "🙏",
            "💰",
            "📉",
            "📈",
            "✅",
            "❌",
            "🔥",
            "🎯",
          ].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setQuestion((q) => q + e)}
              className="text-xl"
              aria-label={`Insérer ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Barre de saisie */}
      <div className="bg-card/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2">
        {citation && (
          <div className="mb-1.5 flex items-start gap-2 rounded-xl border-l-4 border-primary bg-muted/60 px-2 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-primary">
                {citation.auteur === "coach" ? "Mon conseiller" : "Vous"}
              </p>
              <p className="line-clamp-2 text-muted-foreground">{citation.texte}</p>
            </div>
            <button
              type="button"
              onClick={() => setCitation(null)}
              aria-label="Annuler la citation"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            envoyer(question);
          }}
        >
          <button
            type="button"
            onClick={() => setSelecteur(true)}
            aria-label="Conseiller par enveloppe"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-primary shadow-sm active:scale-95"
          >
            <Wallet className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-border bg-background px-2">
            <button
              type="button"
              onClick={() => setEmojis((v) => !v)}
              aria-label="Emojis"
              className="p-2 text-muted-foreground"
            >
              <Smile className="h-5 w-5" aria-hidden />
            </button>
            <input
              ref={champ}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Message"
              aria-label="Message pour votre conseiller"
              enterKeyHint="send"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none"
            />
            <button
              type="button"
              onClick={() => setRapides((v) => !v)}
              aria-label="Questions rapides"
              className="p-2 text-muted-foreground"
            >
              <MoreVertical className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {question.trim() ? (
            <button
              type="submit"
              aria-label="Envoyer"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
            >
              <Send className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setVocal((v) => !v)}
              aria-label="Discussion vocale avec le conseiller"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full active:scale-95 ${
                vocal
                  ? "bg-destructive text-primary-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              <Mic className="h-5 w-5" aria-hidden />
            </button>
          )}
        </form>
      </div>

      <PanneauConseiller
        ouvert={panneau}
        onFermer={() => setPanneau(false)}
        mensuel={mensuel}
        saison={saison}
        projection={projection}
        lecture={lecture}
        onLire={lire}
      />

      <SelecteurEnveloppes
        ouvert={selecteur}
        onFermer={() => setSelecteur(false)}
        bilans={bilans}
        onDemander={envoyer}
      />
    </div>
  );
}
