import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: "Aide — Guide d'utilisation de SUPER APP" },
      {
        name: "description",
        content:
          "Guide pratique : enveloppes, saisie des revenus et dépenses, comptes et confidentialité des données locales.",
      },
      { property: "og:title", content: "Aide — SUPER APP" },
      {
        property: "og:description",
        content: "Questions fréquentes et guide d'utilisation du budget du foyer.",
      },
    ],
  }),
  component: Aide,
});

const FAQ = [
  {
    q: "Comment fonctionne une enveloppe ?",
    r: "Chaque enveloppe reçoit un plafond mensuel. À chaque dépense, vous choisissez l'enveloppe concernée et la jauge se met à jour.",
  },
  {
    q: "Où sont stockées mes données ?",
    r: "Uniquement sur cet appareil. Aucune donnée n'est envoyée sur Internet ; vous pouvez tout effacer depuis les Paramètres.",
  },
  {
    q: "Comment enregistrer un revenu ?",
    r: "Onglet Revenu : saisissez le montant, la source (salaire, activité...), le compte de réception et validez.",
  },
  {
    q: "À quoi sert l'onglet Comptes ?",
    r: "Il montre le solde de chaque support d'argent : espèces, banque, MoMo, Moov Money, Wave et carte virtuelle.",
  },
  {
    q: "Puis-je changer l'apparence ?",
    r: "Oui, dans Paramètres vous ajustez la transparence des surfaces roses de l'application.",
  },
];

function Aide() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Aide</h1>
        <p className="text-sm text-muted-foreground">Tout comprendre en quelques minutes.</p>
      </header>

      <section className="space-y-3">
        {FAQ.map((item) => (
          <details key={item.q} className="carte p-4">
            <summary className="cursor-pointer font-semibold">{item.q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.r}</p>
          </details>
        ))}
      </section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Besoin d'aller plus loin ?</h2>
        <p className="text-sm text-muted-foreground">
          Les prochains modules ajouteront les dettes, les objectifs et la synchronisation entre
          appareils du foyer.
        </p>
      </section>
    </div>
  );
}
