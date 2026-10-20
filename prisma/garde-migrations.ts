import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde des migrations : une mise à jour ne supprime ni ne réécrit les données
 * de production (demande du 19 octobre 2026).
 *
 * Une migration s'applique à la base en service par `prisma migrate deploy`,
 * sans que personne la relise au moment où elle tourne. Ce module la relit
 * avant, et refuse :
 *
 * - toute instruction qui supprime des lignes, des colonnes ou des tables
 *   (`DELETE`, `TRUNCATE`, `DROP TABLE`, `ALTER TABLE … DROP COLUMN`) ;
 * - toute instruction qui remplace des lignes existantes (`REPLACE`,
 *   `INSERT … ON DUPLICATE KEY UPDATE`) ;
 * - tout `UPDATE` qui ne se limite pas, pour **chaque** colonne qu'il écrit,
 *   aux lignes où elle est encore vide (`IS NULL`) ou encore égale à son texte
 *   d'origine (`= '…'`). C'est la règle que suivaient déjà les migrations des
 *   modèles d'e-mails : une retouche faite en BackOffice ne correspond plus à
 *   la condition, et n'est donc jamais écrasée.
 *
 * Ajouter une table, une colonne, un index ou des lignes de référence reste
 * libre : rien de ce qui existe n'en est affecté.
 *
 * ## Où la garde s'exerce
 *
 * Deux fois : par `garde-migrations.test.ts` (au commit, en CI), et par
 * `pnpm migrations:verifier`, que `scripts/deployer.sh` lance sur le serveur
 * **avant** `prisma migrate deploy`. La seconde tient même si les tests n'ont
 * pas tourné.
 *
 * ## Exception assumée
 *
 * Une instruction précédée du commentaire `-- garde-donnees: <justification>`
 * passe — retirer une colonne devenue inutile, par exemple. La justification
 * est obligatoire (dix caractères au moins) : c'est elle qu'on relit le jour où
 * il faut comprendre où est passée une donnée.
 */

/**
 * Migrations relues à partir de cette date. Les précédentes ont déjà tourné sur
 * la base de production et ne seront plus jamais rejouées : les relire ne
 * protégerait rien.
 */
export const GARDE_DEPUIS = "20261019";

export interface Instruction {
  /** Texte de l'instruction, commentaires retirés. */
  texte: string;
  /** Même texte, chaînes vidées (`'…'` devient `''`) : les mots-clés ne s'y cachent plus. */
  squelette: string;
  /** Commentaires rencontrés depuis l'instruction précédente. */
  commentaires: string[];
}

export interface Infraction {
  instruction: string;
  motif: string;
}

/**
 * Découpe un fichier SQL en instructions, sur les `;` qui ne sont ni dans une
 * chaîne ni dans un commentaire. Un découpage naïf sur `;` coupait les modèles
 * d'e-mails en plein texte.
 */
export function decouperInstructions(sql: string): Instruction[] {
  const instructions: Instruction[] = [];
  let texte = "";
  let squelette = "";
  let commentaires: string[] = [];

  const clore = () => {
    if (texte.trim()) {
      instructions.push({ texte: texte.trim(), squelette: squelette.trim(), commentaires });
    }
    texte = "";
    squelette = "";
    commentaires = [];
  };

  let i = 0;
  while (i < sql.length) {
    const c = sql[i]!;

    if ((c === "-" && sql[i + 1] === "-") || c === "#") {
      const fin = sql.indexOf("\n", i);
      const arret = fin === -1 ? sql.length : fin;
      commentaires.push(sql.slice(i + (c === "#" ? 1 : 2), arret).trim());
      i = arret;
      continue;
    }

    if (c === "/" && sql[i + 1] === "*") {
      const fin = sql.indexOf("*/", i + 2);
      const arret = fin === -1 ? sql.length : fin;
      commentaires.push(sql.slice(i + 2, arret).trim());
      i = fin === -1 ? sql.length : fin + 2;
      continue;
    }

    if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "\\" && c !== "`") {
          j += 2;
          continue;
        }
        if (sql[j] === c) {
          if (sql[j + 1] === c) {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      const litteral = sql.slice(i, j + 1);
      texte += litteral;
      // Les identifiants restent lisibles ; le contenu des chaînes disparaît.
      squelette += c === "`" ? litteral : c + c;
      i = j + 1;
      continue;
    }

    if (c === ";") {
      clore();
      i += 1;
      continue;
    }

    texte += c;
    squelette += c;
    i += 1;
  }
  clore();
  return instructions;
}

