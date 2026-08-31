import { createFileRoute } from "@tanstack/react-router";
import { BoutonRetour } from "@/components/BoutonRetour";
import { SectionMiseAJour } from "@/components/SectionMiseAJour";

export const Route = createFileRoute("/parametres/mises-a-jour")({
  head: () => ({
    meta: [
      { title: "Mises à jour — SUPER APP" },
      {
        name: "description",
        content: "Consultez la version installée et recherchez une nouvelle version de SUPER APP.",
      },
      { property: "og:title", content: "Mises à jour — SUPER APP" },
      {
        property: "og:description",
        content: "Version installée et recherche automatique de nouvelle version.",
      },
    ],
  }),
  component: PageMisesAJour,
});

function PageMisesAJour() {
  return (
    <div className="space-y-4">
      <BoutonRetour to="/parametres" label="Paramètres" />
      <h1 className="text-2xl font-bold tracking-tight">Mises à jour</h1>
      <SectionMiseAJour />
    </div>
  );
}
