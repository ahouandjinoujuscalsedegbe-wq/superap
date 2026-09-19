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
          "Points de restauration et corbeille : retrouvez une opération supprimée ou revenez à un état précédent.",
      },
      { property: "og:title", content: "Données locales — SUPER APP" },
      {
        property: "og:description",
        content: "Points de restauration et corbeille des données locales.",
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

      <SectionRestauration />
      <SectionCorbeille />
    </div>
  );
}
