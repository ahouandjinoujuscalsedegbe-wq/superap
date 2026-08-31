import { createFileRoute } from "@tanstack/react-router";
import { BoutonRetour } from "@/components/BoutonRetour";
import { SectionSecurite } from "@/components/SectionSecurite";

export const Route = createFileRoute("/parametres/securite")({
  head: () => ({
    meta: [
      { title: "Sécurité et verrouillage — SUPER APP" },
      {
        name: "description",
        content:
          "Protégez l'application avec un code PIN, l'empreinte digitale et le verrouillage automatique.",
      },
      { property: "og:title", content: "Sécurité et verrouillage — SUPER APP" },
      {
        property: "og:description",
        content: "Code PIN, empreinte digitale et verrouillage automatique de SUPER APP.",
      },
    ],
  }),
  component: PageSecurite,
});

function PageSecurite() {
  return (
    <div className="space-y-4">
      <BoutonRetour to="/parametres" label="Paramètres" />
      <h1 className="text-2xl font-bold tracking-tight">Sécurité et verrouillage</h1>
      <SectionSecurite />
    </div>
  );
}
