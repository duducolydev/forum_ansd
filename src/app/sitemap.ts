import type { MetadataRoute } from "next";
import { getActiveEdition } from "@/lib/edition";
import { listPosts } from "@/modules/content/service";
import { albumsPublies } from "@/modules/medias/service";

// Sans ceci, Next.js pré-génère /sitemap.xml au moment du `build` (aucune base
// de données réelle disponible dans l'image Docker à cette étape) plutôt qu'à
// la requête : forcé en dynamique pour interroger l'édition active à chaque appel.
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/programme",
  "/intervenants",
  "/sponsors",
  "/contributions",
  "/infos-pratiques",
  "/actualites",
  "/mediatheque",
  "/inscription",
  "/verifier",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const edition = await getActiveEdition();
  const [posts, albums] = await Promise.all([
    listPosts(edition.id, { onlyPublished: true }),
    albumsPublies(edition.id),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${baseUrl}${path}` })),
    ...posts.map((post) => ({
      url: `${baseUrl}/actualites/${post.slug}`,
      lastModified: post.updatedAt,
    })),
    ...albums.map((album) => ({ url: `${baseUrl}/mediatheque/${album.slug}` })),
  ];
}
