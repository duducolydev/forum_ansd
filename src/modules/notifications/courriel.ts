import { selon, type Langue } from "@/lib/langue";

/**
 * Mise en forme des courriels du Forum (20 novembre 2026).
 *
 * Jusqu'ici, `renderHtml` enveloppait chaque ligne dans un `<p>` nu : pas de
 * cadre, pas de couleur, pas de logo, et — le plus gênant — **des adresses
 * qui n'étaient même pas cliquables**, puisque le corps est échappé avant
 * d'être posé dans la page. Un participant recevait « accédez à votre espace :
 * https://… » en texte brut, à copier à la main.
 *
 * ## Les contraintes, qui ne sont pas celles d'une page web
 *
 * Un client de messagerie n'est pas un navigateur. Ce module s'interdit donc
 * ce que le site s'autorise :
 *
 * - **Tableaux pour la mise en page**, pas de `flex` ni de `grid` : Outlook
 *   rend le HTML avec le moteur de Word, qui ne connaît ni l'un ni l'autre.
 * - **Styles en ligne uniquement** : Gmail retire les `<style>` dans certaines
 *   vues, et aucune variable CSS n'est interprétée.
 * - **Le message doit être lisible sans les images.** La plupart des
 *   messageries d'entreprise les bloquent par défaut : les logos portent donc
 *   un texte de remplacement, et aucune information ne repose sur eux.
 * - **Pas de WebP** : le moteur de Word ne le lit pas. Les logos sont servis
 *   en PNG, même si le site préfère le WebP.
 * - **Sobriété de poids** : Gmail tronque un message au-delà d'une centaine de
 *   kilo-octets de HTML et affiche « Message tronqué », ce qui couperait la
 *   signature — et parfois le bouton.
 *
 * ## Ce que le comité écrit, et ce qui en est fait
 *
 * Le corps reste du **texte** dans le BackOffice : c'est ce qui permet au
 * comité de le relire et de le corriger sans connaître HTML. Deux écritures y
 * produisent un lien :
 *
 * - `[Libellé](https://…)` — un lien nommé ;
 * - une adresse `https://…` seule, reconnue telle quelle.
 *
 * Dans les deux cas, un lien **en fin de ligne** devient un bouton, et un lien
 * au milieu d'une phrase reste un lien souligné. C'est ce qui permet aux
 * modèles déjà en base — « accédez à votre espace : {{lien_espace}} » — de
 * gagner un bouton sans être réécrits, la production n'étant pas modifiable
 * depuis le code.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/*
 * Reprise de la palette publique (`constellation.css`), et d'elle seule.
 *
 * Le vert des boutons est le `#237033` de la règle de contraste du site : le
 * `#3c9f4d` du gabarit d'origine ne tient que 3,36:1 sous texte blanc, sous le
 * seuil AA. Celui-ci tient 5,34:1.
 */
const MARINE = "#1d4f91";
const MARINE_SOMBRE = "#163a6b";
const VERT_BOUTON = "#237033";
const OR = "#e8b931";
const VERT = "#2f8a3e";
const ROUGE = "#d64541";
const TEXTE = "#1f2937";
const TEXTE_DOUX = "#5b6b82";
const FOND = "#eef2f7";
const FILET = "#dde6f1";

/** Largeur du message. Au-delà, une ligne devient pénible à lire sur écran large. */
const LARGEUR = 600;

// ---------------------------------------------------------------------------
// Échappement
// ---------------------------------------------------------------------------

