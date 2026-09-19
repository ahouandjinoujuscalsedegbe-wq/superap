import { createFileRoute } from "@tanstack/react-router";
import { SectionRestauration } from "@/components/SectionRestauration";
import { SectionCorbeille } from "@/components/SectionCorbeille";

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


  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Données locales</h1>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Stockage de l'appareil</h2>
        <p className="text-sm text-muted-foreground">
          Toutes vos opérations sont stockées sur cet appareil uniquement, et copiées chiffrées dans
          votre coffre.
        </p>
      </section>

      <SectionCorbeille />
    </div>
  );
}
