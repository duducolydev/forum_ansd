import "dotenv/config";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import {
  ACTUALITES_DEMO,
  DELEGATIONS_DEMO,
  descriptionSeanceDemo,
  emailIntervenantDemo,
  HOTELS_DEMO,
  INTERVENANTS_DEMO,
  INVITATIONS_DEMO,
  JOURS_DEMO,
  NOTE_PARTICIPANT_DEMO,
  PARTENAIRES_DEMO,
  PARTICIPANTS_DEMO,
  PROGRAMME_DEMO,
  slugSeanceDemo,
  SUPERADMIN_DEMO,
} from "../prisma/donnees-demo";

/**
 * Retire les données de démonstration d'une base en service (19 octobre 2026).
 *
 *     pnpm demo:purger                          # inventaire : rien n'est modifié
 *     pnpm demo:purger --appliquer              # retire ce que l'inventaire annonce
 *     pnpm demo:purger --appliquer --inclure <id,…> --garder <id,…>
 *     pnpm demo:purger --participant "Oumar Ba" --intervenant "Prénom Nom"
 *
 * Sur le serveur, après une sauvegarde :
 *
 *     forum run --rm outils pnpm demo:purger
 *
 * **Inventaire par défaut**, à l'inverse des scripts de section (`--essai`) : un
 * oubli d'option doit coûter une relecture, pas des fiches.
 *
 * ## Ce qui est reconnu comme démonstration
 *
 * Ce que `prisma/donnees-demo.ts` décrit — la source même du seed — et ce qui
 * ne peut appartenir à personne : une adresse sur un domaine réservé (`.test`,
 * `example.com`…) ou en `@demo.ansd.sn`. Rien d'autre.
 *
 * Une fiche de contenu (séance, intervenant, partenaire, hôtel, actualité) n'est
 * retirée que si elle est **intacte depuis le seed** (`updatedAt` égal à
 * `createdAt` : aucune colonne n'est mise à jour par la base elle-même, les
 * migrations n'y touchent pas), ou déjà supprimée dans le BackOffice. Une fiche
 * retouchée a peut-être été reprise pour le vrai programme : elle est
 * **conservée et signalée**, et c'est `--inclure` qui tranche, identifiant par
 * identifiant, après relecture.
 *
 * Exception : un **intervenant** du jeu (nom et adresse du seed) est retiré même
 * retouché, de même que tout intervenant à l'adresse fictive — ce sont des
 * personnes inventées, qu'une photo ou une séance ne rendent pas réelles
 * (demande du 20 octobre 2026).
 *
 * Sont aussi signalés sans être touchés : les participants et invitations dont
 * le nom ou l'adresse évoquent un essai, et tout texte encore marqué `[DEMO]`.
 *
 * ## Désigner une fiche d'essai par son nom
 *
 * Une fiche d'essai saisie à la main ne porte aucune marque : `--participant` et
 * `--intervenant` la désignent par son nom (répétables, accents et casse
 * ignorés, prénom et nom dans un ordre ou l'autre). Un seul porteur du nom : il
 * est retiré, avec l'invitation à son adresse. Plusieurs : tous passent « à
 * vérifier », et `--inclure` choisit — un homonyme réel ne doit pas partir avec
 * la fiche d'essai. Un nom que personne ne porte arrête le script.
 *
 * ## Ce qui est fait
 *
 * - les envois en attente vers ces fiches sont retirés de la file, **en
 *   premier** : un rappel programmé partirait sinon vers une adresse de
 *   démonstration — certaines sont sur des domaines réels ;
 * - les fiches sont supprimées dans une seule transaction, avec ce qui en
 *   dépend (badges, scans, inscriptions aux séances, liens d'accès…) ;
 * - les comptes BackOffice de démonstration sont **supprimés s'ils n'ont jamais
 *   rien fait**, **désactivés** sinon, mot de passe publié neutralisé : le
 *   journal d'audit garde ainsi la trace de qui a fait quoi. Le dernier
 *   super-administrateur actif n'est jamais touché ;
 * - les fichiers des fiches retirées (badges, photos, logos) sont effacés ;
 * - une entrée `demo.purge` au journal d'audit récapitule le tout. Le journal
 *   lui-même n'est pas nettoyé : il est immuable (`src/lib/audit.ts`).
 *
 * Rien de ce qui est réel n'en dépend : les salles, zones, catégories, rôles,
 * modèles d'e-mails, contacts et textes posés par le seed sont des données de
 * référence, et restent.
 */

interface Fiche {
  id: string;
  libelle: string;
  motif: string;
  /** Refusé même avec `--inclure` (dernier super-administrateur actif). */
  verrouillee?: boolean;
}

