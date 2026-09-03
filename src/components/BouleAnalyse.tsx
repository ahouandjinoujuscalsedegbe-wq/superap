import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as PointerEventReact,
} from "react";
import { ArrowRight, LifeBuoy, Sparkles, Star, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { useCerveau } from "@/lib/cerveau/hook";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import {
  bilanSecours,
  enregistrerDecision,
  lireMemoireSecours,
  marquerTraitee,
  noterQualiteSolution,
  noterSolution,
  purgerTraitees,
  solutionsSecours,
} from "@/lib/analyse-secours";
import { EVENEMENT_OUVRIR_SECOURS, publierAlerteConseiller } from "@/lib/alertes-conseiller";

/**
 * Boule flottante d'« Analyse intelligente », disponible sur toutes les pages :
 * une véritable sphère en lévitation perpétuelle, un appui déroule les constats
 * calculés localement sur le téléphone.
 */
/** Positions des six logos sur la sphère (ceinture + pôles). */
const RAYON = 26;
const FACES = [
  `rotateY(0deg) translateZ(${RAYON}px)`,
  `rotateY(90deg) translateZ(${RAYON}px)`,
  `rotateY(180deg) translateZ(${RAYON}px)`,
  `rotateY(270deg) translateZ(${RAYON}px)`,
  `rotateX(90deg) translateZ(${RAYON}px)`,
  `rotateX(-90deg) translateZ(${RAYON}px)`,
];

export function BouleAnalyse() {
  const { alertes: toutesAlertes } = useCerveau();
  const { enveloppes, transactions, depensesParEnveloppe, transfererEntreEnveloppes } =
    useSuperApp();
  const [ouvert, setOuvert] = useState(false);
  const [onglet, setOnglet] = useState<"constats" | "solutions">("constats");
  const [montants, setMontants] = useState<Record<string, string>>({});
  /** Mémoire locale : les propositions déjà traitées n'y réapparaissent plus. */
  const [memoire, setMemoire] = useState(() => lireMemoireSecours());
  const [bilan, setBilan] = useState(() => bilanSecours());
  /** Signature du contenu déjà consulté : sert à ne clignoter que sur du nouveau. */
  const [vu, setVu] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [glisse, setGlisse] = useState(false);
  const refBoule = useRef<HTMLButtonElement | null>(null);
  const aGlisse = useRef(false);
  const decalage = useRef({ x: 0, y: 0 });
  /**
   * Popup de notation obligatoire avant qu'une action (appliquer/ignorer)
   * ne soit réellement prise en compte.
   */
  const [popupNote, setPopupNote] = useState<{
    action: "appliquer" | "ignorer";
    solutionId: string;
    cle: string;
    cibleId?: string;
    cibleNom: string;
    donneurId?: string;
    donneurNom: string;
    propose: number;
  } | null>(null);
  const [noteTemp, setNoteTemp] = useState(0);

  // Position mémorisée : la boule reste où l'utilisateur l'a posée, sur toutes les pages.
  useEffect(() => {
    try {
      const brut = localStorage.getItem("boule-analyse-position");
      if (brut) setPos(JSON.parse(brut));
    } catch {
      /* position par défaut */
    }
    try {
      setVu(localStorage.getItem("boule-analyse-vu") ?? "");
    } catch {
      /* rien vu */
    }
  }, []);

  // Un appui sur une notification de défaillance ouvre directement les solutions.
  useEffect(() => {
    const ouvrirSecours = () => {
      setOnglet("solutions");
      setOuvert(true);
    };
    window.addEventListener(EVENEMENT_OUVRIR_SECOURS, ouvrirSecours);
    return () => window.removeEventListener(EVENEMENT_OUVRIR_SECOURS, ouvrirSecours);
  }, []);

  const debutGlisse = useCallback((e: PointerEventReact<HTMLButtonElement>) => {
    const r = refBoule.current?.getBoundingClientRect();
    if (!r) return;
    decalage.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    aGlisse.current = false;
    setGlisse(true);

    const bouger = (ev: PointerEvent) => {
      const taille = r.width;
      const x = Math.min(
        Math.max(4, ev.clientX - decalage.current.x),
        window.innerWidth - taille - 4,
      );
      const y = Math.min(
        Math.max(4, ev.clientY - decalage.current.y),
        window.innerHeight - taille - 4,
      );
      if (
        Math.abs(ev.clientX - (r.left + decalage.current.x)) > 4 ||
        Math.abs(ev.clientY - (r.top + decalage.current.y)) > 4
      ) {
        aGlisse.current = true;
      }
      setPos({ x, y });
    };
    const fin = () => {
      setGlisse(false);
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", fin);
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem("boule-analyse-position", JSON.stringify(p));
          } catch {
            /* stockage indisponible */
          }
        }
        return p;
      });
      setTimeout(() => {
        aGlisse.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", fin);
  }, []);

  const alertes = useMemo(
    () => toutesAlertes.filter((a) => a.niveau !== "bravo").slice(0, 6),
    [toutesAlertes],
  );

  const solutions = useMemo(
    () => solutionsSecours(enveloppes, depensesParEnveloppe, transactions, new Date(), memoire),
    [enveloppes, depensesParEnveloppe, transactions, memoire],
  );

  // Une enveloppe redevenue saine libère son historique de propositions traitées.
  useEffect(() => {
    const suite = purgerTraitees(solutions.map((s) => s.id));
    setMemoire((m) => (JSON.stringify(m) === JSON.stringify(suite) ? m : suite));
  }, [solutions]);

  // Enveloppe toujours en défaillance sans aucune piste de transfert : l'intelligence prévient.
  useEffect(() => {
    for (const s of solutions.filter((x) => x.sansTransfert)) {
      void publierAlerteConseiller({
        titre: `Aucun transfert possible pour ${s.plan.enveloppe.nom}`,
        texte: `Toutes les pistes de secours ont été traitées ou épuisées, et ${s.plan.enveloppe.nom} reste en difficulté (${formatFCFA(s.plan.manque)} manquants). Voici ce que je conseille.`,
        details: s.conseils,
        urgent: true,
        secours: true,
      });
    }
  }, [solutions]);

  /** Empreinte du contenu en attente d'action : change dès qu'il y a du nouveau. */
  const signature = useMemo(() => {
    const a = alertes.map((x) => `${x.id}:${x.niveau}`).join("|");
    const s = solutions
      .flatMap((x) => x.donneurs.map((d) => `${x.id}-${d.enveloppe.id}-${d.montantPropose}`))
      .join("|");
    return `${a}#${s}`;
  }, [alertes, solutions]);

  // Tant que l'onglet est ouvert, ce qui s'affiche est considéré comme consulté.
  useEffect(() => {
    if (!ouvert) return;
    setVu(signature);
    try {
      localStorage.setItem("boule-analyse-vu", signature);
    } catch {
      /* stockage indisponible */
    }
  }, [ouvert, signature]);

  if (alertes.length === 0 && solutions.length === 0) return null;

  const urgentes = alertes.filter((a) => a.niveau === "alerte").length + solutions.length;
  const total = alertes.length + solutions.length;
  /** Du nouveau non encore consulté : seule situation où la boule clignote. */
  const nouveau = signature !== vu && signature !== "#";

  const appliquer = (
    cle: string,
    cibleId: string,
    cibleNom: string,
    donneurId: string,
    donneurNom: string,
    propose: number,
    note: number,
  ) => {
    const saisi = montants[cle];
    const montant = saisi ? Number(deGrouperMontant(saisi)) : propose;
    if (!montant || montant <= 0) {
      toast.error("Montant invalide");
      return;
    }
    transfererEntreEnveloppes(donneurId, cibleId, montant);
    noterQualiteSolution(note);
    setBilan(
      bilanSecours(
        enregistrerDecision({
          cible: cibleNom,
          donneur: donneurNom,
          propose,
          applique: montant,
          action: montant === propose ? "applique" : "ajuste",
        }),
      ),
    );
    setMemoire(marquerTraitee(cle));
    toast.success(`${formatFCFA(montant)} transférés vers ${cibleNom}`);
  };

  const ignorer = (
    cle: string,
    cibleNom: string,
    donneurNom: string,
    propose: number,
    note: number,
  ) => {
    noterQualiteSolution(note);
    setBilan(
      bilanSecours(
        enregistrerDecision({
          cible: cibleNom,
          donneur: donneurNom,
          propose,
          applique: 0,
          action: "ignore",
        }),
      ),
    );
    setMemoire(marquerTraitee(cle));
  };

  const ouvrirPopupNote = (ctx: NonNullable<typeof popupNote>) => {
    setNoteTemp(0);
    setPopupNote(ctx);
  };

  const confirmerNote = () => {
    if (!popupNote || noteTemp < 1 || noteTemp > 5) {
      toast.error("Veuillez donner une note de 1 à 5.");
      return;
    }
    const { action, cle, cibleId, cibleNom, donneurId, donneurNom, propose } = popupNote;
    if (action === "appliquer" && cibleId && donneurId) {
      appliquer(cle, cibleId, cibleNom, donneurId, donneurNom, propose, noteTemp);
    } else {
      ignorer(cle, cibleNom, donneurNom, propose, noteTemp);
    }
    setPopupNote(null);
    setNoteTemp(0);
  };

  return (
    <>
      {ouvert && (
        <div
          onClick={() => setOuvert(false)}
          className="animate-fade-in fixed inset-0 z-[65] bg-black/40"
          aria-hidden
        />
      )}

      {ouvert && (
        <section
          role="dialog"
          aria-label="Analyse intelligente et plan de secours"
          className="carte animate-scale-in fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-3 right-3 z-[66] max-h-[70vh] space-y-2 overflow-y-auto p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Analyse & plan de secours
              </h2>
              <p className="text-xs text-muted-foreground">
                Calculée sur votre téléphone. Fiabilité apprise : {bilan.maturite}% · propositions
                suivies : {bilan.adoption}%
                {bilan.montantSauve > 0 ? ` · ${formatFCFA(bilan.montantSauve)} déjà sauvés` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer l'analyse"
              className="rounded-full p-1.5 transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-semibold">
            {(["constats", "solutions"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOnglet(o)}
                className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                  onglet === o ? "bg-card text-foreground shadow" : "text-muted-foreground"
                }`}
              >
                {o === "constats"
                  ? `Constats (${alertes.length})`
                  : `Solutions (${solutions.length})`}
              </button>
            ))}
          </div>

          {onglet === "constats" ? (
            <ul className="space-y-1.5 text-sm">
              {alertes.length === 0 && (
                <li className="text-xs text-muted-foreground">Aucun constat pour l'instant.</li>
              )}
              {alertes.map((a) => (
                <li key={a.id} className="rounded-lg bg-muted/50 px-3 py-2">
                  <span
                    className={
                      a.niveau === "alerte"
                        ? "font-semibold text-destructive"
                        : a.niveau === "attention"
                          ? "font-semibold text-warning"
                          : "font-semibold"
                    }
                  >
                    {a.titre}
                  </span>
                  <span className="block text-xs text-muted-foreground">{a.texte}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3">
              {solutions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucune enveloppe en détresse : rien à secourir aujourd'hui.
                </p>
              )}
              {solutions.map((s) => (
                <article key={s.id} className="rounded-xl border border-border p-3">
                  <h3 className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="min-w-0 truncate">
                      <span aria-hidden>{s.plan.enveloppe.emoji}</span> {s.plan.enveloppe.nom}
                    </span>
                    <span className="shrink-0 text-xs text-destructive">
                      manque {formatFCFA(s.plan.manque)}
                    </span>
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {s.plan.explication}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-primary/5 p-2 text-[11px] leading-relaxed">
                    <LifeBuoy aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{s.impact}</span>
                  </p>

                  {s.donneurs.map((d) => {
                    const cle = `${s.id}-${d.enveloppe.id}`;
                    return (
                      <div key={cle} className="mt-2 rounded-lg bg-muted/50 p-2">
                        <div className="flex items-center justify-between gap-2 text-xs font-medium">
                          <span className="min-w-0 truncate">
                            <span aria-hidden>{d.enveloppe.emoji}</span> {d.enveloppe.nom}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            confiance {Math.round(d.confiance * 100)}%
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{d.raison}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            inputMode="numeric"
                            aria-label={`Montant à transférer depuis ${d.enveloppe.nom}`}
                            value={montants[cle] ?? grouperMontant(d.montantPropose)}
                            onChange={(e) =>
                              setMontants((m) => ({
                                ...m,
                                [cle]: grouperMontant(deGrouperMontant(e.target.value)),
                              }))
                            }
                            className="w-28 rounded-lg border border-border bg-card px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              ouvrirPopupNote({
                                action: "appliquer",
                                solutionId: s.id,
                                cle,
                                cibleId: s.plan.enveloppe.id,
                                cibleNom: s.plan.enveloppe.nom,
                                donneurId: d.enveloppe.id,
                                donneurNom: d.enveloppe.nom,
                                propose: d.montantPropose,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground"
                          >
                            <ArrowRight aria-hidden className="h-3 w-3" />
                            Appliquer
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              ouvrirPopupNote({
                                action: "ignorer",
                                solutionId: s.id,
                                cle,
                                cibleNom: s.plan.enveloppe.nom,
                                donneurNom: d.enveloppe.nom,
                                propose: d.montantPropose,
                              })
                            }
                            className="rounded-full px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            Ignorer
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {s.sansTransfert && (
                    <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 p-2">
                      <p className="text-[11px] font-semibold">
                        Plus aucun transfert sûr : {s.plan.enveloppe.nom} reste en difficulté.
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                        {s.conseils.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Cette solution vous a-t-elle aidé ?</span>
                    <button
                      type="button"
                      aria-label="Solution utile"
                      onClick={() => {
                        setBilan(bilanSecours(noterSolution(true)));
                        toast.success("Merci, l'intelligence en tient compte.");
                      }}
                      className="rounded-full p-1 hover:bg-secondary"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Solution inutile"
                      onClick={() => {
                        setBilan(bilanSecours(noterSolution(false)));
                        toast("Compris, ces propositions seront revues.");
                      }}
                      className="rounded-full p-1 hover:bg-secondary"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Popup de notation obligatoire avant application ou rejet d'une solution. */}
      {popupNote && (
        <div
          className="fixed inset-0 z-[68] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPopupNote(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-note"
            className="carte w-full max-w-sm space-y-4 p-4"
          >
            <h3 id="titre-note" className="text-sm font-semibold">
              Noter la solution proposée
            </h3>
            <p className="text-xs text-muted-foreground">
              Avant de{" "}
              <strong className="text-foreground">
                {popupNote.action === "appliquer" ? "appliquer" : "ignorer"}
              </strong>{" "}
              la proposition de secours, donnez une note de 1 à 5.
            </p>

            <div
              role="group"
              aria-label="Note sur 5"
              className="flex items-center justify-center gap-1"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} sur 5`}
                  aria-pressed={noteTemp >= n}
                  onClick={() => setNoteTemp(n)}
                  className="rounded-full p-1 transition-transform hover:scale-110"
                >
                  <Star
                    aria-hidden
                    className={`h-7 w-7 ${
                      noteTemp >= n ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-xs font-medium text-muted-foreground">
              {noteTemp > 0 ? `${noteTemp}/5` : "Touchez une étoile pour noter."}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPopupNote(null)}
                className="flex-1 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={noteTemp < 1 || noteTemp > 5}
                onClick={confirmerNote}
                className="flex-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sphère 3D rose, déplaçable à la main, en lévitation permanente. */}
      <div
        className="fixed z-[67] flex flex-col items-center"
        style={
          pos
            ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
            : { right: 16, bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }
        }
      >
        <button
          ref={refBoule}
          type="button"
          onPointerDown={debutGlisse}
          onClick={() => {
            if (aGlisse.current) return;
            setOuvert((v) => !v);
          }}
          aria-label={`Analyse intelligente et plan de secours : ${total} élément${total > 1 ? "s" : ""}`}
          aria-expanded={ouvert}
          className={`boule-levite relative h-16 w-16 touch-none rounded-full ${nouveau ? "boule-clignote" : ""} ${glisse ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <span
            className={`boule-halo-rose absolute -inset-2 rounded-full ${nouveau && urgentes > 0 ? "boule-halo-alerte" : ""}`}
            aria-hidden
          />
          <span className="boule-orbite-rose absolute -inset-1 rounded-full" aria-hidden />
          <span className="boule-rose-3d absolute inset-0 flex items-center justify-center rounded-full">
            <span className="boule-eclat absolute inset-0 rounded-full" aria-hidden />
            {/* Six logos posés sur la sphère : 4 en ceinture + 1 en haut + 1 en bas. */}
            <span className="boule-scene absolute inset-0" aria-hidden>
              <span className="boule-axe-x absolute inset-0">
                <span className="boule-axe-y absolute inset-0">
                  {FACES.map((f, i) => (
                    <span
                      key={i}
                      className="absolute left-1/2 top-1/2 -ml-[10px] -mt-[10px] flex h-5 w-5 items-center justify-center"
                      style={{ transform: f }}
                    >
                      <Sparkles className="h-5 w-5 text-white/95 drop-shadow" />
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </span>
          <span
            className={`absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
              urgentes > 0
                ? "bg-destructive text-destructive-foreground"
                : "bg-card text-foreground"
            }`}
          >
            {total}
          </span>
        </button>
        <span className="boule-ombre-rose mt-1 h-2 w-10 rounded-[50%]" aria-hidden />
      </div>
    </>
  );
}
