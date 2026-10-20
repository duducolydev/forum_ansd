import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normaliserCle } from "@/modules/participants/import";
import { ROLES_SESSION, type RoleSession } from "./constantes";
import {
  createSpeaker,
  rattacherSession,
  speakerInputSchema,
  type Actor,
  type SpeakerInput,
} from "./service";

/**
 * Import d'intervenants par fichier Excel/CSV (demande du 20 octobre 2026).
 *
 * Même parcours que l'import de participants : `analyserImport` lit et
 * vérifie sans rien écrire, l'aperçu est relu, et `importerIntervenants`
 * **revérifie** tout à la confirmation — les lignes reviennent du navigateur,
 * qui ne fait pas autorité, et une fiche a pu être créée entre-temps.
 *
 * L'import **crée seulement** : une ligne dont l'intervenant existe déjà (même
 * adresse) est écartée, jamais fusionnée. Une fiche tenue en BackOffice — photo,
 * biographie relue, séances — n'est pas réécrite par un fichier.
 *
 * Aucun e-mail ne part : l'intervenant demande lui-même son lien depuis l'espace
 * intervenant, avec l'adresse importée.
 *
 * Séances : facultatives, désignées par leur numéro, leur titre ou leur adresse
 * courte, séparées par « ; ». Le rôle de la ligne vaut pour toutes ; un même
 * intervenant à deux rôles se rattache ensuite depuis sa fiche.
 */

export const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;
export const LIGNES_MAX = 500;

export interface LigneLue {
  rowNumber: number;
  valeurs: Record<string, string>;
}

export interface ErreurLigne {
  rowNumber: number;
  message: string;
}

export interface SeanceRetenue {
  id: string;
  titre: string;
}

