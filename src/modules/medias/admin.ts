import type { MediaItem } from "@prisma/client";
import { urlFichier } from "./service";
import { vignetteFournisseur } from "./video";
import type { ElementAdmin } from "./components/grille-elements";

/** Élément tel que la grille du BackOffice le reçoit. */
export function versElementAdmin(element: MediaItem): ElementAdmin {
  return {
    id: element.id,
    type: element.type,
    vignette:
      urlFichier(element, "vignette") ??
      vignetteFournisseur(element.videoProvider ?? "", element.videoId ?? ""),
    fournisseur: element.videoProvider,
    captionFr: element.captionFr ?? "",
    captionEn: element.captionEn ?? "",
    captionPt: element.captionPt ?? "",
    credit: element.credit ?? "",
    isPublished: element.isPublished,
  };
}
