import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Brain, GraduationCap, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fiabiliteOcr,
  lireMemoireOcr,
  oublierRegleOcr,
  reinitialiserApprentissageOcr,
  etiquetteSource,
  type MemoireOcr,
} from "@/lib/ocr-apprentissage";

/**
 * Tableau de bord des performances d'apprentissage de la lecture des tickets.
 * Tout est calculé localement, à partir de la mémoire stockée sur l'appareil.
 */
export function TableauApprentissageOcr() {
  const [ouvert, setOuvert] = useState(false);
  const [memoire, setMemoire] = useState<MemoireOcr | null>(null);

  useEffect(() => {
    if (ouvert) setMemoire(lireMemoireOcr());
  }, [ouvert]);

  const fiabilite = useMemo(() => (memoire ? fiabiliteOcr(memoire) : null), [memoire]);

  const commercants = useMemo(() => {
    if (!memoire) return [];
    return Object.entries(memoire.regles)
      .map(([cle, regle]) => {
        const total = regle.validations + regle.corrections;
        return {
          cle,
          regle,
          justesse: total > 0 ? Math.round((regle.validations / total) * 100) : 0,
        };
      })
      .sort(
        (a, b) =>
          b.regle.validations + b.regle.corrections - (a.regle.validations + a.regle.corrections),
      );
  }, [memoire]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 py-3 text-xs font-semibold"
      >
        <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
        Performances de l'apprentissage
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-primary" aria-hidden />
              Apprentissage de la lecture des tickets
            </h2>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer le tableau de bord"
              className="rounded-full p-2"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-16">
            {!fiabilite || fiabilite.lectures === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Aucun ticket appris pour le moment. Photographiez une facture ou un reçu, corrigez
                si besoin puis enregistrez : l'application retiendra la leçon.
              </p>
            ) : (
              <>
                <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Lectures justes du premier coup</p>
                  <p className="text-3xl font-bold text-primary">
                    {fiabilite.tauxSansCorrection} %
                  </p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${fiabilite.tauxSansCorrection}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{fiabilite.conseil}</p>
                </section>

                <section className="grid grid-cols-2 gap-2 text-xs">
                  <p className="rounded-xl bg-muted/50 px-3 py-3">
                    Tickets appris
                    <span className="block text-lg font-semibold">{fiabilite.lectures}</span>
                  </p>
                  <p className="rounded-xl bg-muted/50 px-3 py-3">
                    Commerçants mémorisés
                    <span className="block text-lg font-semibold">{fiabilite.regles}</span>
                  </p>
                  <p className="rounded-xl bg-muted/50 px-3 py-3">
                    Montants corrigés
                    <span className="block text-lg font-semibold">
                      {fiabilite.montantsCorriges}
                    </span>
                  </p>
                  <p className="rounded-xl bg-muted/50 px-3 py-3">
                    Libellés corrigés
                    <span className="block text-lg font-semibold">
                      {fiabilite.libellesCorriges}
                    </span>
                  </p>
                  <p className="rounded-xl bg-muted/50 px-3 py-3">
                    Enveloppes corrigées
                    <span className="block text-lg font-semibold">
                      {fiabilite.enveloppesCorrigees}
                    </span>
                  </p>
                  <p className="rounded-xl bg-muted/50 px-3 py-3">
                    Tickets incompris
                    <span className="block text-lg font-semibold">{fiabilite.echecs}</span>
                  </p>
                </section>

                {commercants.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Ce que l'application a retenu</h3>
                    <ul className="space-y-2">
                      {commercants.map(({ cle, regle, justesse }) => (
                        <li
                          key={cle}
                          className="rounded-2xl border border-border bg-card p-3 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{regle.libelle}</p>
                              <p className="text-muted-foreground">
                                {regle.type === "revenu" ? "Revenu" : "Dépense"}
                                {regle.sourcePreferee
                                  ? ` · montant lu sur : ${etiquetteSource(regle.sourcePreferee)}`
                                  : ""}
                              </p>
                              <p className="text-muted-foreground">
                                {regle.validations} validation
                                {regle.validations > 1 ? "s" : ""} · {regle.corrections} correction
                                {regle.corrections > 1 ? "s" : ""} · {justesse} % de justesse
                              </p>
                              {regle.motsCles.length > 0 && (
                                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                  Repères : {regle.motsCles.join(", ")}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              aria-label={`Oublier ${regle.libelle}`}
                              onClick={() => {
                                setMemoire(oublierRegleOcr(cle));
                                toast.success("Leçon oubliée");
                              }}
                              className="rounded-full p-2 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {memoire && memoire.echecs.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Tickets restés incompris</h3>
                    <ul className="space-y-2">
                      {memoire.echecs.slice(-5).map((echec) => (
                        <li
                          key={`${echec.date}-${echec.texte.slice(0, 12)}`}
                          className="rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground"
                        >
                          <p className="font-semibold text-foreground">
                            {new Date(echec.date).toLocaleDateString("fr-FR")}
                          </p>
                          <p className="line-clamp-3 whitespace-pre-wrap">{echec.texte}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      Reprenez ces tickets en photo et corrigez-les : ils deviendront des leçons.
                    </p>
                  </section>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMemoire(reinitialiserApprentissageOcr());
                    toast.success("Apprentissage remis à zéro");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-3 py-3 text-xs font-semibold text-destructive"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Tout réapprendre depuis le début
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