export interface LigneValide {
  rowNumber: number;
  input: SpeakerInput;
  seances: SeanceRetenue[];
  role: RoleSession;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

type Champ =
  | "firstName"
  | "lastName"
  | "email"
  | "jobTitle"
  | "organization"
  | "country"
  | "bioFr"
  | "bioEn"
  | "bioPt"
  | "isPublished"
  | "isFeatured"
  | "featuredOrder"
  | "seances"
  | "role";

/** En-têtes reconnus, après `normaliserCle`. Le modèle utilise le premier de chaque champ. */
const ALIAS: Record<string, Champ> = {
  prenom: "firstName",
  prenoms: "firstName",
  first_name: "firstName",
  firstname: "firstName",
  nom: "lastName",
  nom_de_famille: "lastName",
  last_name: "lastName",
  lastname: "lastName",
  email: "email",
  e_mail: "email",
  adresse_e_mail: "email",
  adresse_email: "email",
  courriel: "email",
  mail: "email",
  fonction: "jobTitle",
  poste: "jobTitle",
  titre: "jobTitle",
  job_title: "jobTitle",
  organisation: "organization",
  organization: "organization",
  institution: "organization",
  structure: "organization",
  pays: "country",
  country: "country",
  biographie_fr: "bioFr",
  biographie: "bioFr",
  bio_fr: "bioFr",
  bio: "bioFr",
  biographie_en: "bioEn",
  bio_en: "bioEn",
  biography: "bioEn",
  biographie_pt: "bioPt",
  bio_pt: "bioPt",
  publie: "isPublished",
  publiee: "isPublished",
  publier: "isPublished",
  publication: "isPublished",
  published: "isPublished",
  mis_en_avant: "isFeatured",
  mise_en_avant: "isFeatured",
  featured: "isFeatured",
  ordre_mise_en_avant: "featuredOrder",
  ordre: "featuredOrder",
  rang: "featuredOrder",
  seances: "seances",
  seance: "seances",
  sessions: "seances",
  session: "seances",
  panels: "seances",
  panel: "seances",
  role: "role",
  role_seance: "role",
  role_dans_la_seance: "role",
};

export function lireFichier(buffer: Buffer): LigneLue[] {
  const classeur = XLSX.read(buffer, { type: "buffer" });
  const feuille = classeur.Sheets[classeur.SheetNames[0]!];
  if (!feuille) return [];
  const lignes: Record<string, unknown>[] = XLSX.utils.sheet_to_json(feuille, {
    defval: "",
    raw: false,
  });

  return lignes
    .map((ligne, index) => {
      const valeurs: Record<string, string> = {};
      for (const [cle, valeur] of Object.entries(ligne)) {
        const champ = ALIAS[normaliserCle(cle)];
        if (champ) valeurs[champ] = String(valeur ?? "").trim();
      }
      return { rowNumber: index + 2, valeurs }; // ligne 1 : en-têtes
    })
    .filter((ligne) => Object.values(ligne.valeurs).some((valeur) => valeur !== ""));
}

// ---------------------------------------------------------------------------
// Vérification
// ---------------------------------------------------------------------------

const OUI = new Set(["oui", "o", "yes", "y", "x", "1", "true", "vrai"]);
const NON = new Set(["", "non", "n", "no", "0", "false", "faux"]);

function lireBooleen(valeur: string | undefined, libelle: string): boolean {
  const cle = normaliserCle(valeur ?? "");
  if (OUI.has(cle)) return true;
  if (NON.has(cle)) return false;
  throw new Error(`Valeur « ${valeur} » non reconnue pour ${libelle} (oui / non).`);
}

function lireOrdre(valeur: string | undefined): number {
  const texte = (valeur ?? "").trim();
  if (texte === "") return 0;
  const nombre = Number(texte);
  if (!Number.isInteger(nombre) || nombre < 0 || nombre > 999) {
    throw new Error(`Ordre de mise en avant « ${valeur} » invalide (nombre entier de 0 à 999).`);
  }
  return nombre;
}

/** Un rôle se désigne par son code, son libellé ou un équivalent courant. */
const ROLES = new Map<string, RoleSession>();
for (const [code, libelle] of Object.entries(ROLES_SESSION) as [RoleSession, string][]) {
  ROLES.set(normaliserCle(code), code);
  ROLES.set(normaliserCle(libelle), code);
}
const EQUIVALENTS_ROLES: Record<string, RoleSession> = {
  moderateur: "MODERATOR",
  moderatrice: "MODERATOR",
  panelist: "PANELIST",
  paneliste: "PANELIST",
  keynote: "KEYNOTE",
  conferencier: "KEYNOTE",
  conferenciere: "KEYNOTE",
  orateur: "KEYNOTE",
  oratrice: "KEYNOTE",
  invitee_d_honneur: "GUEST_OF_HONOR",
  guest_of_honor: "GUEST_OF_HONOR",
};
for (const [cle, code] of Object.entries(EQUIVALENTS_ROLES)) ROLES.set(cle, code);

function lireRole(valeur: string | undefined): RoleSession {
  const cle = normaliserCle(valeur ?? "");
  if (cle === "") return "PANELIST";
  const role = ROLES.get(cle);
  if (!role) {
    throw new Error(`Rôle « ${valeur} » non reconnu (${Object.values(ROLES_SESSION).join(", ")}).`);
  }
  return role;
}

interface Referentiels {
  /** Par numéro, adresse courte ou titre normalisé ; plusieurs séances pour un titre partagé. */
  seances: Map<string, SeanceRetenue[]>;
  /** Intervenants déjà enregistrés, par adresse. */
  adresses: Set<string>;
  /** Noms des intervenants enregistrés **sans** adresse : un import en ferait des doublons. */
  nomsSansAdresse: Set<string>;
  /** Noms de tous les intervenants enregistrés. */
  noms: Set<string>;
}

const cleNom = (prenom: string, nom: string) => normaliserCle(`${prenom} ${nom}`);

async function chargerReferentiels(editionId: string): Promise<Referentiels> {
  const [seances, intervenants] = await Promise.all([
    prisma.session.findMany({
      where: { editionId, deletedAt: null },
      select: { id: true, number: true, slug: true, titleFr: true },
    }),
    prisma.speaker.findMany({
      where: { editionId, deletedAt: null },
      select: { email: true, firstName: true, lastName: true },
    }),
  ]);

  const parSeance = new Map<string, SeanceRetenue[]>();
  const ajouter = (cle: string, seance: SeanceRetenue) => {
    if (!cle) return;
    const deja = parSeance.get(cle) ?? [];
    if (!deja.some((s) => s.id === seance.id)) parSeance.set(cle, [...deja, seance]);
  };
  for (const seance of seances) {
    const retenue = { id: seance.id, titre: seance.titleFr };
    if (seance.number !== null) ajouter(String(seance.number), retenue);
    ajouter(normaliserCle(seance.slug), retenue);
    ajouter(normaliserCle(seance.titleFr), retenue);
  }

  return {
    seances: parSeance,
    adresses: new Set(intervenants.flatMap((s) => (s.email ? [s.email.toLowerCase()] : []))),
    nomsSansAdresse: new Set(
      intervenants.filter((s) => !s.email).map((s) => cleNom(s.firstName, s.lastName)),
    ),
    noms: new Set(intervenants.map((s) => cleNom(s.firstName, s.lastName))),
  };
}

function lireSeances(valeur: string | undefined, referentiels: Referentiels): SeanceRetenue[] {
  const retenues: SeanceRetenue[] = [];
  for (const repere of (valeur ?? "").split(/[;\n|]/).map((texte) => texte.trim())) {
    if (!repere) continue;
    // « 12 », « n° 12 » ou « Séance 12 » : le numéro de la séance.
    const numero = /^(?:n°|no|séance|seance|session)?\s*(\d+)$/i.exec(repere)?.[1];
    const candidates = referentiels.seances.get(numero ?? normaliserCle(repere)) ?? [];
    if (candidates.length === 0) {
      throw new Error(`Séance inconnue : « ${repere} ». Voir la feuille « Séances » du modèle.`);
    }
    if (candidates.length > 1) {
      throw new Error(
        `Plusieurs séances s'intitulent « ${repere} » : désignez-la par son numéro ou son adresse (feuille « Séances »).`,
      );
    }
    if (!retenues.some((s) => s.id === candidates[0]!.id)) retenues.push(candidates[0]!);
  }
  return retenues;
}

export interface ResultatAnalyse {
  valides: LigneValide[];
  erreurs: ErreurLigne[];
}

/**
 * Vérifie chaque ligne sans rien écrire : champs obligatoires, séances et rôle
 * reconnus, doublons dans le fichier et avec les intervenants enregistrés.
 */
export async function analyserImport(
  editionId: string,
  lignes: LigneLue[],
): Promise<ResultatAnalyse> {
  const referentiels = await chargerReferentiels(editionId);
  const erreurs: ErreurLigne[] = [];
  const valides: LigneValide[] = [];
  const adressesVues = new Set<string>();
  const nomsVusSansAdresse = new Set<string>();

  for (const { rowNumber, valeurs } of lignes) {
    try {
      const analyse = speakerInputSchema.safeParse({
        firstName: valeurs.firstName ?? "",
        lastName: valeurs.lastName ?? "",
        email: (valeurs.email ?? "").toLowerCase(),
        jobTitle: valeurs.jobTitle ?? "",
        organization: valeurs.organization ?? "",
        country: valeurs.country ?? "",
        bioFr: valeurs.bioFr ?? "",
        bioEn: valeurs.bioEn ?? "",
        bioPt: valeurs.bioPt ?? "",
        isPublished: lireBooleen(valeurs.isPublished, "la publication"),
        isFeatured: lireBooleen(valeurs.isFeatured, "la mise en avant"),
        featuredOrder: lireOrdre(valeurs.featuredOrder),
      });
      if (!analyse.success) throw new Error(analyse.error.issues[0]?.message ?? "Ligne invalide.");
      const input = analyse.data;
      const nom = cleNom(input.firstName, input.lastName);

      if (input.email) {
        if (adressesVues.has(input.email)) {
          throw new Error(`Adresse en double dans le fichier : ${input.email}.`);
        }
        if (referentiels.adresses.has(input.email)) {
          throw new Error(
            `Déjà enregistré(e) : ${input.email} (fiche existante laissée telle quelle).`,
          );
        }
        if (referentiels.nomsSansAdresse.has(nom)) {
          throw new Error(
            `${input.firstName} ${input.lastName} existe déjà, sans adresse : complétez sa fiche plutôt que de l'importer.`,
          );
        }
        adressesVues.add(input.email);
      } else {
        // Sans adresse, le nom est le seul moyen de reconnaître un doublon.
        if (nomsVusSansAdresse.has(nom)) {
          throw new Error(`${input.firstName} ${input.lastName} figure deux fois, sans adresse.`);
        }
        if (referentiels.noms.has(nom)) {
          throw new Error(`Un intervenant s'appelle déjà ${input.firstName} ${input.lastName}.`);
        }
        nomsVusSansAdresse.add(nom);
      }

      const seances = lireSeances(valeurs.seances, referentiels);
      const role = lireRole(valeurs.role);

      valides.push({ rowNumber, input, seances, role });
    } catch (erreur) {
      erreurs.push({ rowNumber, message: (erreur as Error).message });
    }
  }

  erreurs.sort((a, b) => a.rowNumber - b.rowNumber);
  return { valides, erreurs };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export interface BilanImport {
  crees: number;
  rattachements: number;
  echecs: ErreurLigne[];
}

/**
 * Crée les intervenants vérifiés, un par un, par le chemin ordinaire du
 * BackOffice (trace d'audit, rattachement aux séances). Une ligne qui échoue
 * n'arrête pas les suivantes.
 */
export async function importerIntervenants(
  editionId: string,
  lignes: LigneValide[],
  acteur: Actor,
): Promise<BilanImport> {
  let crees = 0;
  let rattachements = 0;
  const echecs: ErreurLigne[] = [];

  for (const ligne of lignes) {
    let speakerId: string;
    try {
      speakerId = (await createSpeaker(editionId, ligne.input, acteur)).id;
      crees += 1;
    } catch (erreur) {
      echecs.push({ rowNumber: ligne.rowNumber, message: (erreur as Error).message });
      continue;
    }

    for (const seance of ligne.seances) {
      try {
        await rattacherSession(speakerId, seance.id, ligne.role, acteur);
        rattachements += 1;
      } catch (erreur) {
        // La fiche existe : le rattachement manquant se fait depuis elle.
        echecs.push({
          rowNumber: ligne.rowNumber,
          message: `Intervenant créé, mais non rattaché à « ${seance.titre} » : ${
            (erreur as Error).message
          } Rattachez-le depuis sa fiche.`,
        });
      }
    }
  }

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "speaker.import",
    entity: "Speaker",
    entityId: editionId,
    after: { crees, rattachements, echecs: echecs.length },
  });

