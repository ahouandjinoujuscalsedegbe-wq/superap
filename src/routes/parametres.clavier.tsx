import { createFileRoute } from "@tanstack/react-router";
import { SectionClavier } from "@/components/SectionClavier";

export const Route = createFileRoute("/parametres/clavier")({
  head: () => ({
    meta: [
      { title: "Clavier de l'application — SUPER APP" },
      {
        name: "description",
        content:
          "Choisissez la disposition, la taille des touches, la vibration et le son du clavier interne.",
      },
      { property: "og:title", content: "Clavier de l'application — SUPER APP" },
      {
        property: "og:description",
        content: "Disposition, taille des touches, vibration et son du clavier interne.",
      },
    ],
  }),
  component: PageClavier,
});

function PageClavier() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Clavier de l'application</h1>
      <SectionClavier />
    </div>
  );
}