interface Rubrique {
  titre: string;
  aRetirer: Fiche[];
  aVerifier: Fiche[];
}

// --- Options ---------------------------------------------------------------------

function liste(option: string): Set<string> {
  const rang = process.argv.indexOf(option);
  if (rang === -1) return new Set();
  const valeur = process.argv[rang + 1];
  if (!valeur || valeur.startsWith("--"))
    throw new Error(`${option} attend une liste d'identifiants.`);
  return new Set(
    valeur
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/** Toutes les occurrences d'une option qui nomme des personnes (`--participant "Oumar Ba"`). */
function noms(option: string): string[] {
  const valeurs: string[] = [];
  process.argv.forEach((argument, rang) => {
    if (argument !== option) return;
    const valeur = process.argv[rang + 1];
    if (!valeur || valeur.startsWith("--")) {
      throw new Error(`${option} attend un nom : ${option} "Prénom Nom".`);
    }
    valeurs.push(
      ...valeur
        .split(",")
        .map((nom) => nom.trim())
        .filter(Boolean),
    );
  });
  return valeurs;
}

const APPLIQUER = process.argv.includes("--appliquer");
let INCLURE = new Set<string>();
let GARDER = new Set<string>();
let PARTICIPANTS_NOMMES: string[] = [];
let INTERVENANTS_NOMMES: string[] = [];
const utilises = new Set<string>();

/** Lu depuis `main`, pour qu'une option mal formée s'affiche en clair, sans trace de pile. */
function lireOptions(): void {
  INCLURE = liste("--inclure");
  GARDER = liste("--garder");
  PARTICIPANTS_NOMMES = noms("--participant");
  INTERVENANTS_NOMMES = noms("--intervenant");
  for (const id of INCLURE) {
    if (GARDER.has(id)) throw new Error(`${id} figure à la fois dans --inclure et dans --garder.`);
  }
}

/** Applique `--inclure` et `--garder` à une rubrique, puis la fige. */
function arbitrer(rubrique: Rubrique): Rubrique {
  const aRetirer = rubrique.aRetirer.filter((fiche) => {
    if (!GARDER.has(fiche.id)) return true;
    utilises.add(fiche.id);
    rubrique.aVerifier.push({ ...fiche, motif: `${fiche.motif} — gardé sur demande (--garder)` });
    return false;
  });
  const aVerifier = rubrique.aVerifier.filter((fiche) => {
    if (!INCLURE.has(fiche.id)) return true;
    utilises.add(fiche.id);
    if (fiche.verrouillee) {
      throw new Error(`${fiche.id} ne peut pas être inclus : ${fiche.motif}.`);
    }
    aRetirer.push({ ...fiche, motif: `${fiche.motif} — inclus sur demande (--inclure)` });
    return false;
  });
  return { ...rubrique, aRetirer, aVerifier };
}

// --- Critères ----------------------------------------------------------------------

/** Domaines réservés (RFC 2606, RFC 6761) : une adresse qui ne peut appartenir à personne. */
function adresseFictive(email: string | null | undefined): boolean {
  if (!email) return false;
  const domaine = email.toLowerCase().split("@")[1] ?? "";
  return (
    /(^|\.)(test|example|invalid|localhost)$/.test(domaine) ||
    /(^|\.)example\.(com|net|org)$/.test(domaine) ||
    domaine === "demo.ansd.sn"
  );
}

function evoqueUnEssai(...textes: (string | null | undefined)[]): boolean {
  return textes.some((texte) => texte && /(^|[^a-z])(test|essai)([^a-z]|$)/i.test(texte));
}

/** Jamais retouchée depuis sa création : ni en BackOffice, ni ailleurs. */
function intacte(fiche: { createdAt: Date; updatedAt: Date }): boolean {
  return Math.abs(fiche.updatedAt.getTime() - fiche.createdAt.getTime()) < 1000;
}

const minuscules = (valeurs: Iterable<string>) => new Set([...valeurs].map((v) => v.toLowerCase()));

function nomNormalise(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** « Oumar Ba », « BA Oumar » et « oumar  bâ » désignent la même personne. */
function porteLeNom(personne: { firstName: string; lastName: string }, nom: string): boolean {
  const cherche = nomNormalise(nom);
  return (
    nomNormalise(`${personne.firstName} ${personne.lastName}`) === cherche ||
    nomNormalise(`${personne.lastName} ${personne.firstName}`) === cherche
  );
}

/**
 * Place dans la rubrique les personnes désignées par leur nom : retirée si elle
 * est seule à le porter, « à vérifier » s'il y a des homonymes.
 */
function designer(
  rubrique: Rubrique,
  personnes: { id: string; firstName: string; lastName: string; libelle: string }[],
  nomsDesignes: string[],
  option: string,
): void {
  for (const nom of nomsDesignes) {
    const porteurs = personnes.filter((personne) => porteLeNom(personne, nom));
    if (porteurs.length === 0) {
      throw new Error(`Aucune fiche au nom de « ${nom} » (${option}) : rien n'a été fait.`);
    }
    for (const porteur of porteurs) {
      if (rubrique.aRetirer.some((fiche) => fiche.id === porteur.id)) continue;
      rubrique.aVerifier = rubrique.aVerifier.filter((fiche) => fiche.id !== porteur.id);
      const fiche = { id: porteur.id, libelle: porteur.libelle };
      if (porteurs.length === 1) {
        rubrique.aRetirer.push({ ...fiche, motif: `désigné par son nom (${option} « ${nom} »)` });
      } else {
        rubrique.aVerifier.push({
          ...fiche,
          motif: `${porteurs.length} fiches au nom de « ${nom} » : choisir avec --inclure <id>`,
        });
      }
    }
  }
}

// --- Inventaire ----------------------------------------------------------------------

async function inventorierParticipants(): Promise<Rubrique> {
  const adressesDemo = minuscules(PARTICIPANTS_DEMO.map((p) => p.email));
  const participants = (
    await prisma.participant.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        notes: true,
        status: true,
        createdAt: true,
      },
      orderBy: { email: "asc" },
    })
  ).map((p) => ({
    ...p,
    // La date d'inscription départage deux homonymes.
    libelle: `${p.firstName} ${p.lastName} <${p.email}> (${p.status}, inscrit le ${p.createdAt
      .toISOString()
      .slice(0, 10)})`,
  }));

  const rubrique: Rubrique = { titre: "Participants", aRetirer: [], aVerifier: [] };
  for (const p of participants) {
    const email = p.email.toLowerCase();
    const fiche = { id: p.id, libelle: p.libelle };
    if (adressesDemo.has(email) && p.notes === NOTE_PARTICIPANT_DEMO) {
      rubrique.aRetirer.push({ ...fiche, motif: "participant du jeu de démonstration" });
    } else if (adresseFictive(email)) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "adresse de démonstration ou sur un domaine réservé",
      });
    } else if (adressesDemo.has(email)) {
      rubrique.aVerifier.push({
        ...fiche,
        motif: "adresse du jeu de démonstration, mais sa note a été modifiée",
      });
    } else if (p.notes?.includes("[DEMO]")) {
      rubrique.aVerifier.push({ ...fiche, motif: "note marquée [DEMO]" });
    } else if (email.startsWith("demo.")) {
      rubrique.aVerifier.push({ ...fiche, motif: "adresse en « demo. »" });
    } else if (evoqueUnEssai(p.firstName, p.lastName, email.split("@")[0])) {
      rubrique.aVerifier.push({ ...fiche, motif: "nom ou adresse d'essai ?" });
    }
  }
  designer(rubrique, participants, PARTICIPANTS_NOMMES, "--participant");
  return arbitrer(rubrique);
}

