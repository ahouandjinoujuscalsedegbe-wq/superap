import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";

export const Route = createFileRoute("/comptes/transferts/automatiques")({
  head: () => ({
    meta: [
      { title: "Transferts automatiques — Part de chaque revenu" },
      {
        name: "description",
        content:
          "Réglez le pourcentage de chaque revenu envoyé automatiquement d'un compte vers un autre, en francs CFA.",
      },
      { property: "og:title", content: "Transferts automatiques — SUPER APP" },
      {
        property: "og:description",
        content: "Une part de chaque revenu part aussitôt vers le compte choisi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransfertsAutomatiques,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function TransfertsAutomatiques() {
  const {
    comptes,
    comptesReserves,
    reglesTransfert,
    sourcesRevenu,
    ajouterRegleTransfert,
    modifierRegleTransfert,
    supprimerRegleTransfert,
    totalRevenus,
  } = useSuperApp();

  const [nom, setNom] = useState("");
  const [source, setSource] = useState("*");
  const [destination, setDestination] = useState(comptes[0] ?? "");
  const [pourcentage, setPourcentage] = useState("10");
  const [sourceRevenu, setSourceRevenu] = useState("*");
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<{ id: string; nom: string } | null>(null);

  /** Part totale déjà engagée par compte déclencheur, pour éviter de dépasser 100 %. */
  const engage = useMemo(() => {
    const parSource = new Map<string, number>();
    for (const r of reglesTransfert) {
      if (!r.actif) continue;
      parSource.set(r.source, (parSource.get(r.source) ?? 0) + r.pourcentage);
    }
    return parSource;
  }, [reglesTransfert]);

  function creer(ev: React.FormEvent) {
    ev.preventDefault();
    const part = Number(pourcentage.replace(/[^\d]/g, ""));
    if (!destination) {
      setErreur("Choisissez le compte qui doit recevoir la part automatique.");
      return;
    }
    if (source === destination) {
      setErreur("Le compte de départ et le compte d'arrivée doivent être différents.");
      return;
    }
    if (!Number.isFinite(part) || part <= 0 || part > 100) {
      setErreur("Le pourcentage doit être compris entre 1 et 100.");
      return;
    }
    const deja = (engage.get(source) ?? 0) + (source === "*" ? 0 : (engage.get("*") ?? 0));
    if (deja + part > 100) {
      setErreur(
        `Total trop élevé : ${deja} % de ce revenu sont déjà transférés. Il reste ${100 - deja} %.`,
      );
      return;
    }
    const cree = ajouterRegleTransfert({
      nom: nom.trim() || `${part} % vers ${destination}`,
      source,
      destination,
      pourcentage: part,
      sourceRevenu,
      actif: true,
    });
    if (!cree) {
      setErreur("Règle refusée : vérifiez les comptes et le pourcentage.");
      return;
    }
    setNom("");
    setPourcentage("10");
    toast.success("Transfert automatique enregistré.", {
      description: "Il s'appliquera à chaque nouveau revenu correspondant.",
    });
  }

  return (
    <div className="page-anim space-y-5">
      <section className="carte space-y-2 p-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Repeat className="h-5 w-5 text-primary" aria-hidden />
          Transferts automatiques
        </h1>
        <p className="text-sm text-muted-foreground">
          À chaque revenu enregistré, la part choisie part aussitôt vers le compte d'affectation.
          Aucune saisie de transfert à faire.
        </p>
        <p className="text-sm text-muted-foreground">
          Le compte débité est celui indiqué dans les réglages du compte crédité (rubrique « Compte
          à débiter »). Ainsi, un revenu reçu en espèces peut être prélevé sur un autre compte, et
          les espèces ne sont pas entamées.
        </p>
        {comptesReserves.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Comptes réservés à ces transferts : {comptesReserves.join(" · ")}
          </p>
        )}
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="text-base font-semibold">Nouvelle règle</h2>
        <form onSubmit={creer} className="space-y-3">
          <div>
            <label htmlFor="r-nom" className="text-sm font-medium">
              Nom de la règle (optionnel)
            </label>
            <input
              id="r-nom"
              value={nom}
              onChange={(ev) => setNom(ev.target.value)}
              placeholder="Épargne du salaire"
              className={champ}
            />
          </div>

          <div>
            <label htmlFor="r-source" className="text-sm font-medium">
              Compte qui reçoit le revenu
            </label>
            <select
              id="r-source"
              value={source}
              onChange={(ev) => setSource(ev.target.value)}
              className={champ}
            >
              <option value="*">Tous les comptes</option>
              {comptes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="r-destination" className="text-sm font-medium">
              Compte d'affectation
            </label>
            <select
              id="r-destination"
              value={destination}
              onChange={(ev) => setDestination(ev.target.value)}
              className={champ}
            >
              <option value="">Choisir…</option>
              {comptes.map((c) => (
                <option key={c} value={c}>
                  {comptesReserves.includes(c) ? `${c} (réservé)` : c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="r-part" className="text-sm font-medium">
              Part de chaque revenu (%)
            </label>
            <input
              id="r-part"
              inputMode="numeric"
              value={pourcentage}
              onChange={(ev) => setPourcentage(ev.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              className={champ}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Exemple : 10 % d'un revenu de {formatFCFA(100000)} = {formatFCFA(10000)}.
            </p>
          </div>

          <div>
            <label htmlFor="r-revenu" className="text-sm font-medium">
              Type de revenu concerné
            </label>
            <select
              id="r-revenu"
              value={sourceRevenu}
              onChange={(ev) => setSourceRevenu(ev.target.value)}
              className={champ}
            >
              <option value="*">Tous les revenus</option>
              {sourcesRevenu.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
          >
            Enregistrer la règle
          </button>
        </form>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="text-base font-semibold">
          Règles enregistrées ({reglesTransfert.length})
        </h2>
        {reglesTransfert.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune règle. Les revenus restent entièrement sur le compte crédité.
          </p>
        ) : (
          <ul className="space-y-2">
            {reglesTransfert.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-border/70 bg-secondary/40 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.pourcentage} % de chaque revenu ·{" "}
                      {r.source === "*" ? "tous les comptes" : r.source} → {r.destination}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.sourceRevenu === "*" ? "Tous les revenus" : r.sourceRevenu} · sur le mois :
                      environ {formatFCFA(Math.round((totalRevenus * r.pourcentage) / 100))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => modifierRegleTransfert(r.id, { actif: !r.actif })}
                      className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                        r.actif
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-input text-muted-foreground"
                      }`}
                    >
                      {r.actif ? "Active" : "En pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setASupprimer({ id: r.id, nom: r.nom })}
                      aria-label={`Supprimer la règle ${r.nom}`}
                      className="rounded-lg border border-input px-2 py-1 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirmation
        ouvert={aSupprimer !== null}
        titre="Supprimer cette règle ?"
        message={
          aSupprimer
            ? `La règle « ${aSupprimer.nom} » ne s'appliquera plus aux prochains revenus. Les transferts déjà effectués sont conservés.`
            : ""
        }
        confirmerLabel="Supprimer"
        danger
        onConfirmer={() => {
          if (aSupprimer) supprimerRegleTransfert(aSupprimer.id);
          setASupprimer(null);
        }}
        onAnnuler={() => setASupprimer(null)}
      />

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />
    </div>
  );
}
