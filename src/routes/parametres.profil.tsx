import { createFileRoute } from "@tanstack/react-router";
import { SectionCouple } from "@/components/SectionCouple";
import { useSuperApp } from "@/lib/store";

export const Route = createFileRoute("/parametres/profil")({
  head: () => ({
    meta: [
      { title: "Profil et apparence — SUPER APP" },
      {
        name: "description",
        content:
          "Réglez votre nom affiché, l'opacité des surfaces roses, la devise et la langue de l'application.",
      },
      { property: "og:title", content: "Profil et apparence — SUPER APP" },
      {
        property: "og:description",
        content: "Nom affiché, transparence du thème rose, devise FCFA et langue française.",
      },
    ],
  }),
  component: PageProfil,
});

function PageProfil() {
  const { transparence, definirTransparence, nomUtilisateur, definirNomUtilisateur } =
    useSuperApp();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Profil et apparence</h1>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Profil</h2>
        <div>
          <label htmlFor="nom-utilisateur" className="text-sm text-muted-foreground">
            Votre prénom ou nom d'affichage
          </label>
          <input
            id="nom-utilisateur"
            type="text"
            value={nomUtilisateur ?? ""}
            onChange={(e) => definirNomUtilisateur(e.target.value)}
            placeholder="EXEMPLE : MARIE"
            className="mt-1.5 w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </section>

      <section className="carte p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="transparence" className="font-semibold">
            Opacité des surfaces roses
          </label>
          <span className="text-sm font-semibold text-primary">{transparence} %</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Faites glisser pour rendre les cartes plus ou moins transparentes.
        </p>
        <input
          id="transparence"
          type="range"
          min={20}
          max={100}
          step={1}
          value={transparence}
          onChange={(e) => definirTransparence(Number(e.target.value))}
          className="mt-4 w-full accent-[var(--primary)]"
        />
      </section>

      <SectionCouple />

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Devise et langue</h2>
        <p className="text-sm text-muted-foreground">
          Franc CFA (XOF / XAF) · Interface entièrement en français.
        </p>
      </section>
    </div>
  );
}
