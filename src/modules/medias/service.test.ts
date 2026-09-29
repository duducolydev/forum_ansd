import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import {
  ajouterPhoto,
  ajouterVideo,
  albumPublie,
  albumsPublies,
  changerAlbum,
  creerAlbum,
  imagesActualites,
  MediaError,
  modifierAlbum,
  photosPubliques,
  supprimerAlbum,
  trouverElement,
  estPublic,
  type Actor,
} from "./service";

const acteur: Actor = { type: "SYSTEM" };
const suffixe = crypto.randomUUID().slice(0, 8);
let editionId = "";
const albums: string[] = [];
const articles: string[] = [];

/** Assez d'octets pour la détection de type : en-tête JPEG et remplissage. */
function jpeg(nom: string): File {
  const octets = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
  return new File([octets], nom, { type: "image/jpeg" });
}

const legende = { captionFr: "Ouverture", captionEn: "Opening", credit: "ANSD" };

beforeAll(async () => {
  editionId = (await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } })).id;
});

afterAll(async () => {
  const elements = await prisma.mediaItem.findMany({
    where: { OR: [{ albumId: { in: albums } }, { captionFr: `hors-album-${suffixe}` }] },
  });
  for (const element of elements) {
    for (const chemin of [element.filePath, element.thumbPath]) {
      if (chemin) await fileStorage.delete(chemin).catch(() => undefined);
    }
  }
  await prisma.mediaItem.deleteMany({ where: { id: { in: elements.map((e) => e.id) } } });
  await prisma.mediaAlbum.deleteMany({ where: { id: { in: albums } } });
  await prisma.post.deleteMany({ where: { id: { in: articles } } });
  await prisma.$disconnect();
});

async function nouvelAlbum(titre: string, publie: boolean) {
  const album = await creerAlbum(
    editionId,
    {
      titleFr: titre,
      titleEn: "",
      descriptionFr: "",
      descriptionEn: "",
      eventDate: "2026-11-23",
      isPublished: publie,
    },
    acteur,
  );
  albums.push(album.id);
  return album;
}