async function inventorierInvitations(
  participantsRetires: Set<string>,
  adressesRetirees: Set<string>,
): Promise<Rubrique> {
  const adressesDemo = minuscules(INVITATIONS_DEMO.map((i) => i.email));
  const invitations = await prisma.invitation.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      participant: { select: { id: true } },
    },
    orderBy: { email: "asc" },
  });

  const rubrique: Rubrique = { titre: "Invitations", aRetirer: [], aVerifier: [] };
  for (const i of invitations) {
    const email = i.email.toLowerCase();
    const fiche = { id: i.id, libelle: `${i.firstName} ${i.lastName} <${i.email}> (${i.status})` };
    const demo = adressesDemo.has(email) || adresseFictive(email);
    const participantConserve = i.participant && !participantsRetires.has(i.participant.id);
    const duParticipantRetire =
      (i.participant && participantsRetires.has(i.participant.id)) || adressesRetirees.has(email);

    if (duParticipantRetire && !participantConserve) {
      rubrique.aRetirer.push({ ...fiche, motif: "invitation d'un participant retiré" });
    } else if (demo && participantConserve) {
      rubrique.aVerifier.push({
        ...fiche,
        motif: "invitation de démonstration, mais rattachée à un participant conservé",
      });
    } else if (adressesDemo.has(email)) {
      rubrique.aRetirer.push({ ...fiche, motif: "invitation du jeu de démonstration" });
    } else if (adresseFictive(email)) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "adresse de démonstration ou sur un domaine réservé",
      });
    } else if (email.startsWith("demo.")) {
      rubrique.aVerifier.push({ ...fiche, motif: "adresse en « demo. »" });
    } else if (evoqueUnEssai(i.firstName, i.lastName, email.split("@")[0])) {
      rubrique.aVerifier.push({ ...fiche, motif: "nom ou adresse d'essai ?" });
    }
  }
  return arbitrer(rubrique);
}

