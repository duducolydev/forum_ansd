/**
 * Lecture des avis de non-distribution (RFC 3464), sans accès réseau ni base.
 *
 * Un e-mail accepté par Gmail peut encore échouer plus loin : le serveur du
 * destinataire (Yahoo, Outlook…) refuse l'adresse, et Gmail dépose dans la
 * boîte d'envoi un avis « Adresse introuvable ». Ces avis suivent un format
 * normalisé : une partie `message/delivery-status`, qui dit quel destinataire
 * a échoué et pourquoi, et une copie des en-têtes du message d'origine, qui
 * permet de retrouver l'envoi dans le journal.
 *
 * Module séparé du relevé IMAP (`rebonds.ts`) pour être testé sur des avis
 * réels recopiés, sans boîte aux lettres.
 */

export interface EchecDefinitif {
  adresse: string;
  /** Code étendu, par exemple `5.1.1`. */
  statut: string;
  diagnostic: string | null;
}

export interface AvisRebond {
  /** Message-ID de l'avis lui-même : clé d'idempotence du relevé. */
  messageId: string | null;
  date: Date | null;
  original: { messageId: string | null; sujet: string | null; date: Date | null };
  /** Destinataires définitivement refusés (`Action: failed`, statut 5.x.x). */
  echecs: EchecDefinitif[];
}

/** En-têtes d'un bloc RFC 822 : lignes repliées réunies, noms en minuscules. */
export function lireEnTetes(texte: string): Map<string, string[]> {
  const enTetes = new Map<string, string[]>();
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  let courant: { nom: string; valeur: string } | null = null;

  const ranger = () => {
    if (!courant) return;
    const liste = enTetes.get(courant.nom) ?? [];
    liste.push(courant.valeur.trim());
    enTetes.set(courant.nom, liste);
  };

  for (const ligne of lignes) {
    if (ligne.trim() === "") {
      // Fin du bloc d'en-têtes.
      break;
    }
    if (/^[ \t]/.test(ligne) && courant) {
      courant.valeur += ` ${ligne.trim()}`;
      continue;
    }
    ranger();
    const separateur = ligne.indexOf(":");
    courant =
      separateur > 0
        ? {
            nom: ligne.slice(0, separateur).trim().toLowerCase(),
            valeur: ligne.slice(separateur + 1),
          }
        : null;
  }
  ranger();
  return enTetes;
}

function premier(enTetes: Map<string, string[]>, nom: string): string | null {
  return enTetes.get(nom)?.[0] ?? null;
}

/** `rfc822; Jean@Exemple.fr` → `jean@exemple.fr`. */
function adresseDe(valeur: string): string {
  const brute = valeur.includes(";") ? valeur.slice(valeur.indexOf(";") + 1) : valeur;
  return brute.trim().replace(/^<|>$/g, "").toLowerCase();
}

function apresType(valeur: string | null): string | null {
  if (!valeur) return null;
  const texte = valeur.includes(";") ? valeur.slice(valeur.indexOf(";") + 1) : valeur;
  return texte.trim() || null;
}

/**
 * Partie `message/delivery-status` : un bloc pour le message, puis un bloc par
 * destinataire, séparés par une ligne vide. Seuls les échecs **définitifs**
 * sont retenus : un `delayed` (4.x.x) annonce que Gmail réessaie, et il
 * enverra un nouvel avis s'il abandonne.
 */
export function lireRapport(rapport: string): EchecDefinitif[] {
  const blocs = rapport.replace(/\r\n/g, "\n").split(/\n[ \t]*\n/);
  const echecs: EchecDefinitif[] = [];
  for (const bloc of blocs) {
    const champs = lireEnTetes(bloc.trim());
    const destinataire =
      premier(champs, "final-recipient") ?? premier(champs, "original-recipient");
    if (!destinataire) continue;
    const action = (premier(champs, "action") ?? "").toLowerCase();
    const statut = (premier(champs, "status") ?? "").split(/\s/)[0] ?? "";
    if (action !== "failed" || !statut.startsWith("5")) continue;
    echecs.push({
      adresse: adresseDe(destinataire),
      statut,
      diagnostic: apresType(premier(champs, "diagnostic-code")),
    });
  }
  return echecs;
}

