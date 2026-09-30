import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, Film, ImageIcon } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { LienExterne } from "@/components/ui/bouton";
import { listerAlbums, trouverAlbum } from "@/modules/medias/service";
import { versElementAdmin } from "@/modules/medias/admin";
import { FormulaireAlbum } from "@/modules/medias/components/formulaire-album";
import { TeleversementPhotos } from "@/modules/medias/components/televersement-photos";
import { FormulaireVideo } from "@/modules/medias/components/formulaire-video";
import { GrilleElements } from "@/modules/medias/components/grille-elements";
import { SupprimerAlbum } from "@/modules/medias/components/supprimer-album";

export const metadata = { title: "Album — Médiathèque" };

const CARTE = "border-border bg-surface rounded-xl border p-5";

export default async function AlbumAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) redirect("/admin");

  const { id } = await params;
  const edition = await getActiveEdition();
  const [album, albums] = await Promise.all([trouverAlbum(id), listerAlbums(edition.id)]);
  if (!album || album.editionId !== edition.id) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/mediatheque" className="text-link text-sm">
          ← Médiathèque
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl">{album.titleFr}</h2>
            <p className="text-text-3 text-sm">
              {album.items.length} élément{album.items.length > 1 ? "s" : ""} ·{" "}
              {album.isPublished ? "publié" : "brouillon, invisible sur le site"}
            </p>
          </div>
          {album.isPublished && (
            <LienExterne
              href={`/mediatheque/${album.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              icone={ExternalLink}
            >
              Voir l&apos;album
            </LienExterne>
          )}
        </div>
      </div>

      <section className={CARTE}>
        <FormulaireAlbum
          album={{
            id: album.id,
            titleFr: album.titleFr,
            titleEn: album.titleEn === album.titleFr ? "" : album.titleEn,
            titlePt: album.titlePt ?? "",
            descriptionFr: album.descriptionFr ?? "",
            descriptionEn: album.descriptionEn ?? "",
            descriptionPt: album.descriptionPt ?? "",
            eventDate: album.eventDate?.toISOString().slice(0, 10) ?? "",
            isPublished: album.isPublished,
          }}
        />
      </section>

      <section className={CARTE}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-heading mb-2 flex items-center gap-2 text-sm font-semibold">
              <ImageIcon aria-hidden size={16} /> Ajouter des photos
            </h3>
            <TeleversementPhotos albumId={album.id} />
          </div>
          <div>
            <h3 className="text-heading mb-2 flex items-center gap-2 text-sm font-semibold">
              <Film aria-hidden size={16} /> Ajouter une vidéo
            </h3>
            <FormulaireVideo albumId={album.id} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-heading mb-3 text-base font-semibold">Contenu de l&apos;album</h3>
        <GrilleElements
          elements={album.items.map(versElementAdmin)}
          albumId={album.id}
          couvertureId={album.coverItemId}
          albums={albums.map((entree) => ({ id: entree.id, titre: entree.titleFr }))}
        />
      </section>

      <div className="border-border flex justify-end border-t pt-5">
        <SupprimerAlbum albumId={album.id} elements={album.items.length} />
      </div>
    </div>
  );
}