async function inventorierDelegations(participantsRetires: Set<string>): Promise<Rubrique> {
  const nomsDemo = new Set<string>(Object.values(DELEGATIONS_DEMO).map((d) => d.name));
  const delegations = await prisma.delegation.findMany({
    select: { id: true, name: true, members: { select: { id: true } } },
  });

  const rubrique: Rubrique = { titre: "Délégations", aRetirer: [], aVerifier: [] };
  for (const d of delegations) {
    if (!nomsDemo.has(d.name) && !d.name.includes("[DEMO]")) continue;
    const reels = d.members.filter((m) => !participantsRetires.has(m.id)).length;
    const fiche = { id: d.id, libelle: d.name };
    if (reels === 0) {
      rubrique.aRetirer.push({ ...fiche, motif: "délégation de démonstration, sans membre réel" });
    } else {
      rubrique.aVerifier.push({
        ...fiche,
        motif: `délégation de démonstration, ${reels} membre(s) conservé(s)`,
      });
    }
  }
  return arbitrer(rubrique);
}

async function inventorierIntervenants(seancesRetirees: Set<string>): Promise<Rubrique> {
  const seed = new Map<string, { firstName: string; lastName: string }>(
    INTERVENANTS_DEMO.map(([firstName, lastName]) => [
      emailIntervenantDemo(firstName, lastName),
      { firstName, lastName },
    ]),
  );
  const intervenants = await prisma.speaker.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      bioFr: true,
      photoPath: true,
      sessions: { select: { sessionId: true } },
      _count: { select: { contributions: { where: { origine: "INTERVENANT" } } } },
    },
    orderBy: { lastName: "asc" },
  });

  const personnes = intervenants.map((s) => {
    // Séances qui restent au programme : l'intervenant en disparaîtra aussi.
    const conservees = s.sessions.filter((lien) => !seancesRetirees.has(lien.sessionId)).length;
    const depots = s._count.contributions;
    return {
      ...s,
      libelle:
        `${s.firstName} ${s.lastName} <${s.email ?? "sans adresse"}>` +
        (conservees > 0 ? ` — retiré aussi de ${conservees} séance(s) conservée(s)` : "") +
        (depots > 0 ? ` — ${depots} présentation(s) déposée(s), retirée(s) avec lui` : ""),
    };
  });

  const rubrique: Rubrique = { titre: "Intervenants", aRetirer: [], aVerifier: [] };
  for (const s of personnes) {
    const identite = s.email ? seed.get(s.email.toLowerCase()) : undefined;
    const duSeed = identite?.firstName === s.firstName && identite.lastName === s.lastName;
    const fiche = { id: s.id, libelle: s.libelle };

    // Une personne inventée le reste, même dotée d'une photo ou d'une séance :
    // pas de condition « intacte » ici, contrairement aux fiches de contenu.
    if (duSeed) {
      rubrique.aRetirer.push({ ...fiche, motif: "intervenant du jeu de démonstration" });
    } else if (adresseFictive(s.email)) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "adresse sur un domaine réservé : intervenant d'essai, injoignable",
      });
    } else if (s.bioFr?.includes("[DEMO]")) {
      rubrique.aVerifier.push({ ...fiche, motif: "biographie marquée [DEMO]" });
    } else if (evoqueUnEssai(s.firstName, s.lastName, s.email?.split("@")[0])) {
      rubrique.aVerifier.push({ ...fiche, motif: "nom ou adresse d'essai ?" });
    }
  }
  designer(rubrique, personnes, INTERVENANTS_NOMMES, "--intervenant");
  return arbitrer(rubrique);
}

