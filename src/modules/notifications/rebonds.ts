import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from "imapflow";
import { prisma } from "@/lib/db";
import { analyserAvis, motifRebond, type AvisRebond } from "./avis-rebond";

/**
 * Relevé des rebonds différés (10 novembre 2026).
 *
 * Gmail accepte le message, puis le serveur du destinataire le refuse : aucune
 * erreur au moment de l'envoi, le journal disait « Envoyé ». L'avis de
 * non-distribution n'arrivait que dans la boîte du Forum, où personne ne le
 * rapprochait de l'inscription concernée. Ce module lit ces avis par IMAP et
 * les reporte dans `NotificationLog`.
 *
 * La boîte est ouverte en **lecture seule** : rien n'y est déplacé, marqué lu
 * ni supprimé. L'équipe continue de la consulter comme avant.
 */

export interface ConfigImap {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/**
 * Par défaut, la boîte d'envoi elle-même : avec `smtp.gmail.com`, le même
 * compte et le même mot de passe d'application ouvrent `imap.gmail.com`. Rien
 * à ajouter au `.env` du serveur. `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD`
 * et `IMAP_PORT` remplacent cette déduction si l'envoi change de fournisseur.
 */
export function configImap(
  env: Record<string, string | undefined> = process.env,
): ConfigImap | null {
  const host = env.IMAP_HOST || (env.SMTP_HOST === "smtp.gmail.com" ? "imap.gmail.com" : "");
  const user = env.IMAP_USER || env.SMTP_USER || "";
  const pass = env.IMAP_PASSWORD || env.SMTP_PASSWORD || "";
  if (!host || !user || !pass) return null;
  return { host, port: Number(env.IMAP_PORT || 993), user, pass };
}

/** Fenêtre relue à chaque passage : couvre les invitations de la campagne en cours. */
const FENETRE_JOURS = 45;

/** Un rebond rapproché par adresse seule ne remonte pas au-delà. */
const RAPPROCHEMENT_MAX_MS = 7 * 24 * 3600 * 1000;

export interface BilanReleve {
  avisLus: number;
  nouveaux: number;
  dejaConnus: number;
}

// ---------------------------------------------------------------------------
// Enregistrement (base)
// ---------------------------------------------------------------------------

/** Objet du message d'origine → clé du modèle, quand il correspond mot pour mot. */
async function indexDesObjets(): Promise<Map<string, string>> {
  const modeles = await prisma.notificationTemplate.findMany({
    where: { channel: "EMAIL" },
    select: { key: true, subjectFr: true, subjectEn: true, subjectPt: true },
  });
  const index = new Map<string, string>();
  for (const modele of modeles) {
    for (const sujet of [modele.subjectFr, modele.subjectEn, modele.subjectPt]) {
      if (sujet?.trim() && !sujet.includes("{{")) index.set(sujet.trim(), modele.key);
    }
  }
  return index;
}

/**
 * Reporte un avis dans le journal. Trois cas, du plus sûr au moins sûr :
 *
 * 1. l'envoi d'origine est retrouvé par son Message-ID : sa ligne passe en
 *    « Rebond » ;
 * 2. sinon, le dernier envoi « Envoyé » à cette adresse dans les sept jours
 *    précédant l'avis ;
 * 3. sinon, une ligne est créée — c'est le cas des invitations parties avant
 *    le 10 novembre 2026, que le journal ne consignait pas. Elle est rattachée
 *    à l'invitation, ou au participant, qui porte cette adresse.
 *
 * Idempotent : la ligne retient le Message-ID de l'avis, qu'un passage suivant
 * reconnaît.
 */
export async function enregistrerAvis(
  avis: AvisRebond,
  objets: Map<string, string>,
): Promise<"nouveau" | "deja-connu"> {
  const dateAvis = avis.date ?? new Date();
  let resultat: "nouveau" | "deja-connu" = "deja-connu";

  for (const [rang, echec] of avis.echecs.entries()) {
    const cle = avis.messageId
      ? avis.echecs.length > 1
        ? `${avis.messageId}#${rang}`
        : avis.messageId
      : null;
    if (cle && (await prisma.notificationLog.findUnique({ where: { bounceMessageId: cle } }))) {
      continue;
    }

    const rebond = {
      status: "BOUNCED" as const,
      error: motifRebond(echec),
      bouncedAt: dateAvis,
      bounceMessageId: cle,
    };

    const parMessageId = avis.original.messageId
      ? await prisma.notificationLog.findFirst({
          where: {
            providerMessageId: avis.original.messageId,
            to: echec.adresse,
            bounceMessageId: null,
          },
        })
      : null;

    const parAdresse =
      parMessageId ??
      (await prisma.notificationLog.findFirst({
        where: {
          to: echec.adresse,
          status: "SENT",
          bounceMessageId: null,
          createdAt: {
            lte: dateAvis,
            gte: new Date(dateAvis.getTime() - RAPPROCHEMENT_MAX_MS),
          },
        },
        orderBy: { createdAt: "desc" },
      }));

    if (parAdresse) {
      await prisma.notificationLog.update({ where: { id: parAdresse.id }, data: rebond });
      resultat = "nouveau";
      continue;
    }

    const [invitation, participant] = await Promise.all([
      prisma.invitation.findFirst({
        where: { email: echec.adresse },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.participant.findFirst({
        where: { email: echec.adresse, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
    ]);

    const sujet = avis.original.sujet?.trim() ?? "";
    await prisma.notificationLog.create({
      data: {
        ...rebond,
        participantId: participant?.id,
        invitationId: participant ? undefined : invitation?.id,
        templateKey: objets.get(sujet) ?? (invitation && !participant ? "invitation" : "inconnu"),
        channel: "EMAIL",
        to: echec.adresse,
        providerMessageId: avis.original.messageId,
        createdAt: avis.original.date ?? dateAvis,
      },
    });
    resultat = "nouveau";
  }

  return resultat;
}

// ---------------------------------------------------------------------------
// Lecture de la boîte (IMAP)
// ---------------------------------------------------------------------------

function parties(noeud: MessageStructureObject | undefined): MessageStructureObject[] {
  if (!noeud) return [];
  return [noeud, ...(noeud.childNodes ?? []).flatMap(parties)];
}

async function lireFlux(flux: NodeJS.ReadableStream): Promise<string> {
  const morceaux: Buffer[] = [];
  for await (const morceau of flux) {
    morceaux.push(Buffer.isBuffer(morceau) ? morceau : Buffer.from(morceau as string));
  }
  return Buffer.concat(morceaux).toString("utf8");
}

async function telecharger(client: ImapFlow, uid: number, part: string): Promise<string | null> {
  const resultat = await client.download(String(uid), part, { uid: true });
  return resultat.content ? lireFlux(resultat.content) : null;
}

/**
 * « Tous les messages » plutôt que la boîte de réception : un avis archivé ou
 * classé par l'équipe y reste. La corbeille, elle, n'y figure pas — un avis
 * supprimé à la main sort du relevé, ce qui est sans doute voulu.
 */
async function dossierALire(client: ImapFlow): Promise<string> {
  const dossiers = await client.list();
  return dossiers.find((dossier) => dossier.specialUse === "\\All")?.path ?? "INBOX";
}

export async function releverRebonds(config = configImap()): Promise<BilanReleve> {
  if (!config) {
    throw new Error("Relevé des rebonds non configuré (IMAP_HOST ou SMTP Gmail attendu).");
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  const bilan: BilanReleve = { avisLus: 0, nouveaux: 0, dejaConnus: 0 };
  await client.connect();
  try {
    const verrou = await client.getMailboxLock(await dossierALire(client), { readOnly: true });
    try {
      const depuis = new Date(Date.now() - FENETRE_JOURS * 24 * 3600 * 1000);
      const uids = await client.search(
        { since: depuis, or: [{ from: "mailer-daemon" }, { from: "postmaster" }] },
        { uid: true },
      );
      if (!uids || uids.length === 0) return bilan;

      const messages: FetchMessageObject[] = await client.fetchAll(
        uids,
        { uid: true, envelope: true, bodyStructure: true, headers: true },
        { uid: true },
      );

      // Les avis déjà reportés sont écartés avant tout téléchargement. Un avis
      // à plusieurs destinataires (clé `id#rang`) n'est pas reconnu ici : il
      // est relu, et `enregistrerAvis` l'écarte destinataire par destinataire.
      const ids = messages.map((m) => m.envelope?.messageId).filter((id): id is string => !!id);
      const connus = new Set(
        (
          await prisma.notificationLog.findMany({
            where: { bounceMessageId: { in: ids } },
            select: { bounceMessageId: true },
          })
        ).map((ligne) => ligne.bounceMessageId),
      );

      const objets = await indexDesObjets();

      // Les téléchargements se font après `fetchAll`, jamais pendant : imapflow
      // ne sert qu'une commande à la fois sur la connexion.
      for (const message of messages) {
        if (message.envelope?.messageId && connus.has(message.envelope.messageId)) {
          bilan.dejaConnus += 1;
          continue;
        }
        const morceaux = parties(message.bodyStructure);
        const rapport = morceaux.find((p) => p.type.toLowerCase() === "message/delivery-status");
        if (!rapport?.part) continue;
        const original = morceaux.find((p) =>
          ["message/rfc822", "text/rfc822-headers", "message/rfc822-headers"].includes(
            p.type.toLowerCase(),
          ),
        );

        const avis = analyserAvis({
          enTetes: message.headers?.toString("utf8") ?? "",
          rapport: (await telecharger(client, message.uid, rapport.part)) ?? "",
          original: original?.part ? await telecharger(client, message.uid, original.part) : null,
        });
        if (!avis) continue;
        avis.messageId ??= message.envelope?.messageId ?? null;

        bilan.avisLus += 1;
        if ((await enregistrerAvis(avis, objets)) === "nouveau") bilan.nouveaux += 1;
        else bilan.dejaConnus += 1;
      }
    } finally {
      verrou.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return bilan;
}

// ---------------------------------------------------------------------------
// Passage périodique
// ---------------------------------------------------------------------------

const INTERVALLE_MS = 15 * 60 * 1000;
let demarre = false;
let enCours: Promise<BilanReleve> | null = null;

/** Un seul relevé à la fois : le bouton du BackOffice et la minuterie se rejoignent. */
export function releverRebondsUneFois(): Promise<BilanReleve> {
  enCours ??= releverRebonds().finally(() => {
    enCours = null;
  });
  return enCours;
}

/**
 * Lancé au démarrage du serveur (`instrumentation-node.ts`). Sans IMAP
 * configuré — développement avec Mailpit, tests —, ne fait rien.
 */
export function demarrerReleveRebonds(): void {
  if (demarre || !configImap() || process.env.NODE_ENV === "test") return;
  demarre = true;

  const passer = () => {
    releverRebondsUneFois()
      .then((bilan) => {
        if (bilan.nouveaux > 0) {
          console.info(`[rebonds] ${bilan.nouveaux} rebond(s) reporté(s) au journal.`);
        }
      })
      .catch((error: unknown) => {
        console.error(
          "[rebonds] Relevé impossible :",
          error instanceof Error ? error.message : error,
        );
      });
  };

  setTimeout(passer, 60 * 1000).unref();
  setInterval(passer, INTERVALLE_MS).unref();
}
