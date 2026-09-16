import type { ReactNode } from "react";

/** Classes partagées par tous les formulaires de paramètres. */
export const CHAMP = "border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm";
export const ETIQUETTE = "text-text-3 text-xs font-semibold";
// Les boutons passent par `Bouton` (`@/components/ui/bouton`), qui porte l'icône.

export function Champ({
  id,
  label,
  aide,
  children,
}: {
  id: string;
  label: string;
  aide?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ETIQUETTE}>
        {label}
      </label>
      {children}
      {aide && <span className="text-text-3 text-xs">{aide}</span>}
    </div>
  );
}

export function Panneau({
  titre,
  description,
  children,
}: {
  titre: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading text-sm font-semibold">{titre}</h3>
      {description && <p className="text-text-3 mt-1 mb-3 text-xs">{description}</p>}
      <div className={description ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export function Retour({ etat }: { etat: { erreur?: string; avis?: string } }) {
  if (etat.erreur) return <p className="text-danger-text mt-3 text-sm">{etat.erreur}</p>;
  if (etat.avis) return <p className="text-accent-text mt-3 text-sm">{etat.avis}</p>;
  return null;
}