async function inventorierSeances(participantsRetires: Set<string>): Promise<Rubrique> {
  const seed = new Map<string, string>();
  for (const jour of JOURS_DEMO) {
    for (const item of PROGRAMME_DEMO[jour] ?? []) {
      seed.set(slugSeanceDemo(jour, item.titleFr), item.titleFr);
    }
  }
  const seances = await prisma.session.findMany({
    select: {
      id: true,
      slug: true,
      titleFr: true,
      descriptionFr: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      registrations: { select: { participantId: true } },
      _count: { select: { contributions: true, rapporteurs: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  const rubrique: Rubrique = { titre: "Séances du programme", aRetirer: [], aVerifier: [] };
  for (const s of seances) {
    const titreSeed = seed.get(s.slug);
    const fiche = { id: s.id, libelle: `${s.titleFr} (${s.slug})` };
    const inscritsReels = s.registrations.filter(
      (r) => !participantsRetires.has(r.participantId),
    ).length;
    const travail = s._count.contributions + s._count.rapporteurs;

    if (titreSeed === undefined) {
      if (s.descriptionFr?.includes("[DEMO]")) {
        rubrique.aVerifier.push({ ...fiche, motif: "description marquée [DEMO]" });
      }
      continue;
    }

    if (s.deletedAt && inscritsReels === 0 && travail === 0) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "séance de démonstration, déjà supprimée en BackOffice",
      });
    } else if (inscritsReels > 0) {
      rubrique.aVerifier.push({
        ...fiche,
        motif: `séance de démonstration, mais ${inscritsReels} vrai(s) participant(s) y sont inscrits`,
      });
    } else if (travail > 0) {
      rubrique.aVerifier.push({
        ...fiche,
        motif: "séance de démonstration avec contributions ou rapporteurs",
      });
    } else if (
      intacte(s) &&
      s.titleFr === titreSeed &&
      s.descriptionFr === descriptionSeanceDemo(titreSeed)
    ) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "séance de démonstration, intacte depuis le seed",
      });
    } else {
      rubrique.aVerifier.push({
        ...fiche,
        motif:
          "séance de démonstration retouchée depuis le seed : peut-être reprise pour le vrai programme",
      });
    }
  }
  return arbitrer(rubrique);
}

async function inventorierHotels(): Promise<Rubrique> {
  const nomsDemo = new Set<string>(HOTELS_DEMO.map((h) => h.name));
  const hotels = await prisma.hotel.findMany({
    select: { id: true, name: true, deletedAt: true, createdAt: true, updatedAt: true },
  });
  const rubrique: Rubrique = { titre: "Hôtels", aRetirer: [], aVerifier: [] };
  for (const h of hotels) {
    if (!nomsDemo.has(h.name) && !h.name.includes("[DEMO]")) continue;
    const fiche = { id: h.id, libelle: h.name };
    if (h.deletedAt) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "hôtel de démonstration, déjà supprimé en BackOffice",
      });
    } else if (nomsDemo.has(h.name) && intacte(h)) {
      rubrique.aRetirer.push({ ...fiche, motif: "hôtel de démonstration, intact depuis le seed" });
    } else {
      rubrique.aVerifier.push({ ...fiche, motif: "hôtel marqué [DEMO], retouché depuis le seed" });
    }
  }
  return arbitrer(rubrique);
}

async function inventorierPartenaires(): Promise<Rubrique> {
  const nomsDemo = new Set<string>(PARTENAIRES_DEMO.map((s) => s.name));
  const partenaires = await prisma.sponsor.findMany({
    select: {
      id: true,
      name: true,
      logoPath: true,
      website: true,
      descriptionFr: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const rubrique: Rubrique = { titre: "Partenaires", aRetirer: [], aVerifier: [] };
  for (const s of partenaires) {
    if (!nomsDemo.has(s.name)) continue;
    const fiche = { id: s.id, libelle: `${s.name}${s.logoPath ? " (avec logo)" : ""}` };
    if (s.deletedAt) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "partenaire de démonstration, déjà supprimé en BackOffice",
      });
    } else if (intacte(s) && !s.logoPath && !s.website && !s.descriptionFr) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "partenaire de démonstration, intact depuis le seed (sans logo)",
      });
    } else {
      rubrique.aVerifier.push({
        ...fiche,
        motif:
          "partenaire du jeu de démonstration retouché (logo, texte ou ordre) : peut-être un vrai partenaire",
      });
    }
  }
  return arbitrer(rubrique);
}

async function inventorierActualites(): Promise<Rubrique> {
  const slugsDemo = new Set<string>(ACTUALITES_DEMO.map((p) => p.slug));
  const actualites = await prisma.post.findMany({
    select: { id: true, slug: true, titleFr: true, bodyFr: true, createdAt: true, updatedAt: true },
  });
  const rubrique: Rubrique = { titre: "Actualités", aRetirer: [], aVerifier: [] };
  for (const p of actualites) {
    const fiche = { id: p.id, libelle: `${p.titleFr} (${p.slug})` };
    if (slugsDemo.has(p.slug) && intacte(p) && p.bodyFr.startsWith("[DEMO]")) {
      rubrique.aRetirer.push({
        ...fiche,
        motif: "actualité de démonstration, intacte depuis le seed",
      });
    } else if (slugsDemo.has(p.slug) || p.bodyFr.includes("[DEMO]")) {
      rubrique.aVerifier.push({
        ...fiche,
        motif: "actualité de démonstration retouchée, ou texte marqué [DEMO]",
      });
    }
  }
  return arbitrer(rubrique);
}

interface CompteARetirer extends Fiche {
  action: "supprimer" | "desactiver";
}

