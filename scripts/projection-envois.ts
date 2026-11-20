import "dotenv/config";
import { prisma } from "../src/lib/db";
import { BOITES, configBoite, type BoiteEnvoi } from "../src/lib/mail";
import { CATALOGUE } from "../src/modules/notifications/catalogue";
import { boitePourModele } from "../src/modules/notifications/boites";
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

/**
 * Le plafond d'une boîte donnée, `<PRÉFIXE>PLAFOND_QUOTIDIEN`.
 *
 * Un plafond unique a cessé d'être vrai le 20 novembre 2026 : les cinq voies
 * ne sont plus chez le même fournisseur. Mailjet plafonne à deux cents envois
 * sur son palier gratuit, un compte Gmail ordinaire à cinq cents — projeter
 * 5 × 200 serait alarmiste sur les quatre comptes Gmail, 5 × 500 rassurant à
 * tort sur Mailjet. Les deux erreurs se paient au même endroit : la décision
 * de valider ou non les inscrits en lot ce soir.
 *
 * Le préfixe de la transactionnelle étant `SMTP_`, son plafond reste
 * `SMTP_PLAFOND_QUOTIDIEN` — la variable existante, qui sert aussi de défaut
 * aux voies qui ne déclarent rien.
 */
function plafond(boite: BoiteEnvoi): number {
  return Number(process.env[`${BOITES[boite].prefixe}PLAFOND_QUOTIDIEN`]) || PLAFOND_PAR_BOITE;
}

// La répartition des modèles entre les boîtes n'est plus recopiée ici : elle
// est dans `modules/notifications/boites.ts`, avec les envois eux-mêmes. Une
// liste tenue en double finit par mentir, et une projection qui ment sur la
// boîte qui va déborder ne sert à rien.

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

  const envoyes = new Map<BoiteEnvoi, number>();
  for (const { templateKey, _count } of envois) {
    const boite = boitePourModele(templateKey);
    envoyes.set(boite, (envoyes.get(boite) ?? 0) + _count._all);
  }

  /*
   * Les **comptes**, et non les voies.
   *
   * Un quota appartient à une boîte aux lettres, pas à une catégorie de
   * message : deux voies repliées sur le même compte — faute de
   * `SMTP_<VOIE>_*`, le cas du développement — partagent un seul plafond. Les
   * regrouper par `hôte:identifiant` évite de compter deux fois une capacité
   * qui n'existe qu'une fois, ce qui était l'erreur à ne pas reproduire en
   * passant de deux boîtes à cinq.
   */
  const comptes = new Map<
    string,
    { voies: string[]; envoyes: number; user?: string; plafond: number }
  >();
  for (const boite of Object.keys(BOITES) as BoiteEnvoi[]) {
    const config = configBoite(boite);
    const cle = `${config.host}:${config.user ?? ""}`;
    const entree = comptes.get(cle) ?? {
      voies: [],
      envoyes: 0,
      user: config.user,
      plafond: Infinity,
    };
    entree.voies.push(BOITES[boite].libelle);
    entree.envoyes += envoyes.get(boite) ?? 0;
    // Deux voies sur un même compte ne cumulent pas leurs plafonds : elles se
    // partagent le plus bas des deux, qui est celui du compte réel.
    entree.plafond = Math.min(entree.plafond, plafond(boite));
    comptes.set(cle, entree);
  }

  titre("Capacité des boîtes (24 h glissantes)");
  for (const compte of comptes.values()) {
    ligne(
      `${compte.voies.join(" + ")} — ${compte.user ?? "?"}`,
      `${compte.envoyes} envoyés / ${compte.plafond}`,
    );
    ligne("  reste estimé", Math.max(0, compte.plafond - compte.envoyes));
  }
  const capacite = [...comptes.values()].reduce((somme, compte) => somme + compte.plafond, 0);
  ligne("CAPACITÉ TOTALE PAR JOUR", capacite);
  if (comptes.size < Object.keys(BOITES).length) {
    console.log(
      `\n  ${Object.keys(BOITES).length} voies pour ${comptes.size} compte(s) : ` +
        "celles qui partagent une ligne ci-dessus partagent aussi un quota.",
    );
  }

  // -------------------------------------------------------------------------
  // Le verdict
  // -------------------------------------------------------------------------

  /*
   * Les pics attendus, voie par voie.
   *
   * Une validation en lot envoie deux messages par personne — la confirmation
   * et le badge — mais depuis le 20 novembre 2026 ils partent de **deux
   * comptes distincts** (`boites.ts`). Le pic d'une boîte est donc d'un
   * message par personne, non de deux : c'est précisément ce que la séparation
   * a acheté, et l'ancien `enAttente * 2` sur une seule boîte le masquait.
   */
  const pics: { voie: BoiteEnvoi; libelle: string; messages: number }[] = [
    { voie: "campagne", libelle: "La campagne la plus lourde", messages: Math.max(resteJ1, total) },
    { voie: "participation", libelle: "Les confirmations en attente", messages: enAttente },
    { voie: "acces", libelle: "Les badges en attente", messages: enAttente },
  ];

  titre("Verdict");
  for (const pic of pics) {
    console.log(`  ${pic.libelle.padEnd(34, ".")} ${pic.messages} messages`);
  }
  console.log(`  ${"Capacité quotidienne".padEnd(34, ".")} ${capacite} messages\n`);

  const alertes: string[] = [];
  for (const pic of pics) {
    const limite = plafond(pic.voie);
    if (pic.messages <= limite) continue;
    const jours = Math.ceil(pic.messages / limite);
    alertes.push(
      `${pic.libelle} (${pic.messages}) dépasse le plafond de la boîte « ` +
        `${BOITES[pic.voie].libelle} » (${limite}) : ${jours} jours d'écoulement, ` +
        `ou des lots de ${limite}.`,
    );
  }
  const aEcouler = pics.reduce((somme, pic) => somme + pic.messages, 0);
  if (aEcouler > capacite) {
    alertes.push(
      `Le total à écouler (${aEcouler}) dépasse la capacité quotidienne (${capacite}) : ` +
        "il faut étaler sur plusieurs jours, ou un compte de plus.",
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