/** Mots encodés RFC 2047 (`=?UTF-8?B?…?=`) : les objets accentués arrivent ainsi. */
export function decoderMotsEncodes(valeur: string): string {
  return valeur
    .replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?)/g, "$1")
    .replace(
      /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
      (_, jeu: string, codage: string, texte: string) => {
        const octets =
          codage.toUpperCase() === "B"
            ? Buffer.from(texte, "base64")
            : Buffer.from(
                texte
                  .replace(/_/g, " ")
                  .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
                    String.fromCharCode(parseInt(hex, 16)),
                  ),
                "latin1",
              );
        try {
          return new TextDecoder(jeu.toLowerCase()).decode(octets);
        } catch {
          return octets.toString("utf8");
        }
      },
    );
}

function dateDe(valeur: string | null): Date | null {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Assemble un avis à partir de ses trois morceaux : les en-têtes de l'avis, la
 * partie `delivery-status` et les en-têtes du message d'origine (copie jointe,
 * `message/rfc822` ou `text/rfc822-headers`). Renvoie `null` quand le message
 * n'est pas un avis exploitable.
 */
export function analyserAvis(morceaux: {
  enTetes: string;
  rapport: string;
  original?: string | null;
}): AvisRebond | null {
  const echecs = lireRapport(morceaux.rapport);
  if (echecs.length === 0) return null;

  const enTetes = lireEnTetes(morceaux.enTetes);
  const original = lireEnTetes(morceaux.original ?? "");
  const sujet = premier(original, "subject");
  // Gmail recopie aussi le Message-ID d'origine dans le bloc du message, utile
  // quand la copie jointe manque ou est tronquée.
  const blocMessage = lireEnTetes(morceaux.rapport.replace(/^\s+/, ""));

  return {
    messageId: premier(enTetes, "message-id"),
    date: dateDe(premier(enTetes, "date")),
    original: {
      messageId: premier(original, "message-id") ?? premier(blocMessage, "x-original-message-id"),
      sujet: sujet ? decoderMotsEncodes(sujet) : null,
      date: dateDe(premier(original, "date")),
    },
    echecs,
  };
}

/**
 * Beaucoup de serveurs répondent par un code générique (Gmail rapporte
 * `5.0.0` pour le « 554 delivery error: dd This user doesn't have a yahoo.fr
 * account » de Yahoo) : le texte du diagnostic dit alors ce que le code tait.
 */
const ADRESSE_INCONNUE =
  /does ?n[o']t (exist|have)|user unknown|unknown user|no such (user|recipient|mailbox)|address (not found|couldn't be found)|recipient (address )?rejected|invalid (recipient|mailbox)|mailbox (unavailable|not found|does not exist)|account (does not exist|disabled)|n'existe pas|introuvable/i;

/** Motif lisible pour le BackOffice, d'après le code étendu (RFC 3463). */
export function motifRebond(echec: EchecDefinitif): string {
  const { statut } = echec;
  let motif = "Refusé définitivement par le serveur du destinataire";
  if (/^5\.1\.(1|10)$/.test(statut) || ADRESSE_INCONNUE.test(echec.diagnostic ?? "")) {
    motif = "Adresse introuvable";
  } else if (/^5\.1\.2$/.test(statut) || /^5\.4\.4$/.test(statut)) motif = "Domaine introuvable";
  else if (statut === "5.2.1") motif = "Boîte aux lettres désactivée";
  else if (statut === "5.2.2") motif = "Boîte aux lettres pleine";
  else if (statut.startsWith("5.7")) motif = "Refusé par le serveur destinataire (filtrage)";
  const diagnostic = echec.diagnostic ? ` — ${echec.diagnostic}` : "";
  return `${motif} (${statut})${diagnostic}`.slice(0, 1000);
}
