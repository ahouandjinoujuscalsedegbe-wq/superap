/** Retire les séparateurs pour retrouver la valeur brute saisissable. */
export function deGrouperMontant(valeur: string | number): string {
  return String(valeur ?? "").replace(/[^\d.,-]/g, "").replace(/,/g, ".");
}

/** Affiche un montant saisi avec un espace tous les trois chiffres (1 250 000). */
export function grouperMontant(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return "";
  const brut = String(valeur).replace(/\s/g, "").replace(/,/g, ".");
  if (brut === "" || brut === "-") return brut;
  const negatif = brut.startsWith("-");
  const nettoye = brut.replace(/[^\d.]/g, "");
  const [entiere = "", ...reste] = nettoye.split(".");
  const decimale = reste.join("");
  const entiereGroupee = entiere.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const aPoint = nettoye.includes(".");
  return `${negatif ? "-" : ""}${entiereGroupee}${aPoint ? "." : ""}${decimale}`;
}

export function formatFCFA(montant: number): string {
  const n = Math.round(montant);
  return `${new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f|\u00a0/g, " ")} FCFA`;
}

export function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