type RubriqueComptes = Omit<Rubrique, "aRetirer"> & { aRetirer: CompteARetirer[] };

async function inventorierComptes(): Promise<RubriqueComptes> {
  const comptes = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      lastLoginAt: true,
      role: { select: { name: true } },
      _count: {
        select: {
          auditLogs: true,
          confirmedParticipants: true,
          generatedBadges: true,
          scans: true,
          updatedContentBlocks: true,
          grantedZoneOverrides: true,
        },
      },
    },
  });

  const demo = (c: (typeof comptes)[number]) =>
    c.email.toLowerCase() === SUPERADMIN_DEMO.email ||
    adresseFictive(c.email) ||
    c.name.includes("[DEMO]");
  const superAdminsActifsReels = comptes.filter(
    (c) => c.isActive && c.role.name === "SUPER_ADMIN" && !demo(c),
  ).length;

  const rubrique: Rubrique = { titre: "Comptes BackOffice", aRetirer: [], aVerifier: [] };
  const actions = new Map<string, CompteARetirer["action"]>();
  for (const c of comptes) {
    if (!demo(c)) continue;
    const traces = Object.values(c._count).reduce((total, n) => total + n, 0);
    const action = traces === 0 ? "supprimer" : "desactiver";
    if (action === "desactiver" && !c.isActive) continue; // déjà neutralisé, et gardé pour le journal
    const fiche = {
      id: c.id,
      libelle: `${c.email} — ${c.role.name}, ${
        c.lastLoginAt
          ? `dernière connexion le ${c.lastLoginAt.toISOString().slice(0, 10)}`
          : "jamais connecté"
      }`,
    };

    if (c.isActive && c.role.name === "SUPER_ADMIN" && superAdminsActifsReels === 0) {
      rubrique.aVerifier.push({
        ...fiche,
        motif:
          "compte de démonstration, mais aucun autre super-administrateur actif : créer d'abord un compte nominatif (pnpm create:admin)",
        verrouillee: true,
      });
      continue;
    }
    actions.set(c.id, action);
    rubrique.aRetirer.push({
      ...fiche,
      motif:
        action === "supprimer"
          ? "compte de démonstration, jamais utilisé : supprimé"
          : "compte de démonstration qui a agi : désactivé et mot de passe neutralisé, le journal d'audit garde ses actions",
    });
  }
  const arbitree = arbitrer(rubrique);
  return {
    ...arbitree,
    aRetirer: arbitree.aRetirer.map((fiche) => ({
      ...fiche,
      action: actions.get(fiche.id) ?? "desactiver",
    })),
  };
}

// --- Envois en attente ------------------------------------------------------------------

/** Vrai si une valeur de la charge (récursivement) est l'un des repères — identifiant ou adresse. */
function designe(charge: unknown, reperes: Set<string>): boolean {
  if (typeof charge === "string") return reperes.has(charge.toLowerCase());
  if (Array.isArray(charge)) return charge.some((valeur) => designe(valeur, reperes));
  if (charge && typeof charge === "object") {
    return Object.values(charge).some((valeur) => designe(valeur, reperes));
  }
  return false;
}

async function jobsEnBase(reperes: Set<string>): Promise<string[]> {
  const jobs = await prisma.job.findMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    select: { id: true, payload: true },
  });
  return jobs.filter((job) => designe(job.payload, reperes)).map((job) => job.id);
}

async function avecFileRedis<T>(action: (file: Queue) => Promise<T>): Promise<T | undefined> {
  if (!process.env.REDIS_URL) return undefined;
  const connexion = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const file = new Queue(process.env.QUEUE_NAME ?? "forum-ansd", { connection: connexion });
  try {
    return await action(file);
  } finally {
    await file.close();
    connexion.disconnect();
  }
}

async function jobsRedis(reperes: Set<string>) {
  return avecFileRedis(async (file) => {
    const jobs = await file.getJobs(["waiting", "delayed", "prioritized", "waiting-children"]);
    return jobs.filter((job) => job && designe(job.data, reperes));
  });
}

// --- Rapport ---------------------------------------------------------------------------