  return { crees, rattachements, echecs };
}

// ---------------------------------------------------------------------------
// Modèle
// ---------------------------------------------------------------------------

/** Colonnes du modèle, dans l'ordre, avec leur explication (feuille « Aide »). */
const COLONNES_MODELE: { entete: string; exemple: string; aide: string }[] = [
  { entete: "prenom", exemple: "Awa", aide: "Obligatoire." },
  { entete: "nom", exemple: "Ndiaye", aide: "Obligatoire." },
  {
    entete: "email",
    exemple: "awa.ndiaye@institution.sn",
    aide: "Recommandé : sans adresse, l'intervenant ne peut pas recevoir son lien d'accès à l'espace intervenant.",
  },
  { entete: "fonction", exemple: "Directrice des statistiques", aide: "Facultatif." },
  { entete: "organisation", exemple: "Institut national de la statistique", aide: "Facultatif." },
  { entete: "pays", exemple: "Sénégal", aide: "Facultatif." },
  {
    entete: "biographie_fr",
    exemple: "Statisticienne, elle dirige depuis 2020…",
    aide: "Facultatif, 3 000 caractères au plus. L'intervenant peut la compléter lui-même.",
  },
  { entete: "biographie_en", exemple: "", aide: "Facultatif : version anglaise." },
  { entete: "biographie_pt", exemple: "", aide: "Facultatif : version portugaise." },
  {
    entete: "publie",
    exemple: "non",
    aide: "oui / non (non par défaut) : visible sur le site. Publier après relecture de la fiche.",
  },
  {
    entete: "mis_en_avant",
    exemple: "non",
    aide: "oui / non (non par défaut) : montré sur l'accueil, s'il est publié.",
  },
  {
    entete: "ordre_mise_en_avant",
    exemple: "",
    aide: "Facultatif : rang sur l'accueil, de 0 à 999 (le plus petit d'abord).",
  },
  {
    entete: "seances",
    exemple: "",
    aide: "Facultatif : numéro, titre exact ou adresse des séances, séparés par « ; ». Voir la feuille « Séances ».",
  },
  {
    entete: "role",
    exemple: "Panéliste",
    aide: "Rôle dans ces séances, voir la feuille « Rôles » (Panéliste par défaut).",
  },
];

