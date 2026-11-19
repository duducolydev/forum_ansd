import "dotenv/config";
import { prisma } from "../src/lib/db";
import { configBoite } from "../src/lib/mail";
import { CATALOGUE } from "../src/modules/notifications/catalogue";
import { dureeCampagneMinutes } from "../src/lib/cadence-envoi";

/**
 * Ce que le portail s'apprête à envoyer, et ce que les boîtes peuvent encaisser
 * (18 novembre 2026).
 *
 *     forum run --rm -T outils pnpm envois:projection
 *
 * ## Pourquoi
 *
 * Les quotas d'envoi se discutaient à l'estime — « on doit être autour de trois
 * cents » — alors que la décision d'acheter une capacité supplémentaire se
 * prend sur des nombres. Avec 1 165 inscrits et des rappels J-1 à quatre jours,
 * l'écart entre « ça passe » et « ça ne passe pas » tient à des chiffres que
 * personne n'avait sous les yeux.
 *
 * Lecture seule : ce script n'envoie rien et ne modifie rien.
 *
 * ## Les deux pièges qu'il rend visibles
 *
 * 1. **La validation en lot.** Valider une inscription déclenche *deux*
 *    messages — la confirmation, puis le badge. Valider trois cents personnes
 *    en attente, c'est six cents envois dans la minute, sur la voie
 *    transactionnelle. C'est le pic le plus brutal du dispositif, et le moins
 *    attendu.
 * 2. **La fenêtre glissante.** Un quota Gmail ne se vide pas à minuit : il se
 *    libère au fil des vingt-quatre heures. Compter les envois des dernières
 *    24 h donne donc le reste réellement disponible, pas celui d'un compteur
 *    théorique remis à zéro.
 */

/**
 * Plafond quotidien d'une boîte.
 *
 * Valait 500 en dur : le plafond d'un compte Gmail ordinaire par tranche de
 * 24 h glissantes. Depuis la bascule sur Mailjet (19 novembre 2026), le plafond
 * n'est plus celui d'une boîte aux lettres mais celui du **plan souscrit** —
 * une projection calculée sur 500 serait fausse dans les deux sens : alarmiste
 * sur un plan large, rassurante à tort sur un plan étroit.
 *
 * `SMTP_PLAFOND_QUOTIDIEN` le déclare. Absent, on garde 500 : c'est ce que
 * valait la projection jusqu'ici, et une valeur connue vaut mieux qu'un script
 * qui refuse de répondre.
 */
const PLAFOND_PAR_BOITE = Number(process.env.SMTP_PLAFOND_QUOTIDIEN) || 500;

/** Les modèles qui partent par la voie « campagne » (`lib/mail.ts`). */
const MODELES_CAMPAGNE = new Set([
  "reminder_j7",
  "reminder_j1",
  "invitation",
  "invitation_reminder",
]);

function titre(texte: string): void {
  console.log(`\n${texte}`);
  console.log("-".repeat(texte.length));
}

function ligne(libelle: string, valeur: string | number, largeur = 46): void {
  console.log(`  ${libelle.padEnd(largeur, ".")} ${valeur}`);
}