/** Rang d'un mot-clé hors parenthèses, ou -1. */
function motCleHorsParentheses(texte: string, motCle: string): number {
  const recherche = new RegExp(`\\b${motCle}\\b`, "gi");
  let correspondance: RegExpExecArray | null;
  while ((correspondance = recherche.exec(texte))) {
    let profondeur = 0;
    for (const caractere of texte.slice(0, correspondance.index)) {
      if (caractere === "(") profondeur += 1;
      else if (caractere === ")") profondeur -= 1;
    }
    if (profondeur === 0) return correspondance.index;
  }
  return -1;
}

function decouperHorsParentheses(texte: string): string[] {
  const morceaux: string[] = [];
  let profondeur = 0;
  let courant = "";
  for (const caractere of texte) {
    if (caractere === "(") profondeur += 1;
    else if (caractere === ")") profondeur -= 1;
    if (caractere === "," && profondeur === 0) {
      morceaux.push(courant);
      courant = "";
    } else {
      courant += caractere;
    }
  }
  morceaux.push(courant);
  return morceaux;
}

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Motif de refus d'un `UPDATE`, ou `undefined` s'il ne touche qu'à des valeurs vides ou d'origine. */
function analyserMiseAJour(squelette: string): string | undefined {
  const rangSet = motCleHorsParentheses(squelette, "SET");
  if (rangSet === -1) return "réécriture que la garde ne sait pas lire";
  const apresSet = squelette.slice(rangSet + 3);
  const rangWhere = motCleHorsParentheses(apresSet, "WHERE");
  if (rangWhere === -1) return "réécrit toutes les lignes de la table, sans condition";

  const affectations = apresSet.slice(0, rangWhere);
  const condition = apresSet.slice(rangWhere + 5);

  const nonGardees: string[] = [];
  for (const affectation of decouperHorsParentheses(affectations)) {
    const colonne = /^\s*(?:`?\w+`?\.)?`?(\w+)`?\s*=/.exec(affectation)?.[1];
    if (!colonne) return "réécriture que la garde ne sait pas lire";
    const nom = `(?<![\\w])\`?${echapper(colonne)}\`?(?![\\w])`;
    const gardee =
      new RegExp(`${nom}\\s+IS\\s+NULL\\b`, "i").test(condition) ||
      new RegExp(`${nom}\\s*=\\s*'`, "i").test(condition);
    if (!gardee) nonGardees.push(colonne);
  }

  if (nonGardees.length === 0) return undefined;
  return (
    `réécrit ${nonGardees.map((colonne) => `\`${colonne}\``).join(", ")} sans se limiter ` +
    "aux valeurs encore vides (IS NULL) ou encore d'origine (= '…')"
  );
}

function motifDeRefus(squelette: string): string | undefined {
  const s = squelette.replace(/\s+/g, " ").trim();
  if (/^DELETE\b/i.test(s)) return "supprime des lignes";
  if (/^TRUNCATE\b/i.test(s)) return "vide une table";
  if (/^DROP\s+(TABLE|DATABASE|SCHEMA)\b/i.test(s)) return "supprime une table et son contenu";
  if (/^ALTER\s+TABLE\b/i.test(s) && /\bDROP\s+(COLUMN\b|`)/i.test(s)) {
    return "supprime une colonne et ses valeurs";
  }
  if (/^REPLACE\b/i.test(s)) return "remplace des lignes existantes";
  if (/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i.test(s)) return "réécrit des lignes existantes";
  if (/^UPDATE\b/i.test(s)) return analyserMiseAJour(s);
  return undefined;
}

const EXCEPTION = /^garde-donnees\s*:\s*(.+)$/i;

function exceptionJustifiee(commentaires: string[]): boolean {
  return commentaires.some((commentaire) => {
    const justification = EXCEPTION.exec(commentaire)?.[1]?.trim() ?? "";
    return justification.length >= 10;
  });
}

/** Infractions d'un fichier de migration : vide si rien de ce qui existe n'est touché. */
export function analyserMigration(sql: string): Infraction[] {
  const infractions: Infraction[] = [];
  for (const instruction of decouperInstructions(sql)) {
    const motif = motifDeRefus(instruction.squelette);
    if (!motif || exceptionJustifiee(instruction.commentaires)) continue;
    const apercu = instruction.texte.replace(/\s+/g, " ");
    infractions.push({
      instruction: apercu.length > 160 ? `${apercu.slice(0, 157)}…` : apercu,
      motif,
    });
  }
  return infractions;
}

/** Migrations du dossier, à partir de `depuis`, qui touchent à des données existantes. */
export function verifierMigrations(
  dossier: string,
  depuis: string = GARDE_DEPUIS,
): { migration: string; infractions: Infraction[] }[] {
  return readdirSync(dossier)
    .filter((nom) => /^\d{14}_/.test(nom) && nom >= depuis)
    .sort()
    .map((migration) => ({
      migration,
      infractions: analyserMigration(
        readFileSync(join(dossier, migration, "migration.sql"), "utf-8"),
      ),
    }))
    .filter((rapport) => rapport.infractions.length > 0);
}
