import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Film, FolderOpen, ImageIcon, Newspaper } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { LienExterne } from "@/components/ui/bouton";
import {
  elementsHorsAlbum,
  imagesActualites,
  listerAlbums,
  urlFichier,
} from "@/modules/medias/service";
import { versElementAdmin } from "@/modules/medias/admin";
import { FormulaireAlbum } from "@/modules/medias/components/formulaire-album";
import { TeleversementPhotos } from "@/modules/medias/components/televersement-photos";
import { FormulaireVideo } from "@/modules/medias/components/formulaire-video";
import { GrilleElements } from "@/modules/medias/components/grille-elements";

export const metadata = { title: "Médiathèque" };

const CARTE = "border-border bg-surface rounded-xl border p-5";

/**
 * Médiathèque (29 septembre 2026) : albums, photos et vidéos hors album, et
 * rappel des images d'actualités reprises automatiquement sur le site.
 */
export default async function MediathequeAdminPage() {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) redirect("/admin");

  const edition = await getActiveEdition();
  const [albums, horsAlbum, actualites] = await Promise.all([
    listerAlbums(edition.id),
    elementsHorsAlbum(edition.id),
    imagesActualites(edition.id, "fr"),
  ]);
  const imagesArticles = actualites.reduce((total, groupe) => total + groupe.images.length, 0);
  const choixAlbums = albums.map((album) => ({ id: album.id, titre: album.titleFr }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">Médiathèque</h2>
          <p className="text-text-3 text-sm">
            Albums, photos et vidéos du Forum. Les images des actualités s&apos;y ajoutent
            d&apos;elles-mêmes.
          </p>
        </div>
        <LienExterne
          href="/mediatheque"
          target="_blank"
          rel="noopener noreferrer"
          icone={ExternalLink}
        >
          Voir la médiathèque
        </LienExterne>
      </div>

      <section className={CARTE}>
        <h3 className="text-heading mb-3 flex items-center gap-2 text-base font-semibold">
          <FolderOpen aria-hidden size={18} /> Nouvel album
        </h3>
        <FormulaireAlbum />
      </section>

      <section>
        <h3 className="text-heading mb-3 text-base font-semibold">
          Albums{" "}
          {albums.length > 0 && <span className="text-text-3 font-normal">({albums.length})</span>}
        </h3>
        {albums.length === 0 ? (
          <p className="text-text-3 text-sm">Aucun album pour l&apos;instant.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {albums.map((album) => {
              const couverture = album.items[0];
              const vignette = couverture ? urlFichier(couverture, "vignette") : null;
              return (
                <li key={album.id}>
                  <Link
                    href={`/admin/mediatheque/${album.id}`}
                    className="border-border bg-surface hover:border-link group flex h-full flex-col overflow-hidden rounded-xl border transition-colors"
                  >
                    <div className="bg-bg-3 aspect-[4/3]">
                      {vignette ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée */
                        <img
                          src={vignette}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-text-3 grid h-full place-items-center">
                          <FolderOpen aria-hidden size={30} />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <span className="text-heading group-hover:text-link font-semibold">
                        {album.titleFr}
                      </span>
                      <span className="text-text-3 text-xs">
                        {album._count.items} élément{album._count.items > 1 ? "s" : ""}
                        {album.eventDate &&
                          ` · ${album.eventDate.toLocaleDateString("fr-FR", { timeZone: "UTC" })}`}
                      </span>
                      <span
                        className={`mt-auto w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          album.isPublished
                            ? "bg-accent-soft text-accent-text"
                            : "bg-bg-3 text-text-2"
                        }`}
                      >
                        {album.isPublished ? "Publié" : "Brouillon"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={CARTE}>
        <h3 className="text-heading mb-1 text-base font-semibold">Photos et vidéos hors album</h3>
        <p className="text-text-3 mb-4 text-sm">
          Visibles sur le site dès leur ajout, dans les onglets Photos et Vidéos. Vous pourrez
          ensuite les ranger dans un album.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-heading mb-2 flex items-center gap-2 text-sm font-semibold">
              <ImageIcon aria-hidden size={16} /> Photos
            </h4>
            <TeleversementPhotos albumId={null} />
          </div>
          <div>
            <h4 className="text-heading mb-2 flex items-center gap-2 text-sm font-semibold">
              <Film aria-hidden size={16} /> Vidéo
            </h4>
            <FormulaireVideo albumId={null} />
          </div>
        </div>
        <div className="mt-6">
          <GrilleElements
            elements={horsAlbum.map(versElementAdmin)}
            albumId={null}
            couvertureId={null}
            albums={choixAlbums}
          />
        </div>
      </section>

      <section className={`${CARTE} flex items-start gap-3`}>
        <Newspaper aria-hidden size={20} className="text-link mt-0.5 shrink-0" />
        <p className="text-text-2 text-sm">
          <strong className="text-heading">Images des actualités</strong> :{" "}
          {imagesArticles > 0
            ? `${imagesArticles} image(s) issue(s) de ${actualites.length} article(s) publié(s) apparaissent automatiquement dans la médiathèque (onglets Photos et Actualités).`
            : "les couvertures et galeries des actualités publiées apparaîtront automatiquement dans la médiathèque."}{" "}
          Elles se modifient depuis{" "}
          <Link href="/admin/contenus" className="text-link underline">
            Contenus → Actualités
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
