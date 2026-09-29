/**
 * Vidéos de la médiathèque : des liens YouTube ou Vimeo, jamais des fichiers.
 *
 * Héberger la vidéo sur le portail n'est pas tenable : les envois sont
 * plafonnés à 3 Mo par requête, une vidéo en pèse des centaines, et le
 * serveur n'a ni la bande passante ni le transcodage d'une plateforme dédiée.
 *
 * Module sans dépendance serveur : il sert au formulaire du BackOffice comme
 * au rendu public. On ne stocke que le fournisseur et l'identifiant — jamais
 * l'adresse collée, qu'on ne réinjecterait pas telle quelle dans un `iframe`.
 */

export type FournisseurVideo = "youtube" | "vimeo";

export interface VideoReconnue {
  fournisseur: FournisseurVideo;
  identifiant: string;
}

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const ID_VIMEO = /^\d{6,12}$/;

/** Reconnaît un lien YouTube ou Vimeo ; `null` sinon. */
export function lireLienVideo(saisie: string): VideoReconnue | null {
  let url: URL;
  try {
    url = new URL(saisie.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const hote = url.hostname.replace(/^(www\.|m\.)/, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (hote === "youtu.be") {
    const id = segments[0] ?? "";
    return ID_YOUTUBE.test(id) ? { fournisseur: "youtube", identifiant: id } : null;
  }
  if (hote === "youtube.com" || hote === "youtube-nocookie.com" || hote === "music.youtube.com") {
    const id =
      segments[0] === "watch"
        ? (url.searchParams.get("v") ?? "")
        : ["embed", "shorts", "live", "v"].includes(segments[0] ?? "")
          ? (segments[1] ?? "")
          : "";
    return ID_YOUTUBE.test(id) ? { fournisseur: "youtube", identifiant: id } : null;
  }
  if (hote === "vimeo.com" || hote === "player.vimeo.com") {
    // vimeo.com/123456789, vimeo.com/channels/x/123456789,
    // player.vimeo.com/video/123456789
    const id = [...segments].reverse().find((segment) => ID_VIMEO.test(segment)) ?? "";
    return id ? { fournisseur: "vimeo", identifiant: id } : null;
  }
  return null;
}

/** Vérifie un couple relu en base avant de le mettre dans une adresse. */
function valide(fournisseur: string, identifiant: string): fournisseur is FournisseurVideo {
  return (
    (fournisseur === "youtube" && ID_YOUTUBE.test(identifiant)) ||
    (fournisseur === "vimeo" && ID_VIMEO.test(identifiant))
  );
}

/**
 * Adresse du lecteur intégré. YouTube en mode « sans cookie » : aucun cookie
 * déposé tant que le visiteur n'a pas lancé la lecture.
 */
export function urlLecteur(fournisseur: string, identifiant: string): string | null {
  if (!valide(fournisseur, identifiant)) return null;
  return fournisseur === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${identifiant}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${identifiant}?autoplay=1&dnt=1`;
}

/** Page de la vidéo chez le fournisseur, pour « Voir sur YouTube ». */
export function urlPageVideo(fournisseur: string, identifiant: string): string | null {
  if (!valide(fournisseur, identifiant)) return null;
  return fournisseur === "youtube"
    ? `https://www.youtube.com/watch?v=${identifiant}`
    : `https://vimeo.com/${identifiant}`;
}

/**
 * Vignette par défaut. YouTube en publie une à adresse fixe ; Vimeo exige un
 * appel à son API, que le serveur du Forum ne peut pas garantir — une vidéo
 * Vimeo sans vignette déposée s'affiche sur un fond neutre.
 */
export function vignetteFournisseur(fournisseur: string, identifiant: string): string | null {
  if (fournisseur !== "youtube" || !ID_YOUTUBE.test(identifiant)) return null;
  return `https://i.ytimg.com/vi/${identifiant}/hqdefault.jpg`;
}

export const NOM_FOURNISSEUR: Record<FournisseurVideo, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
};
