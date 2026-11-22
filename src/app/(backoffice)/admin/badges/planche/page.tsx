import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { badgesAImprimer, compterAImprimer, joursExport } from "@/modules/badges/bulk";
import { lireFiltreBadges } from "@/modules/badges/filtre";
import { FORMAT_BADGE } from "@/modules/badges/format";
import { PlancheImages } from "@/modules/badges/components/planche-images";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Planche d'impression",
  robots: { index: false, follow: false },
};

/** Au-delà, le navigateur peine à charger les images avant l'impression. */
const LIMITE = 100;

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function libelleJour(jour: string): string {
  return dateLongue.format(new Date(`${jour}T00:00:00.000Z`));
}

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
 *
 * Les images se chargent quatre à la fois, avec nouvel essai et compteur
 * (`PlancheImages`) : demandées toutes d'un coup, certaines restaient blanches.
 *
 * ## Lots (22 novembre 2026)
 *
 * La planche annonce le **total** du filtre, et non plus seulement les cent
 * premiers : au-delà, elle se découpe en lots numérotés (`?lot=2`), dans un
 * ordre stable. Le filtre « exportés le » retrouve un envoi précis à
 * l'imprimeur pour le refaire. La planche ne marque rien : la consulter ou
 * l'imprimer ne change pas la date d'export des badges.
 *
 * ## Recherche et sélection (22 novembre 2026)
 *
 * Un nom et une catégorie resserrent la planche, et une case par badge permet
 * d'en exporter quelques-uns en ZIP (`PlancheImages`). Seul cet export marque
 * des badges — et seulement si l'opérateur le laisse coché.
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
  const filtre = lireFiltreBadges((cle) => parametres[cle]);

  const edition = await getActiveEdition();
  const [total, jours, categories] = await Promise.all([
    compterAImprimer(edition.id, filtre),
    joursExport(edition.id, filtre),
    prisma.participantCategory.findMany({
      where: { editionId: edition.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, labelFr: true },
    }),
  ]);

  const nombreDeLots = Math.max(1, Math.ceil(total / LIMITE));
  const lotDemande = Number.parseInt(parametres.lot ?? "1", 10);
  const lot = Number.isFinite(lotDemande) ? Math.min(Math.max(lotDemande, 1), nombreDeLots) : 1;
  const premier = (lot - 1) * LIMITE;

  const badges = total === 0 ? [] : await badgesAImprimer(edition.id, filtre, LIMITE, premier);
  const ancienGabarit = badges.filter((badge) => badge.ancienGabarit).length;

  /** Adresse de la planche avec certains paramètres changés ; `null` retire. */
  function lien(changements: Record<string, string | null>): string {
    const suite = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(parametres)) {
      if (valeur) suite.set(cle, valeur);
    }
    for (const [cle, valeur] of Object.entries(changements)) {
      if (valeur === null) suite.delete(cle);
      else suite.set(cle, valeur);
    }
    return `/admin/badges/planche${suite.toString() ? `?${suite}` : ""}`;
  }

  // Le formulaire de date reporte le reste du filtre ; le lot repart du premier,
  // et « déjà exportés » s'efface devant un jour précis.
  const conserves = Object.entries(parametres).filter(
    ([cle, valeur]) => valeur && !["exporteLe", "lot", "export"].includes(cle),
  );
  // Même chose pour la recherche : elle reporte tout sauf ce qu'elle saisit.
  const conservesRecherche = Object.entries(parametres).filter(
    ([cle, valeur]) => valeur && !["q", "categoryId", "lot"].includes(cle),
  );
  const champ = "border-border bg-bg text-text rounded-lg border px-3 py-1.5 text-sm";

  const largeur = `${FORMAT_BADGE.largeurMm}mm`;
  const hauteur = `${FORMAT_BADGE.hauteurMm}mm`;
  const pastille = "rounded-lg border px-3 py-1.5 text-sm font-semibold no-underline";

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
        .badge .attente { padding: 4mm; font-size: 12px; color: #5b6b7d; }
        @media screen { .badge-coche { outline: 3px solid var(--primary); outline-offset: 2px; } }
      `}</style>

      <div className="consignes border-border bg-surface mb-6 flex flex-col gap-4 rounded-xl border p-4 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-heading text-base font-semibold">
              {total} badge(s) à imprimer
              {filtre.exporteLe ? ` — exportés le ${libelleJour(filtre.exporteLe)}` : ""}
            </p>
            {total > 0 && (
              <p className="text-text-2 mt-0.5">
                {nombreDeLots > 1
                  ? `Lot ${lot} sur ${nombreDeLots} : badges ${premier + 1} à ${premier + badges.length}.`
                  : `Tous sur cette planche.`}
              </p>
            )}
          </div>

          {nombreDeLots > 1 && (
            <nav aria-label="Lots de la planche" className="flex flex-wrap gap-2">
              {Array.from({ length: nombreDeLots }, (_, rang) => rang + 1).map((numero) => (
                <Link
                  key={numero}
                  href={lien({ lot: numero === 1 ? null : String(numero) })}
                  aria-current={numero === lot ? "page" : undefined}
                  className={`${pastille} ${
                    numero === lot
                      ? "border-primary bg-primary text-primary-text"
                      : "border-border text-heading"
                  }`}
                >
                  Lot {numero}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <form
          method="get"
          action="/admin/badges/planche"
          className="flex flex-wrap items-end gap-2"
          role="search"
        >
          {conservesRecherche.map(([cle, valeur]) => (
            <input key={cle} type="hidden" name={cle} value={valeur} />
          ))}
          <div className="flex flex-col gap-1">
            <label htmlFor="planche-nom" className="text-text-3 text-xs font-semibold">
              Nom
            </label>
            <input
              id="planche-nom"
              name="q"
              type="search"
              defaultValue={filtre.recherche ?? ""}
              placeholder="Nom, prénom ou identifiant"
              className={`${champ} w-64`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="planche-categorie" className="text-text-3 text-xs font-semibold">
              Catégorie
            </label>
            <select
              id="planche-categorie"
              name="categoryId"
              defaultValue={filtre.categoryId ?? ""}
              className={`${champ} w-56`}
            >
              <option value="">Toutes</option>
              {categories.map((categorie) => (
                <option key={categorie.id} value={categorie.id}>
                  {categorie.labelFr}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={`${pastille} border-border text-heading`}>
            Rechercher
          </button>
          {(filtre.recherche || filtre.categoryId) && (
            <Link
              href={lien({ q: null, categoryId: null, lot: null })}
              className={`${pastille} border-border text-text-2`}
            >
              Effacer
            </Link>
          )}
        </form>

        <div className="flex flex-wrap items-end gap-2">
          <Link
            href={lien({ exporteLe: null, lot: null })}
            aria-current={filtre.exporteLe ? undefined : "page"}
            className={`${pastille} ${
              filtre.exporteLe
                ? "border-border text-heading"
                : "border-primary bg-primary text-primary-text"
            }`}
          >
            Tous les jours
          </Link>
          {jours.map(({ jour, badges: nombre }) => (
            <Link
              key={jour}
              href={lien({ exporteLe: jour, export: null, lot: null })}
              aria-current={filtre.exporteLe === jour ? "page" : undefined}
              className={`${pastille} ${
                filtre.exporteLe === jour
                  ? "border-primary bg-primary text-primary-text"
                  : "border-border text-heading"
              }`}
            >
              Exportés le {libelleJour(jour)} · {nombre}
            </Link>
          ))}

          <form method="get" action="/admin/badges/planche" className="flex items-end gap-2">
            {conserves.map(([cle, valeur]) => (
              <input key={cle} type="hidden" name={cle} value={valeur} />
            ))}
            <div className="flex flex-col gap-1">
              <label htmlFor="planche-exporte-le" className="text-text-3 text-xs font-semibold">
                Date d&apos;export
              </label>
              <input
                id="planche-exporte-le"
                name="exporteLe"
                type="date"
                defaultValue={filtre.exporteLe ?? ""}
                className={champ}
              />
            </div>
            <button type="submit" className={`${pastille} border-border text-heading`}>
              Afficher
            </button>
          </form>
        </div>

        <p className="text-text-3 text-xs">
          La date d&apos;export est celle du dernier envoi de chaque badge : un badge renvoyé
          appartient au lot le plus récent. Lancez l&apos;impression du navigateur. Le format de
          page est déjà réglé à la taille d&apos;un badge ({FORMAT_BADGE.largeurMm} ×{" "}
          {FORMAT_BADGE.hauteurMm} mm) : gardez l&apos;échelle à 100 %. Sur imprimante A4,
          choisissez « plusieurs pages par feuille ». Ces consignes ne s&apos;impriment pas.
        </p>

        {ancienGabarit > 0 && (
          <p className="text-danger-text text-xs font-semibold">
            {ancienGabarit} badge(s) de ce lot ont encore l&apos;ancienne présentation. Refaites-les
            avec la nouvelle maquette depuis l&apos;écran Badges avant d&apos;imprimer.
          </p>
        )}
      </div>

      {badges.length === 0 ? (
        <p className="text-text-2 text-sm">
          {filtre.recherche
            ? `Aucun badge imprimable ne correspond à « ${filtre.recherche} » dans ce périmètre.`
            : filtre.exporteLe
              ? "Aucun badge imprimable n'a été exporté ce jour-là dans ce périmètre."
              : "Aucun badge rendu dans ce périmètre. Générez-les d'abord depuis l'écran Badges."}
        </p>
      ) : (
        // La clé remet le compteur de chargement à zéro d'un lot à l'autre.
        <PlancheImages
          key={`${filtre.exporteLe ?? ""}-${filtre.recherche ?? ""}-${filtre.categoryId ?? ""}-${lot}-${badges[0]!.badgeId}`}
          badges={badges.map(({ badgeId, nom }) => ({ badgeId, nom }))}
        />
      )}
    </div>
  );
}
