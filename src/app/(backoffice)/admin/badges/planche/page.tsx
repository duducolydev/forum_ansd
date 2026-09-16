import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { badgesAImprimer, type FiltreBadges } from "@/modules/badges/bulk";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Planche d'impression",
  robots: { index: false, follow: false },
};

/** Au-delà, le navigateur peine à charger les images avant l'impression. */
const LIMITE = 100;

/**
 * Planche d'impression des badges (brief §5.4).
 *
 * Chaque badge est une **image déjà rendue** (le PNG produit avec le PDF) plutôt
 * qu'un gabarit réinterprété par le navigateur : ce qui sort de l'imprimante est
 * alors exactement ce qui a été vérifié à la génération, sans dépendre des
 * polices installées sur le poste de l'accueil.
 *
 * La règle `@page` fixe le format carte (85,6 × 54 mm) et une marge nulle : la
 * planche s'imprime sur imprimante à badges comme sur papier, un badge par
 * page. Sur A4, l'agent choisit « plusieurs pages par feuille » dans le
 * dialogue d'impression.
 */
export default async function PlanchePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "badges.print")) redirect("/admin/badges");

  const parametres = await searchParams;
  const etat = parametres.etat;
  const filtre: FiltreBadges = {
    categoryId: parametres.categoryId || undefined,
    delegationId: parametres.delegationId || undefined,
    etat: etat === "SANS" || etat === "AVEC" || etat === "REVOQUE" ? etat : undefined,
  };

  const edition = await getActiveEdition();
  const badges = await badgesAImprimer(edition.id, filtre, LIMITE);

  return (
    <div className="planche">
      <style>{`
        @page { size: 85.6mm 54mm; margin: 0; }
        @media print {
          .consignes { display: none; }
          .badge { page-break-after: always; }
          .badge:last-child { page-break-after: auto; }
        }
        .badge { width: 85.6mm; height: 54mm; overflow: hidden; }
        .badge img { width: 100%; height: 100%; object-fit: contain; display: block; }
      `}</style>

      <div className="consignes border-border bg-surface mb-6 rounded-xl border p-4 text-sm">
        <p className="text-heading font-semibold">
          {badges.length} badge(s) prêt(s) à imprimer
          {badges.length === LIMITE ? ` (planche plafonnée à ${LIMITE})` : ""}
        </p>
        <p className="text-text-3 mt-1 text-xs">
          Lancez l&apos;impression du navigateur. Le format de page est déjà réglé à la taille
          d&apos;un badge ; sur imprimante A4, choisissez « plusieurs pages par feuille ». Cette
          consigne ne s&apos;imprime pas.
        </p>
      </div>

      {badges.length === 0 ? (
        <p className="text-text-2 text-sm">
          Aucun badge rendu dans ce périmètre. Générez-les d&apos;abord depuis l&apos;écran Badges.
        </p>
      ) : (
        badges.map((badge) => (
          <div key={badge.badgeId} className="badge">
            {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par une route authentifiée, hors optimiseur */}
            <img src={`/api/v1/badges/${badge.badgeId}/png`} alt={`Badge de ${badge.nom}`} />
          </div>
        ))
      )}
    </div>
  );
}