function afficher(rubriques: Rubrique[], envois: number, fichiers: number): void {
  const base = (() => {
    try {
      const url = new URL(process.env.DATABASE_URL ?? "");
      return `${url.pathname.slice(1)} sur ${url.hostname}:${url.port || "3306"}`;
    } catch {
      return "base inconnue";
    }
  })();

  console.log(
    `\nNettoyage des données de démonstration — ${
      APPLIQUER ? "APPLICATION" : "INVENTAIRE (rien n'est modifié)"
    }\nBase : ${base}\n`,
  );

  const total = rubriques.reduce((n, r) => n + r.aRetirer.length, 0);
  console.log(
    `À RETIRER — ${total} fiche(s), ${envois} envoi(s) en attente, ${fichiers} fichier(s)\n`,
  );
  for (const r of rubriques.filter((r) => r.aRetirer.length > 0)) {
    console.log(`  ${r.titre} (${r.aRetirer.length})`);
    for (const f of r.aRetirer) console.log(`    - ${f.id}  ${f.libelle}\n        ${f.motif}`);
  }

  const douteux = rubriques.filter((r) => r.aVerifier.length > 0);
  console.log(`\nCONSERVÉ — À VÉRIFIER (${douteux.reduce((n, r) => n + r.aVerifier.length, 0)})`);
  if (douteux.length === 0) console.log("  Rien.");
  else console.log("  Rien n'y sera touché sans --inclure <id,…>.\n");
  for (const r of douteux) {
    console.log(`  ${r.titre} (${r.aVerifier.length})`);
    for (const f of r.aVerifier) console.log(`    - ${f.id}  ${f.libelle}\n        ${f.motif}`);
  }
  console.log("");
}

// --- Exécution ----------------------------------------------------------------------------