async function principal(): Promise<void> {
  const edition = await prisma.edition.findFirstOrThrow({
    where: { isActive: true },
    select: { id: true, startDate: true, title: true },
  });

  // -------------------------------------------------------------------------
  // Qui est là
  // -------------------------------------------------------------------------

  const parStatut = await prisma.participant.groupBy({
    by: ["status"],
    where: { editionId: edition.id, deletedAt: null },
    _count: { _all: true },
  });
  const compte = (statut: string): number =>
    parStatut.find((ligne) => ligne.status === statut)?._count._all ?? 0;

  const total = parStatut.reduce((somme, ligne) => somme + ligne._count._all, 0);
  const enAttente = compte("REGISTERED") + compte("REGISTRATION_STARTED");

  titre(`Inscrits — ${edition.title}`);
  for (const { status, _count } of [...parStatut].sort((a, b) => b._count._all - a._count._all)) {
    ligne(status, _count._all);
  }
  ligne("TOTAL", total);

  // -------------------------------------------------------------------------
  // Ce qui est à envoyer
  // -------------------------------------------------------------------------

  titre("Envois à venir");

  // Les rappels visent les confirmés et les badgés (`reminders.ts`).
  const destinatairesRappel = compte("CONFIRMED") + compte("BADGED");
  const dejaRappeles = await prisma.notificationLog.count({
    where: { templateKey: "reminder_j1", status: "SENT", participant: { editionId: edition.id } },
  });
  const resteJ1 = Math.max(0, destinatairesRappel - dejaRappeles);

  ligne("Rappel J-1 (confirmés + badgés)", resteJ1);
  console.log(`      à la cadence actuelle : ~${dureeCampagneMinutes(resteJ1)} min d'écoulement\n`);

  ligne("Newsletter à tous les inscrits", total);
  console.log("");

  // Le piège : valider une inscription envoie la confirmation **et** le badge.
  ligne("En attente de validation", enAttente);
  ligne("  → si le comité les valide en lot", `${enAttente * 2} messages (confirmation + badge)`);

  // -------------------------------------------------------------------------
  // Ce que les boîtes peuvent encaisser
  // -------------------------------------------------------------------------

  const depuis = new Date(Date.now() - 24 * 3600 * 1000);
  const envois = await prisma.notificationLog.groupBy({
    by: ["templateKey"],
    where: { status: "SENT", sentAt: { gte: depuis } },
    _count: { _all: true },
  });

  let campagne = 0;
  let transactionnel = 0;
  for (const { templateKey, _count } of envois) {
    if (MODELES_CAMPAGNE.has(templateKey)) campagne += _count._all;
    else transactionnel += _count._all;
  }

  const boiteT = configBoite("transactionnel");
  const boiteC = configBoite("campagne");
  const separees = boiteT.user !== boiteC.user;

  titre("Capacité des boîtes (24 h glissantes)");
  ligne(`Transactionnelle — ${boiteT.user ?? "?"}`, `${transactionnel} envoyés`);
  ligne("  reste estimé", Math.max(0, PLAFOND_PAR_BOITE - transactionnel));

  if (separees) {
    ligne(`Campagne — ${boiteC.user ?? "?"}`, `${campagne} envoyés`);
    ligne("  reste estimé", Math.max(0, PLAFOND_PAR_BOITE - campagne));
    ligne("CAPACITÉ TOTALE PAR JOUR", PLAFOND_PAR_BOITE * 2);
  } else {
    // Ce n'était qu'une anomalie du temps de Gmail, où deux comptes rendaient
    // les quotas étanches. Avec un relais à plan souscrit, une boîte unique est
    // le réglage attendu : le message informe, il n'alerte plus.
    console.log(`\n  Une seule boîte : les deux voies partagent ${PLAFOND_PAR_BOITE} envois/jour.`);
    ligne("CAPACITÉ TOTALE PAR JOUR", PLAFOND_PAR_BOITE);
  }

  // -------------------------------------------------------------------------
  // Le verdict
  // -------------------------------------------------------------------------

  const capacite = separees ? PLAFOND_PAR_BOITE * 2 : PLAFOND_PAR_BOITE;
  const picCampagne = Math.max(resteJ1, total);
  const picTransactionnel = enAttente * 2;

  titre("Verdict");
  console.log(`  Plus grosse campagne prévue ....... ${picCampagne} messages`);
  console.log(`  Plus gros pic transactionnel ...... ${picTransactionnel} messages`);
  console.log(`  Capacité quotidienne .............. ${capacite} messages\n`);

  const alertes: string[] = [];
  if (picCampagne > PLAFOND_PAR_BOITE) {
    alertes.push(
      `La campagne la plus lourde (${picCampagne}) dépasse le plafond d'une boîte ` +
        `(${PLAFOND_PAR_BOITE}). Elle débordera sur le lendemain.`,
    );
  }
  if (picTransactionnel > PLAFOND_PAR_BOITE) {
    alertes.push(
      `Une validation en lot (${picTransactionnel} messages) dépasse le plafond de la ` +
        `boîte transactionnelle. Valider par tranches de ${Math.floor(PLAFOND_PAR_BOITE / 2)}.`,
    );
  }
  if (picCampagne + picTransactionnel > capacite) {
    alertes.push(
      `Le total à écouler (${picCampagne + picTransactionnel}) dépasse la capacité ` +
        `quotidienne (${capacite}) : il faut étaler sur plusieurs jours, ou une boîte ` +
        `à plus fort plafond.`,
    );
  }

  if (alertes.length === 0) {
    console.log("  Les volumes tiennent dans les plafonds actuels.");
  } else {
    for (const alerte of alertes) console.log(`  ! ${alerte}`);
  }

  // Rappel de ce que le catalogue sait, pour qu'un modèle ajouté depuis ne
  // passe pas inaperçu dans la répartition ci-dessus.
  const inconnus = envois.map(({ templateKey }) => templateKey).filter((cle) => !CATALOGUE[cle]);
  if (inconnus.length > 0) {
    console.log(`\n  (modèles hors catalogue rencontrés : ${inconnus.join(", ")})`);
  }
  console.log("");
}

principal()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