export async function modeleImport(editionId: string): Promise<Buffer> {
  const seances = await prisma.session.findMany({
    where: { editionId, deletedAt: null },
    orderBy: [{ day: "asc" }, { startTime: "asc" }, { number: "asc" }],
    select: { number: true, slug: true, titleFr: true, startTime: true, endTime: true },
  });
  // Heure de Dakar = UTC, toute l'année : l'heure stockée se lit telle quelle.
  const heure = (date: Date) => date.toISOString().slice(11, 16);

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    classeur,
    XLSX.utils.json_to_sheet([
      Object.fromEntries(COLONNES_MODELE.map((colonne) => [colonne.entete, colonne.exemple])),
    ]),
    "Intervenants",
  );
  XLSX.utils.book_append_sheet(
    classeur,
    XLSX.utils.json_to_sheet(
      seances.length > 0
        ? seances.map((seance) => ({
            numero: seance.number ?? "",
            titre: seance.titleFr,
            jour: seance.startTime.toISOString().slice(0, 10),
            horaire: `${heure(seance.startTime)}–${heure(seance.endTime)}`,
            // Départage deux séances de même titre (les pauses, par exemple).
            adresse: seance.slug,
          }))
        : [{ numero: "", titre: "Aucune séance au programme pour l'instant" }],
    ),
    "Séances",
  );
  XLSX.utils.book_append_sheet(
    classeur,
    XLSX.utils.json_to_sheet(
      Object.entries(ROLES_SESSION).map(([code, libelle]) => ({ role: libelle, code })),
    ),
    "Rôles",
  );
  XLSX.utils.book_append_sheet(
    classeur,
    XLSX.utils.json_to_sheet(
      COLONNES_MODELE.map((colonne) => ({ colonne: colonne.entete, explication: colonne.aide })),
    ),
    "Aide",
  );
  return XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
