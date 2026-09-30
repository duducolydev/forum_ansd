import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { participantInputSchema, type ParticipantInput } from "./schema";
import { DuplicateParticipantEmailError } from "./errors";
import { confirmParticipant, createParticipant, envoyerConfirmation, type Actor } from "./service";

/**
 * Import de participants par fichier Excel/CSV (demande du 29 septembre 2026).
 *
 * Pour les personnes qui ont reçu une invitation physique et confirmé leur
 * venue : leur redemander de s'inscrire sur le site serait une démarche de
 * trop. L'administration charge un fichier, vérifie l'aperçu, confirme ;
 * chaque personne est alors inscrite **confirmée**, son badge est généré, et
 * elle reçoit un e-mail qui ouvre directement son espace (compléter ses
 * informations, ajouter sa photo, télécharger son badge).
 *
 * Deux temps, comme l'import d'invitations : `analyserImport` ne fait que
 * lire et vérifier ; `importerParticipants` écrit. La confirmation **revérifie**
 * tout : entre l'aperçu et le clic, quelqu'un a pu s'inscrire en ligne, et
 * les lignes reviennent du navigateur, qui ne fait pas autorité.
 *
 * SÉCURITÉ : `xlsx` vient du registre officiel SheetJS (voir le module des
 * invitations) ; import réservé à `participants.import`, fichier plafonné,
 * lecture côté serveur seulement.
 */

export const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;
export const LIGNES_MAX = 2000;

export interface LigneLue {
  rowNumber: number;
  valeurs: Record<string, string>;
}

export interface ErreurLigne {
  rowNumber: number;
  message: string;
}