describe("médiathèque : albums et éléments", () => {
  it("donne des slugs uniques et un titre anglais de repli", async () => {
    const premier = await nouvelAlbum(`Cérémonie d'ouverture ${suffixe}`, true);
    const second = await nouvelAlbum(`Cérémonie d'ouverture ${suffixe}`, true);
    expect(premier.slug).toBe(`ceremonie-d-ouverture-${suffixe}`);
    expect(second.slug).toBe(`ceremonie-d-ouverture-${suffixe}-2`);
    expect(premier.titleEn).toBe(premier.titleFr);
  });

  it("n'affiche au public qu'un album publié et non vide", async () => {
    const publie = await nouvelAlbum(`Panel ${suffixe}`, true);
    const brouillon = await nouvelAlbum(`Brouillon ${suffixe}`, false);
    const vide = await nouvelAlbum(`Vide ${suffixe}`, true);

    const photo = await ajouterPhoto(
      editionId,
      publie.id,
      { photo: jpeg("a.jpg"), vignette: jpeg("a-v.jpg"), largeur: 2000, hauteur: 1333, legende },
      acteur,
    );
    await ajouterVideo(
      editionId,
      publie.id,
      { lien: "https://youtu.be/dQw4w9WgXcQ", vignette: null, legende },
      acteur,
    );
    await ajouterPhoto(
      editionId,
      brouillon.id,
      { photo: jpeg("b.jpg"), vignette: jpeg("b-v.jpg"), largeur: null, hauteur: null, legende },
      acteur,
    );

    const visibles = (await albumsPublies(editionId)).map((album) => album.id);
    expect(visibles).toContain(publie.id);
    expect(visibles).not.toContain(brouillon.id);
    expect(visibles).not.toContain(vide.id);

    const detail = (await albumsPublies(editionId)).find((album) => album.id === publie.id)!;
    expect(detail).toMatchObject({ photos: 1, videos: 1 });
    expect(detail.vignette).toContain(`/api/v1/medias/${photo.id}/vignette`);

    const album = await albumPublie(editionId, publie.slug);
    expect(album?.items).toHaveLength(2);
    expect(await albumPublie(editionId, brouillon.slug)).toBeNull();

    // L'album dépublié rend ses éléments privés.
    await modifierAlbum(
      publie.id,
      {
        titleFr: publie.titleFr,
        titleEn: "",
        descriptionFr: "",
        descriptionEn: "",
        eventDate: "",
        isPublished: false,
      },
      acteur,
    );
    const element = await trouverElement(photo.id);
    expect(element && estPublic(element)).toBe(false);
  });

  it("refuse un lien vidéo inconnu et un fichier qui n'est pas une image", async () => {
    await expect(
      ajouterVideo(
        editionId,
        null,
        { lien: "https://exemple.org/film.mp4", vignette: null, legende },
        acteur,
      ),
    ).rejects.toThrow(MediaError);

    const faux = new File([Buffer.from("<svg onload=alert(1)>").toString()], "x.jpg", {
      type: "image/jpeg",
    });
    await expect(
      ajouterPhoto(
        editionId,
        null,
        { photo: faux, vignette: faux, largeur: null, hauteur: null, legende },
        acteur,
      ),
    ).rejects.toThrow(MediaError);
  });

  it("range un élément hors album dans un album, et supprime l'album avec ses fichiers", async () => {
    const album = await nouvelAlbum(`Rangement ${suffixe}`, true);
    const photo = await ajouterPhoto(
      editionId,
      null,
      {
        photo: jpeg("c.jpg"),
        vignette: jpeg("c-v.jpg"),
        largeur: null,
        hauteur: null,
        legende: { ...legende, captionFr: `hors-album-${suffixe}` },
      },
      acteur,
    );
    await changerAlbum(photo.id, album.id, acteur);
    expect((await trouverElement(photo.id))?.albumId).toBe(album.id);

    await supprimerAlbum(album.id, acteur);
    expect(await trouverElement(photo.id)).toBeNull();
    await expect(fileStorage.get(photo.filePath!)).rejects.toThrow();
  });
});

describe("médiathèque : images des actualités", () => {
  it("reprend couverture et galerie des articles publiés, et elles seules", async () => {
    const publie = await prisma.post.create({
      data: {
        editionId,
        slug: `media-publie-${suffixe}`,
        titleFr: "Article publié",
        titleEn: "Published article",
        bodyFr: "",
        bodyEn: "",
        coverPath: "articles/couvertures/x-abcdef12.jpg",
        gallery: [
          { path: "articles/galeries/x-12345678.jpg", captionFr: "Salle", captionEn: "Room" },
        ],
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    const brouillon = await prisma.post.create({
      data: {
        editionId,
        slug: `media-brouillon-${suffixe}`,
        titleFr: "Brouillon",
        titleEn: "Draft",
        bodyFr: "",
        bodyEn: "",
        coverPath: "articles/couvertures/y-abcdef12.jpg",
        isPublished: false,
      },
    });
    articles.push(publie.id, brouillon.id);

    const groupes = await imagesActualites(editionId, "en");
    const groupe = groupes.find((entree) => entree.article.href === `/actualites/${publie.slug}`);
    expect(groupe?.images.map((image) => image.image)).toEqual([
      `/api/v1/posts/${publie.id}/image/couverture?v=abcdef12`,
      `/api/v1/posts/${publie.id}/image/0?v=12345678`,
    ]);
    expect(groupe?.images[1]?.legende).toBe("Room");
    expect(groupe?.images[0]?.source).toEqual({
      titre: "Published article",
      href: `/actualites/${publie.slug}`,
    });
    expect(groupes.some((entree) => entree.article.href.includes(brouillon.slug))).toBe(false);

    // L'onglet « Photos » les mêle aux photos de la médiathèque.
    const { elements } = await photosPubliques(editionId, "fr", 1);
    expect(elements.some((element) => element.id === `${publie.id}-couverture`)).toBe(true);
  });
});