export function echapper(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Adresse sûre pour un attribut `href`.
 *
 * Seuls `http` et `https` sont acceptés : un `javascript:` ou un `data:` glissé
 * dans un modèle du BackOffice ne doit pas devenir un lien actif. Une adresse
 * refusée revient en texte, visible — jamais silencieusement supprimée.
 */
export function lienSur(url: string): string | null {
  try {
    const analysee = new URL(url);
    if (analysee.protocol !== "http:" && analysee.protocol !== "https:") return null;
    return echapper(analysee.toString());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Libellés des boutons
// ---------------------------------------------------------------------------

/**
 * Nom du bouton selon la variable qui porte le lien.
 *
 * Le rendu ne voit plus que l'adresse une fois l'interpolation faite : c'est
 * donc **avant** de remplacer les variables qu'on sait de quel lien il s'agit.
 * `baliserLiens` s'en sert pour transformer `{{lien_espace}}` en
 * `[Accéder à mon espace](https://…)`, ce qui donne un bouton nommé sur les
 * modèles existants sans toucher à leur texte.
 */
export const LIBELLES_LIEN: Record<string, { fr: string; en: string; pt: string }> = {
  lien_espace: {
    fr: "Accéder à mon espace",
    en: "Go to my space",
    pt: "Aceder ao meu espaço",
  },
  lien_badge: {
    fr: "Télécharger mon badge",
    en: "Download my badge",
    pt: "Descarregar o meu crachá",
  },
  lien_inscription: {
    fr: "Confirmer mon inscription",
    en: "Confirm my registration",
    pt: "Confirmar a minha inscrição",
  },
  lien_session: {
    fr: "Voir la session",
    en: "View the session",
    pt: "Ver a sessão",
  },
  lien_programme: {
    fr: "Voir le programme",
    en: "View the programme",
    pt: "Ver o programa",
  },
  lien_newsletter: {
    fr: "Lire la newsletter",
    en: "Read the newsletter",
    pt: "Ler a newsletter",
  },
  lien_direct: {
    fr: "Suivre le Forum en direct",
    en: "Watch the Forum live",
    pt: "Acompanhar o Fórum em direto",
  },
};

/**
 * Nomme les liens connus, pour la version HTML seulement.
 *
 * La version texte du message garde les adresses nues : c'est elle que lisent
 * les clients en mode texte, et « [Accéder à mon espace](https://…) » y serait
 * du bruit.
 */
export function baliserLiens(
  variables: Record<string, string>,
  langue: Langue,
): Record<string, string> {
  const balisees: Record<string, string> = {};
  for (const [nom, valeur] of Object.entries(variables)) {
    const libelle = LIBELLES_LIEN[nom];
    // Une variable de lien peut arriver vide (pas de délégation, pas de
    // diffusion réglée) : on ne fabrique pas un bouton vers nulle part.
    balisees[nom] =
      libelle && /^https?:\/\/\S+$/.test(valeur.trim())
        ? `[${selon(langue, libelle)}](${valeur.trim()})`
        : valeur;
  }
  return balisees;
}

// ---------------------------------------------------------------------------
// Corps
// ---------------------------------------------------------------------------

/** `[Libellé](url)` ou adresse nue. */
const MOTIF_LIEN = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g;

interface Jeton {
  debut: number;
  fin: number;
  libelle: string;
  url: string;
}

function jetons(ligne: string): Jeton[] {
  const trouves: Jeton[] = [];
  for (const occurrence of ligne.matchAll(MOTIF_LIEN)) {
    const url = occurrence[2] ?? occurrence[3] ?? "";
    trouves.push({
      debut: occurrence.index,
      fin: occurrence.index + occurrence[0].length,
      libelle: occurrence[1] ?? url,
      url,
    });
  }
  return trouves;
}

function indenter(ligne: string): string {
  return ligne.replace(/^ +/, (espaces) => "&nbsp;".repeat(espaces.length));
}

function paragraphe(contenu: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${TEXTE};">${contenu}</p>`;
}

function lienEnLigne(url: string, libelle: string): string {
  const href = lienSur(url);
  if (!href) return echapper(libelle);
  return `<a href="${href}" style="color:${MARINE};text-decoration:underline;">${echapper(libelle)}</a>`;
}

/**
 * Bouton.
 *
 * Construit en tableau et non en `<a>` stylé : le moteur de Word ignore le
 * remplissage d'un lien, et le bouton s'y réduirait à du texte coloré. Le
 * `<a>` occupe toute la cellule, pour que la zone cliquable soit bien le
 * rectangle visible et non la seule étiquette.
 *
 * Le premier bouton du message est plein, les suivants sont au trait : deux
 * aplats verts côte à côte ne désignent plus d'action principale, or un
 * message n'en a qu'une.
 */
function bouton(url: string, libelle: string, principal: boolean): string {
  const href = lienSur(url);
  if (!href) return paragraphe(echapper(libelle));

  const fond = principal ? VERT_BOUTON : "#ffffff";
  const encre = principal ? "#ffffff" : MARINE;
  const bord = principal ? VERT_BOUTON : FILET;

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">`,
    `<tr><td align="center" bgcolor="${fond}" style="border-radius:8px;border:1px solid ${bord};">`,
    `<a href="${href}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:bold;color:${encre};text-decoration:none;">${echapper(libelle)}</a>`,
    `</td></tr></table>`,
  ].join("");
}

/** Retire la ponctuation d'annonce (« : », « — ») laissée par le lien promu en bouton. */
function sansPonctuationFinale(texte: string): string {
  return texte.replace(/[\s:：\-–—]+$/u, "");
}

/**
 * Corps du message, en HTML.
 *
 * Une ligne vide devient une respiration, pas un paragraphe vide : les `<p>`
 * portent déjà leur marge basse, et le `<p>&nbsp;</p>` du rendu d'origine
 * doublait les écarts.
 */
export function corpsCourriel(texte: string): string {
  const morceaux: string[] = [];
  let boutonsPoses = 0;

  for (const ligne of texte.split("\n")) {
    if (!ligne.trim()) continue;

    const liens = jetons(ligne);
    if (liens.length === 0) {
      morceaux.push(paragraphe(indenter(echapper(ligne))));
      continue;
    }

    const dernier = liens[liens.length - 1]!;
    const termineParUnLien = ligne.slice(dernier.fin).trim() === "";

    if (termineParUnLien) {
      // Tout ce qui précède le lien reste une phrase ; le lien devient le
      // bouton qui la conclut.
      const avant = ligne.slice(0, dernier.debut);
      const texteAvant = sansPonctuationFinale(
        rendreSegment(avant, liens.slice(0, -1), 0, dernier.debut),
      );
      if (texteAvant.trim()) morceaux.push(paragraphe(indenter(texteAvant)));
      morceaux.push(bouton(dernier.url, dernier.libelle, boutonsPoses === 0));
      boutonsPoses += 1;
      continue;
    }

    morceaux.push(paragraphe(indenter(rendreSegment(ligne, liens, 0, ligne.length))));
  }

  return morceaux.join("\n");
}

/** Portion de ligne, texte échappé et liens posés en ligne. */
function rendreSegment(ligne: string, liens: Jeton[], debut: number, fin: number): string {
  let sortie = "";
  let curseur = debut;
  for (const lien of liens) {
    if (lien.debut < debut || lien.fin > fin) continue;
    sortie += echapper(ligne.slice(curseur, lien.debut));
    sortie += lienEnLigne(lien.url, lien.libelle);
    curseur = lien.fin;
  }
  sortie += echapper(ligne.slice(curseur, fin));
  return sortie;
}

/**
 * Salutation d'ouverture, dans les trois langues du portail.
 *
 * La fin du mot se vérifie par `(?!\p{L})` et non par `\b` : sans le drapeau
 * Unicode, `\b` ne considère comme lettres que `A-Za-z`, de sorte qu'« Olá »
 * et « Chère » n'étaient pas reconnus — leur dernière lettre étant accentuée,
 * il n'y avait pas de frontière de mot après elle.
 */
const SALUTATION = /^\s*(bonjour|bonsoir|hello|hi|olá|ola|madame|monsieur|cher|chère)(?!\p{L})/iu;

/**
 * Résumé affiché par la messagerie à côté de l'objet, avant ouverture.
 *
 * Sans lui, la messagerie prend les premiers mots du corps : « Bonjour
 * Aminata, » pour tout le monde, ce qui ne distingue aucun message des autres.
 * Reprendre l'objet ne vaut guère mieux — la boîte de réception afficherait
 * deux fois la même phrase. On prend donc la première ligne qui dit quelque
 * chose, la salutation passée.
 *
 * Les liens en sont retirés : une adresse tronquée au milieu d'un aperçu de
 * boîte de réception n'apprend rien à personne.
 */
export function resumeCourriel(texte: string, maximum = 140): string {
  for (const ligne of texte.split("\n")) {
    const propre = ligne
      .replace(MOTIF_LIEN, (_entier, libelle?: string) => libelle ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!propre || SALUTATION.test(propre)) continue;
    return propre.length > maximum ? `${propre.slice(0, maximum - 1).trimEnd()}…` : propre;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Gabarit
// ---------------------------------------------------------------------------

export interface PiedCourriel {
  /** « Agence nationale de la Statistique et de la Démographie ». */
  organisation: string;
  /** Intitulé de l'édition. */
  edition: string;
  /** « 23–25 novembre 2026 · Hôtel King Fahd Palace, Dakar ». */
  quand: string;
}

/**
 * Enveloppe complète d'un message.
 *
 * Le bandeau est **blanc** et non aux couleurs du Forum : les deux logos sont
 * transparents et portent des éléments sombres, qui disparaîtraient sur un
 * aplat marine. Le filet tricolore sous le bandeau reprend l'anneau du logo et
 * donne sa couleur au message sans rien faire reposer sur une image.
 */
export function gabaritCourriel(options: {
  corps: string;
  langue: Langue;
  baseUrl: string;
  pied: PiedCourriel;
  /** Résumé affiché par la messagerie à côté de l'objet, avant ouverture. */
  preheader?: string;
  /** Ajout en fin de corps — pixel de suivi d'ouverture. */
  appendHtml?: string;
}): string {
  const { corps, langue, baseUrl, pied } = options;
  const racine = baseUrl.replace(/\/+$/, "");

  const altForum = selon(langue, {
    fr: "Forum international sur les données",
    en: "International Data Forum",
    pt: "Fórum Internacional sobre Dados",
  });
  const altAnsd = selon(langue, {
    fr: "ANSD — 20 ans",
    en: "ANSD — 20 years",
    pt: "ANSD — 20 anos",
  });
  const visiter = selon(langue, {
    fr: "Site du Forum",
    en: "Forum website",
    pt: "Sítio do Fórum",
  });
  const mentionAuto = selon(langue, {
    fr: "Ce message vous est adressé parce que vous êtes en relation avec le Forum international sur les données.",
    en: "You are receiving this message because you are involved with the International Data Forum.",
    pt: "Recebe esta mensagem porque está associado ao Fórum Internacional sobre Dados.",
  });

  /*
   * Le préen-tête est masqué mais lu par la messagerie, qui affiche sinon les
   * premiers mots du corps — « Bonjour Fatou, » pour tout le monde. Les espaces
   * insécables qui le suivent empêchent la messagerie d'y accoler le début du
   * message.
   */
  const preheader = options.preheader
    ? `<div style="display:none;font-size:1px;color:${FOND};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${echapper(
        options.preheader,
      )}${"&#8199;&#65279;&nbsp;".repeat(30)}</div>`
    : "";

  return `<!doctype html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${echapper(pied.edition)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${FOND};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${FOND};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="${LARGEUR}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${LARGEUR}px;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${FILET};">

<tr><td style="padding:20px 28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="left" valign="middle">
<img src="${racine}/images/logo_forum_badge.png" width="150" height="67" alt="${echapper(altForum)}" style="display:block;border:0;outline:none;width:150px;height:auto;">
</td>
<td align="right" valign="middle">
<img src="${racine}/images/LOGO-ANSD-20ans-transparent.png" width="66" height="53" alt="${echapper(altAnsd)}" style="display:block;border:0;outline:none;width:66px;height:auto;">
</td>
</tr>
</table>
</td></tr>

<tr><td style="font-size:0;line-height:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="34%" height="4" bgcolor="${VERT}" style="font-size:0;line-height:0;">&nbsp;</td>
<td width="33%" height="4" bgcolor="${OR}" style="font-size:0;line-height:0;">&nbsp;</td>
<td width="33%" height="4" bgcolor="${ROUGE}" style="font-size:0;line-height:0;">&nbsp;</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:28px 28px 14px;font-family:Arial,Helvetica,sans-serif;">
${corps}
${options.appendHtml ?? ""}
</td></tr>

<tr><td style="padding:0 28px;"><div style="height:1px;background-color:${FILET};font-size:0;line-height:0;">&nbsp;</div></td></tr>

<tr><td style="padding:18px 28px 24px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${MARINE_SOMBRE};font-weight:bold;">${echapper(pied.edition)}</p>
<p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:${TEXTE_DOUX};">${echapper(pied.quand)}</p>
<p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:${TEXTE_DOUX};">${echapper(pied.organisation)}</p>
<p style="margin:0 0 10px;font-size:12px;line-height:1.5;"><a href="${racine}" style="color:${MARINE};text-decoration:underline;">${echapper(visiter)}</a></p>
<p style="margin:0;font-size:11px;line-height:1.5;color:${TEXTE_DOUX};">${echapper(mentionAuto)}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
