import type { MetadataRoute } from "next";
import { getActiveEdition } from "@/lib/edition";
import { listPosts } from "@/modules/content/service";
import { albumsPublies } from "@/modules/medias/service";
import { listSessions } from "@/modules/sessions/service";
import { listerPubliees } from "@/modules/newsletters/service";
import { RUBRIQUES } from "@/modules/hotels/rubriques";

// Sans ceci, Next.js pré-génère /sitemap.xml au moment du `build` (aucune base
// de données réelle disponible dans l'image Docker à cette étape) plutôt qu'à
// la requête : forcé en dynamique pour interroger l'édition active à chaque appel.
export const dynamic = "force-dynamic";

/**
 * Plan du site : les pages publiques, et elles toutes.
 *
 * Les pages de détail manquaient (16 novembre 2026) — fiches de séance, lettres
 * d'information, six rubriques pratiques —, soit l'essentiel du contenu
 * rédigé : un moteur qui suit ce plan n'indexait que les pages d'index, et un
 * visiteur cherchant « visa Forum Dakar » ne trouvait rien. Les pages
 * personnelles (`/mon-espace`, `/espace-intervenant`, `/scan`, `/admin`) n'y
 * sont pas : elles demandent une connexion, et n'ont rien à indexer.
 *
 * Même question que `modules/corpus/reperes.ts`, qui décrit ces mêmes pages
 * pour l'assistant de recherche : une page publique ajoutée au portail
 * s'ajoute des deux côtés.
 */
const STATIC_PATHS = [
  "",
  "/programme",
  "/intervenants",
  "/sponsors",
  "/contributions",
  "/infos-pratiques",
  "/actualites",
  "/newsletters",
  "/mediatheque",
  "/inscription",
  "/verifier",
  "/mentions-legales",
  "/confidentialite",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const edition = await getActiveEdition();
  const [posts, albums, sessions, newsletters] = await Promise.all([
    listPosts(edition.id, { onlyPublished: true }),
    albumsPublies(edition.id),
    listSessions(edition.id, { onlyPublished: true }),
    listerPubliees(edition.id),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${baseUrl}${path}` })),
    ...RUBRIQUES.map((rubrique) => ({
      url: `${baseUrl}/infos-pratiques/${rubrique.segment}`,
    })),
    ...sessions.map((session) => ({
      url: `${baseUrl}/programme/${session.slug}`,
      lastModified: session.updatedAt,
    })),
    ...posts.map((post) => ({
      url: `${baseUrl}/actualites/${post.slug}`,
      lastModified: post.updatedAt,
    })),
    ...newsletters.map((lettre) => ({
      url: `${baseUrl}/newsletters/${lettre.slug}`,
      lastModified: lettre.updatedAt,
    })),
    ...albums.map((album) => ({ url: `${baseUrl}/mediatheque/${album.slug}` })),
  ];
}