export interface LigneValide {
  rowNumber: number;
  input: ParticipantInput;
  categorie: string;
  delegation: string | null;
  presse: boolean;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** « Catégorie de participation » → « categorie_de_participation ». */
export function normaliserCle(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type Champ =
  | "civility"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "jobTitle"
  | "organization"
  | "organizationType"
  | "activityDomain"
  | "country"
  | "city"
  | "categorie"
  | "delegation"
  | "locale"
  | "attendsOpening"
  | "attendsClosing"
  | "attendsAwards"
  | "needsAccommodation"
  | "needsTransport"
  | "dietaryRequirements"
  | "specialNeeds"
  | "notes";

/** En-têtes reconnus, après `normaliserCle`. Le modèle utilise le premier de chaque champ. */
const ALIAS: Record<string, Champ> = {
  civilite: "civility",
  civility: "civility",
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
  telephone: "phone",
  tel: "phone",
  phone: "phone",
  fonction: "jobTitle",
  poste: "jobTitle",
  job_title: "jobTitle",
  organisation: "organization",
  organization: "organization",
  institution: "organization",
  structure: "organization",
  type_organisation: "organizationType",
  type_d_organisation: "organizationType",
  organization_type: "organizationType",
  domaine_activite: "activityDomain",
  domaine_d_activite: "activityDomain",
  domaine: "activityDomain",
  pays: "country",
  country: "country",
  ville: "city",
  city: "city",
  categorie: "categorie",
  category: "categorie",
  categorie_de_participation: "categorie",
  code_categorie: "categorie",
  delegation: "delegation",
  langue: "locale",
  language: "locale",
  locale: "locale",
  ceremonie_ouverture: "attendsOpening",
  ceremonie_d_ouverture: "attendsOpening",
  ouverture: "attendsOpening",
  ceremonie_cloture: "attendsClosing",
  ceremonie_de_cloture: "attendsClosing",
  cloture: "attendsClosing",
  ceremonie_distinction: "attendsAwards",
  ceremonie_de_distinction: "attendsAwards",
  distinction: "attendsAwards",
  hebergement: "needsAccommodation",
  transport: "needsTransport",
  regime_alimentaire: "dietaryRequirements",
  restrictions_alimentaires: "dietaryRequirements",
  besoins_specifiques: "specialNeeds",
  notes: "notes",
  remarques: "notes",
  commentaire: "notes",
};

export function lireFichier(buffer: Buffer): LigneLue[] {
  const classeur = XLSX.read(buffer, { type: "buffer" });
  const feuille = classeur.Sheets[classeur.SheetNames[0]!];
  if (!feuille) return [];
  // `raw: false` : la valeur telle qu'affichée — un numéro de téléphone saisi
  // comme nombre ne revient pas en notation scientifique.
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

const LIBELLES_BOOLEENS: Record<string, string> = {
  attendsOpening: "cérémonie d'ouverture",
  attendsClosing: "cérémonie de clôture",
  attendsAwards: "cérémonie de distinction",
  needsAccommodation: "hébergement",
  needsTransport: "transport",
};

function lireBooleen(valeur: string | undefined, champ: string): boolean {
  const cle = normaliserCle(valeur ?? "");
  if (OUI.has(cle)) return true;
  if (NON.has(cle)) return false;
  throw new Error(
    `Valeur « ${valeur} » non reconnue pour ${LIBELLES_BOOLEENS[champ]} (oui / non).`,
  );
}

function lireLangueImport(valeur: string | undefined): "fr" | "en" | "pt" {
  const cle = normaliserCle(valeur ?? "");
  if (["en", "anglais", "english", "eng", "ingles"].includes(cle)) return "en";
  if (["pt", "portugais", "portuguese", "portugues", "por"].includes(cle)) return "pt";
  if (["", "fr", "francais", "french", "fra", "frances"].includes(cle)) return "fr";
  throw new Error(`Langue « ${valeur} » non reconnue (fr / en / pt).`);
}

interface Referentiels {
  categories: Map<string, { id: string; libelle: string; presse: boolean }>;
  delegations: Map<string, { id: string; nom: string }>;
}

/** Une catégorie se désigne par son code ou son libellé, en français ou en anglais. */
async function chargerReferentiels(editionId: string): Promise<Referentiels> {
  const [categories, delegations] = await Promise.all([
    prisma.participantCategory.findMany({
      where: { editionId, isActive: true },
      select: { id: true, code: true, labelFr: true, labelEn: true, requiresAccreditation: true },
    }),
    prisma.delegation.findMany({ where: { editionId }, select: { id: true, name: true } }),
  ]);

  const parCategorie = new Map<string, { id: string; libelle: string; presse: boolean }>();
  for (const categorie of categories) {
    const entree = {
      id: categorie.id,
      libelle: categorie.labelFr,
      presse: categorie.requiresAccreditation,
    };
    for (const nom of [categorie.code, categorie.labelFr, categorie.labelEn]) {
      if (nom) parCategorie.set(normaliserCle(nom), entree);
    }
  }

  const parDelegation = new Map<string, { id: string; nom: string }>();
  for (const delegation of delegations) {
    parDelegation.set(normaliserCle(delegation.name), { id: delegation.id, nom: delegation.name });
  }
  return { categories: parCategorie, delegations: parDelegation };
}

export interface ResultatAnalyse {
  valides: LigneValide[];
  erreurs: ErreurLigne[];
}

/**
 * Vérifie chaque ligne sans rien écrire : champs obligatoires, catégorie et
 * délégation connues, doublons dans le fichier et avec les inscrits.
 *
 * `peutAccrediter` : une catégorie presse n'est importée que par qui peut
 * accréditer — l'import la confirme, et confirmer un journaliste, c'est
 * l'accréditer.
 */
export async function analyserImport(
  editionId: string,
  lignes: LigneLue[],
  options: { peutAccrediter: boolean },
): Promise<ResultatAnalyse> {
  const referentiels = await chargerReferentiels(editionId);
  const erreurs: ErreurLigne[] = [];
  const valides: LigneValide[] = [];
  const vus = new Set<string>();

  for (const { rowNumber, valeurs } of lignes) {
    try {
      const categorie = referentiels.categories.get(normaliserCle(valeurs.categorie ?? ""));
      if (!valeurs.categorie) throw new Error("Catégorie manquante.");
      if (!categorie) throw new Error(`Catégorie inconnue : « ${valeurs.categorie} ».`);
      if (categorie.presse && !options.peutAccrediter) {
        throw new Error(
          `Catégorie « ${categorie.libelle} » : l'import vaut accréditation presse, réservée à l'administration du Forum.`,
        );
      }

      let delegation: { id: string; nom: string } | null = null;
      if (valeurs.delegation) {
        delegation = referentiels.delegations.get(normaliserCle(valeurs.delegation)) ?? null;
        if (!delegation) {
          throw new Error(
            `Délégation inconnue : « ${valeurs.delegation} ». Créez-la d'abord dans Délégations.`,
          );
        }
      }

      const analyse = participantInputSchema.safeParse({
        civility: valeurs.civility || undefined,
        firstName: valeurs.firstName ?? "",
        lastName: valeurs.lastName ?? "",
        email: valeurs.email ?? "",
        phone: valeurs.phone ?? "",
        jobTitle: valeurs.jobTitle ?? "",
        organization: valeurs.organization ?? "",
        organizationType: valeurs.organizationType ?? "",
        activityDomain: valeurs.activityDomain ?? "",
        country: valeurs.country ?? "",
        city: valeurs.city ?? "",
        categoryId: categorie.id,
        delegationId: delegation?.id ?? "",
        locale: lireLangueImport(valeurs.locale),
        attendsOpening: lireBooleen(valeurs.attendsOpening, "attendsOpening"),
        attendsInaugural: false,
        attendsClosing: lireBooleen(valeurs.attendsClosing, "attendsClosing"),
        attendsAwards: lireBooleen(valeurs.attendsAwards, "attendsAwards"),
        needsAccommodation: lireBooleen(valeurs.needsAccommodation, "needsAccommodation"),
        needsTransport: lireBooleen(valeurs.needsTransport, "needsTransport"),
        dietaryRequirements: valeurs.dietaryRequirements ?? "",
        specialNeeds: valeurs.specialNeeds ?? "",
        notes: valeurs.notes ?? "",
      });
      if (!analyse.success) throw new Error(analyse.error.issues[0]?.message ?? "Ligne invalide.");

      if (vus.has(analyse.data.email)) {
        throw new Error(`E-mail en double dans le fichier : ${analyse.data.email}.`);
      }
      vus.add(analyse.data.email);

      valides.push({
        rowNumber,
        input: analyse.data,
        categorie: categorie.libelle,
        delegation: delegation?.nom ?? null,
        presse: categorie.presse,
      });
    } catch (erreur) {
      erreurs.push({ rowNumber, message: (erreur as Error).message });
    }
  }

  // Déjà inscrits (y compris une fiche supprimée : l'adresse reste réservée).
  if (valides.length > 0) {
    const existants = await prisma.participant.findMany({
      where: { editionId, email: { in: valides.map((ligne) => ligne.input.email) } },
      select: { email: true },
    });
    const dejaInscrits = new Set(existants.map((participant) => participant.email));
    for (const ligne of [...valides]) {
      if (dejaInscrits.has(ligne.input.email)) {
        erreurs.push({
          rowNumber: ligne.rowNumber,
          message: `Déjà inscrit(e) : ${ligne.input.email}.`,
        });
        valides.splice(valides.indexOf(ligne), 1);
      }
    }
  }

  erreurs.sort((a, b) => a.rowNumber - b.rowNumber);
  return { valides, erreurs };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export interface BilanImport {
  inscrits: number;
  echecs: ErreurLigne[];
}

/**
 * Inscrit les lignes vérifiées, une par une : chaque inscription suit le
 * chemin ordinaire (identifiant public, trace d'audit, badge, rapprochement
 * avec une invitation au même e-mail, alerte du référent de délégation).
 * Une ligne qui échoue n'arrête pas les suivantes.
 *
 * E-mail : « inscrit(e) par le comité », avec l'accès direct à l'espace. Pour
 * la presse, l'e-mail d'accréditation, qui porte le même accès.
 */
export async function importerParticipants(
  edition: { id: string; code: string },
  lignes: LigneValide[],
  acteur: Actor,
  options: { peutAccrediter: boolean },
): Promise<BilanImport> {
  let inscrits = 0;
  const echecs: ErreurLigne[] = [];

  for (const ligne of lignes) {
    try {
      const participant = await createParticipant({
        editionId: edition.id,
        editionCode: edition.code,
        input: ligne.input,
        source: "IMPORT",
        actor: acteur,
      });
      if (participant.status === "REGISTERED" && ligne.presse) {
        await confirmParticipant(participant.id, acteur, {
          peutAccrediter: options.peutAccrediter,
        });
      } else {
        await envoyerConfirmation(participant.id, { importe: true });
      }
      inscrits += 1;
    } catch (erreur) {
      echecs.push({
        rowNumber: ligne.rowNumber,
        message:
          erreur instanceof DuplicateParticipantEmailError
            ? `Déjà inscrit(e) : ${ligne.input.email}.`
            : (erreur as Error).message,
      });
    }
  }

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "participant.import",
    entity: "Participant",
    entityId: edition.id,
    after: { inscrits, echecs: echecs.length },
  });

  return { inscrits, echecs };
}

// ---------------------------------------------------------------------------
// Modèle
// ---------------------------------------------------------------------------

/** Colonnes du modèle, dans l'ordre, avec leur explication (feuille « Aide »). */
const COLONNES_MODELE: { entete: string; exemple: string; aide: string }[] = [
  { entete: "civilite", exemple: "M.", aide: "Facultatif : M., Mme, Dr, Pr…" },
  { entete: "prenom", exemple: "Awa", aide: "Obligatoire." },
  { entete: "nom", exemple: "Ndiaye", aide: "Obligatoire." },
  {
    entete: "email",
    exemple: "awa.ndiaye@institution.sn",
    aide: "Obligatoire. L'e-mail d'accès à l'espace y est envoyé.",
  },
  { entete: "telephone", exemple: "+221 77 000 00 00", aide: "Facultatif." },
  { entete: "fonction", exemple: "Directrice des statistiques", aide: "Facultatif." },
  { entete: "organisation", exemple: "Institut national de la statistique", aide: "Facultatif." },
  { entete: "pays", exemple: "Sénégal", aide: "Obligatoire." },
  { entete: "ville", exemple: "Dakar", aide: "Facultatif." },
  {
    entete: "categorie",
    exemple: "PARTICIPANT_INTERNATIONAL",
    aide: "Obligatoire : code ou libellé, voir la feuille « Catégories ».",
  },
  {
    entete: "delegation",
    exemple: "",
    aide: "Facultatif : nom exact d'une délégation déjà créée dans le BackOffice.",
  },
  { entete: "langue", exemple: "fr", aide: "fr, en ou pt — langue des e-mails. fr par défaut." },
  { entete: "ceremonie_ouverture", exemple: "oui", aide: "oui / non (non par défaut)." },
  { entete: "ceremonie_cloture", exemple: "oui", aide: "oui / non (non par défaut)." },
  { entete: "ceremonie_distinction", exemple: "non", aide: "oui / non (non par défaut)." },
  { entete: "hebergement", exemple: "non", aide: "oui / non : besoin d'hébergement." },
  { entete: "transport", exemple: "non", aide: "oui / non : besoin de transport." },
  { entete: "regime_alimentaire", exemple: "", aide: "Facultatif." },
  { entete: "besoins_specifiques", exemple: "", aide: "Facultatif." },
  { entete: "notes", exemple: "Invitation papier remise le 15/09", aide: "Facultatif, interne." },
];

export async function modeleImport(editionId: string): Promise<Buffer> {
  const categories = await prisma.participantCategory.findMany({
    where: { editionId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, labelFr: true, requiresAccreditation: true },
  });

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    classeur,
    XLSX.utils.json_to_sheet([
      Object.fromEntries(COLONNES_MODELE.map((colonne) => [colonne.entete, colonne.exemple])),
    ]),
    "Participants",
  );
  XLSX.utils.book_append_sheet(
    classeur,
    XLSX.utils.json_to_sheet(
      categories.map((categorie) => ({
        code: categorie.code,
        libelle: categorie.labelFr,
        remarque: categorie.requiresAccreditation ? "Presse : l'import vaut accréditation" : "",
      })),
    ),
    "Catégories",
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