async function main(): Promise<void> {
  lireOptions();
  const participants = await inventorierParticipants();
  const participantsRetires = new Set(participants.aRetirer.map((f) => f.id));
  const adressesRetirees = minuscules(
    (
      await prisma.participant.findMany({
        where: { id: { in: [...participantsRetires] } },
        select: { email: true },
      })
    ).map((p) => p.email),
  );
  const invitations = await inventorierInvitations(participantsRetires, adressesRetirees);
  const delegations = await inventorierDelegations(participantsRetires);
  const seances = await inventorierSeances(participantsRetires);
  const intervenants = await inventorierIntervenants(new Set(seances.aRetirer.map((f) => f.id)));
  const hotels = await inventorierHotels();
  const partenaires = await inventorierPartenaires();
  const actualites = await inventorierActualites();
  const comptes = await inventorierComptes();

  const inconnus = [...INCLURE, ...GARDER].filter((id) => !utilises.has(id));
  if (inconnus.length > 0) {
    throw new Error(
      `Identifiant(s) absent(s) de l'inventaire : ${inconnus.join(", ")}. --inclure ne vaut que pour une fiche « à vérifier », --garder pour une fiche « à retirer ».`,
    );
  }

  const ids = (r: Rubrique) => r.aRetirer.map((f) => f.id);
  const P = ids(participants);
  const I = ids(invitations);
  const intervenantsRetires = ids(intervenants);

  // Repères des envois à annuler : identifiants et adresses des fiches retirées.
  const [adressesP, adressesI, adressesS] = await Promise.all([
    prisma.participant.findMany({ where: { id: { in: P } }, select: { email: true } }),
    prisma.invitation.findMany({ where: { id: { in: I } }, select: { email: true } }),
    prisma.speaker.findMany({
      where: { id: { in: intervenantsRetires } },
      select: { email: true },
    }),
  ]);
  const reperes = minuscules([
    ...P,
    ...I,
    ...intervenantsRetires,
    ...[...adressesP, ...adressesI, ...adressesS].flatMap((f) => (f.email ? [f.email] : [])),
  ]);
  const jobsBase = await jobsEnBase(reperes);
  const jobsFile = (await jobsRedis(reperes)) ?? [];

  // Fichiers des fiches retirées.
  const [badges, photosP, fichiersS, logos, photosH, couvertures] = await Promise.all([
    prisma.badge.findMany({
      where: { participantId: { in: P } },
      select: { pdfPath: true, pngPath: true },
    }),
    prisma.participant.findMany({ where: { id: { in: P } }, select: { photoPath: true } }),
    prisma.speaker.findMany({
      where: { id: { in: intervenantsRetires } },
      select: { photoPath: true, presentationPath: true },
    }),
    prisma.sponsor.findMany({
      where: { id: { in: ids(partenaires) } },
      select: { logoPath: true },
    }),
    prisma.hotel.findMany({ where: { id: { in: ids(hotels) } }, select: { photoPath: true } }),
    prisma.post.findMany({
      where: { id: { in: ids(actualites) } },
      select: { coverPath: true, gallery: true },
    }),
  ]);
  const seancesFichiers = await prisma.session.findMany({
    where: { id: { in: ids(seances) } },
    select: { tdrPath: true },
  });
  // Présentations déposées par les intervenants retirés : copiées dans leur
  // propre fichier à chaque séance, elles partent avec eux.
  const presentations = await prisma.contribution.findMany({
    where: { speakerId: { in: intervenantsRetires }, origine: "INTERVENANT" },
    select: { id: true, filePath: true },
  });
  const fichiers = [
    ...badges.flatMap((b) => [b.pdfPath, b.pngPath]),
    ...photosP.map((p) => p.photoPath),
    ...fichiersS.flatMap((s) => [s.photoPath, s.presentationPath]),
    ...logos.map((l) => l.logoPath),
    ...photosH.map((h) => h.photoPath),
    ...couvertures.flatMap((p) => [
      p.coverPath,
      ...(Array.isArray(p.gallery) ? p.gallery : []).map((g) =>
        g && typeof g === "object" && "path" in g ? String(g.path) : null,
      ),
    ]),
    ...seancesFichiers.map((s) => s.tdrPath),
    ...presentations.map((c) => c.filePath),
  ].filter((chemin): chemin is string => Boolean(chemin));

  const rubriques = [
    participants,
    invitations,
    delegations,
    intervenants,
    seances,
    hotels,
    partenaires,
    actualites,
    comptes,
  ];
  afficher(rubriques, jobsBase.length + jobsFile.length, fichiers.length);

  if (!APPLIQUER) {
    console.log(
      "Inventaire seulement. Après une sauvegarde (docs/DEPLOIEMENT.md §3), relancer avec --appliquer.",
    );
    return;
  }

  // 1. Les envois d'abord : un rappel programmé ne doit plus partir.
  for (const job of jobsFile) await job.remove();

  // 2. Les fiches, en une transaction : tout ou rien.
  const neutralise = await argon2.hash(randomBytes(32).toString("hex"), { type: argon2.argon2id });
  const comptesSupprimes = comptes.aRetirer
    .filter((c) => c.action === "supprimer")
    .map((c) => c.id);
  const comptesDesactives = comptes.aRetirer
    .filter((c) => c.action === "desactiver")
    .map((c) => c.id);

  const bilan = await prisma.$transaction(
    async (tx) => {
      const scans = await tx.scanLog.deleteMany({
        where: { OR: [{ participantId: { in: P } }, { badge: { participantId: { in: P } } }] },
      });
      const nombres = {
        scans: scans.count,
        participants: (await tx.participant.deleteMany({ where: { id: { in: P } } })).count,
        invitations: (await tx.invitation.deleteMany({ where: { id: { in: I } } })).count,
        delegations: (await tx.delegation.deleteMany({ where: { id: { in: ids(delegations) } } }))
          .count,
        seances: (await tx.session.deleteMany({ where: { id: { in: ids(seances) } } })).count,
        presentations: (
          await tx.contribution.deleteMany({
            where: { id: { in: presentations.map((c) => c.id) } },
          })
        ).count,
        intervenants: (await tx.speaker.deleteMany({ where: { id: { in: intervenantsRetires } } }))
          .count,
        hotels: (await tx.hotel.deleteMany({ where: { id: { in: ids(hotels) } } })).count,
        partenaires: (await tx.sponsor.deleteMany({ where: { id: { in: ids(partenaires) } } }))
          .count,
        actualites: (await tx.post.deleteMany({ where: { id: { in: ids(actualites) } } })).count,
        comptesSupprimes: (await tx.user.deleteMany({ where: { id: { in: comptesSupprimes } } }))
          .count,
        comptesDesactives: (
          await tx.user.updateMany({
            where: { id: { in: comptesDesactives } },
            data: { isActive: false, passwordHash: neutralise, sessionVersion: { increment: 1 } },
          })
        ).count,
        envois:
          jobsFile.length + (await tx.job.deleteMany({ where: { id: { in: jobsBase } } })).count,
        fichiers: fichiers.length,
      };

      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "demo.purge",
          entity: "Edition",
          entityId: (await tx.edition.findFirst({ select: { id: true } }))?.id ?? "-",
          after: {
            nombres,
            retires: Object.fromEntries(rubriques.map((r) => [r.titre, ids(r)])),
            inclus: [...INCLURE],
            gardes: [...GARDER],
          },
        },
      });
      return nombres;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  // 3. Les fichiers, une fois la base à jour : un fichier orphelin ne gêne
  //    personne, une fiche sans son fichier si.
  let fichiersEchoues = 0;
  for (const chemin of fichiers) {
    await fileStorage.delete(chemin).catch(() => {
      fichiersEchoues += 1;
    });
  }

  console.log("Fait.");
  for (const [cle, n] of Object.entries(bilan)) console.log(`  ${cle.padEnd(18)} ${n}`);
  if (fichiersEchoues > 0)
    console.log(`  (${fichiersEchoues} fichier(s) déjà absent(s) ou illisible(s))`);
  console.log(
    "\nUne entrée « demo.purge » au journal d'audit récapitule l'opération. Redémarrer l'application " +
      "(forum restart app) pour vider les caches de pages.",
  );
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
