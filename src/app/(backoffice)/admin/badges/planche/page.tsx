import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { badgesAImprimer, type FiltreBadges } from "@/modules/badges/bulk";
import { FORMAT_BADGE } from "@/modules/badges/format";

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
 * La règle `@page` reprend le format du badge (`modules/badges/format.ts`,
 * 100 × 150 mm, portrait) et une marge nulle : un badge par page, à taille
 * réelle. Jusqu'au 25 octobre 2026, elle réglait une page **paysage** pour un
 * badge **portrait** : l'image, réduite pour tenir dans la hauteur, sortait à
 * 34 × 54 mm au lieu de 54 × 86. Le menu du BackOffice et les marges de la page
 * sont retirés à l'impression : sans cela, ils s'imprimaient avec la planche.
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
  const ancienFormat = badges.filter((badge) => badge.ancienFormat).length;

  const largeur = `${FORMAT_BADGE.largeurMm}mm`;
  const hauteur = `${FORMAT_BADGE.hauteurMm}mm`;

  return (
    <div className="planche">
      <style>{`
        @page { size: ${largeur} ${hauteur}; margin: 0; }
        @media print {
          aside, .consignes { display: none !important; }
          html, body, main, .bg-bg-2 { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .bg-bg-2 { min-height: 0 !important; }
          .badge { break-after: page; }
          .badge:last-child { break-after: auto; }
        }
        .badge { width: ${largeur}; height: ${hauteur}; overflow: hidden; }
        .badge img { width: 100%; height: 100%; object-fit: contain; display: block; }
      `}</style>

      <div className="consignes border-border bg-surface mb-6 rounded-xl border p-4 text-sm">
        <p className="text-heading font-semibold">
          {badges.length} badge(s) prêt(s) à imprimer
          {badges.length === LIMITE ? ` (planche plafonnée à ${LIMITE})` : ""}
        </p>
        <p className="text-text-3 mt-1 text-xs">
          Lancez l&apos;impression du navigateur. Le format de page est déjà réglé à la taille
          d&apos;un badge ({FORMAT_BADGE.largeurMm} × {FORMAT_BADGE.hauteurMm} mm) : gardez
          l&apos;échelle à 100 %. Sur imprimante A4, choisissez « plusieurs pages par feuille ».
          Cette consigne ne s&apos;imprime pas.
        </p>
        {ancienFormat > 0 && (
          <p className="text-danger-text mt-2 text-xs font-semibold">
            {ancienFormat} badge(s) de cette planche sont encore au format carte (54 × 86 mm) et
            sortiraient sans fente pour cordon. Passez-les au format {FORMAT_BADGE.largeurMm} ×{" "}
            {FORMAT_BADGE.hauteurMm} mm depuis l&apos;écran Badges avant d&apos;imprimer.
          </p>
        )}
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
