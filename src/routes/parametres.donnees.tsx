import { createFileRoute } from "@tanstack/react-router";
import { BoutonRetour } from "@/components/BoutonRetour";
import { useSuperApp } from "@/lib/store";
import { SectionRestauration } from "@/components/SectionRestauration";
import { JournalDonnees } from "@/components/JournalDonnees";
import { SectionPurge } from "@/components/SectionPurge";

export const Route = createFileRoute("/parametres/donnees")({
  head: () => ({
    meta: [
      { title: "Données locales — SUPER APP" },
      {
        name: "description",
        content:
          "Réinitialisation, points de restauration, journal des données et purge des anciennes opérations.",
      },
      { property: "og:title", content: "Données locales — SUPER APP" },
      {
        property: "og:description",
        content: "Réinitialisation, restauration, journal et purge des données locales.",
      },
    ],
  }),
  component: PageDonnees,
});

function PageDonnees() {
  const { reinitialiser } = useSuperApp();

  return (
    <div className="space-y-4">
      <BoutonRetour to="/parametres" label="Paramètres" />
      <h1 className="text-2xl font-bold tracking-tight">Données locales</h1>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Stockage de l'appareil</h2>
        <p className="text-sm text-muted-foreground">
          Toutes vos opérations sont stockées sur cet appareil uniquement.
        </p>
        <button
          type="button"
          onClick={() => reinitialiser()}
          className="w-full rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive"
        >
          Réinitialiser les données
        </button>
      </section>

      <SectionRestauration />
      <JournalDonnees />
      <SectionPurge />
    </div>
  );
}
