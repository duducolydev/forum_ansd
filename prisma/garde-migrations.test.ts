import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyserMigration, decouperInstructions, verifierMigrations } from "./garde-migrations";

const DOSSIER = join(__dirname, "migrations");

function motifs(sql: string): string[] {
  return analyserMigration(sql).map((infraction) => infraction.motif);
}

describe("migrations : rien de ce qui existe n'est supprimé ni réécrit", () => {
  it("toutes les migrations soumises à la garde la respectent", () => {
    expect(verifierMigrations(DOSSIER)).toEqual([]);
  });
});

describe("garde des migrations : découpage", () => {
  it("ne coupe pas sur un « ; » contenu dans un texte", () => {
    const instructions = decouperInstructions(
      "UPDATE `T` SET `a` = 'Bonjour ; au revoir' WHERE `a` IS NULL;\nSELECT 1;",
    );
    expect(instructions).toHaveLength(2);
    expect(instructions[0]!.squelette).toBe("UPDATE `T` SET `a` = '' WHERE `a` IS NULL");
  });

  it("gère les apostrophes doublées et échappées", () => {
    const instructions = decouperInstructions(
      "INSERT INTO `T` VALUES ('l''ANSD ; Dakar', 'd\\'accord ;');\nSELECT 2;",
    );
    expect(instructions).toHaveLength(2);
  });

  it("rattache les commentaires à l'instruction qui les suit", () => {
    const [premiere, seconde] = decouperInstructions("-- un\nSELECT 1;\n/* deux */\nSELECT 2;");
    expect(premiere!.commentaires).toEqual(["un"]);
    expect(seconde!.commentaires).toEqual(["deux"]);
  });
});

describe("garde des migrations : ce qui est refusé", () => {
  it("les suppressions de lignes, de tables et de colonnes", () => {
    expect(motifs("DELETE FROM `Participant` WHERE `email` LIKE 'demo.%';")).toEqual([
      "supprime des lignes",
    ]);
    expect(motifs("TRUNCATE TABLE `Invitation`;")).toEqual(["vide une table"]);
    expect(motifs("DROP TABLE `Post`;")).toEqual(["supprime une table et son contenu"]);
    expect(motifs("ALTER TABLE `User` DROP COLUMN `totpSecret`;")).toEqual([
      "supprime une colonne et ses valeurs",
    ]);
    expect(motifs("ALTER TABLE `User` ADD COLUMN `x` INT, DROP `totpEnabled`;")).toEqual([
      "supprime une colonne et ses valeurs",
    ]);
  });

  it("les remplacements de lignes existantes", () => {
    expect(motifs("REPLACE INTO `Setting` (`key`, `value`) VALUES ('a', '{}');")).toHaveLength(1);
    expect(
      motifs(
        "INSERT INTO `Setting` (`id`, `key`, `value`) VALUES ('1', 'a', '{}') ON DUPLICATE KEY UPDATE `value` = '{}';",
      ),
    ).toEqual(["réécrit des lignes existantes"]);
  });

  it("une réécriture sans condition, ou sur une condition qui n'est pas une garde", () => {
    expect(motifs("UPDATE `Participant` SET `status` = 'CONFIRMED';")).toEqual([
      "réécrit toutes les lignes de la table, sans condition",
    ]);
    // Constaté dans une migration de septembre : toutes les catégories presse
    // repassaient en accréditation, réglage du BackOffice compris.
    expect(
      motifs(
        "UPDATE `ParticipantCategory` SET `requiresAccreditation` = true WHERE `code` = 'MEDIA';",
      ),
    ).toEqual([
      "réécrit `requiresAccreditation` sans se limiter aux valeurs encore vides (IS NULL) ou encore d'origine (= '…')",
    ]);
  });

  it("une réécriture dont une seule des colonnes est gardée", () => {
    const [motif] = motifs(
      "UPDATE `Post` SET `titleFr` = 'A', `bodyFr` = 'B' WHERE `titleFr` IS NULL;",
    );
    expect(motif).toContain("`bodyFr`");
    expect(motif).not.toContain("`titleFr`");
  });

  it("une justification trop courte ne vaut pas exception", () => {
    expect(motifs("-- garde-donnees: ok\nDELETE FROM `Job`;")).toEqual(["supprime des lignes"]);
  });
});

describe("garde des migrations : ce qui passe", () => {
  it("créer des tables, des colonnes, des index, des lignes de référence", () => {
    expect(
      motifs(`
        CREATE TABLE \`Badge2\` (\`id\` VARCHAR(191) NOT NULL, PRIMARY KEY (\`id\`));
        ALTER TABLE \`Participant\` ADD COLUMN \`badgeAckAt\` DATETIME(3) NULL;
        ALTER TABLE \`Participant\` DROP INDEX \`Participant_x_idx\`;
        ALTER TABLE \`Badge\` DROP FOREIGN KEY \`Badge_participantId_fkey\`;
        ALTER TABLE \`Sponsor\` MODIFY \`color\` VARCHAR(20) NULL;
        INSERT INTO \`NotificationTemplate\` (\`id\`, \`key\`) VALUES ('t1', 'nouveau');
      `),
    ).toEqual([]);
  });

  it("remplir un champ encore vide, ou remplacer un texte encore d'origine", () => {
    expect(
      motifs(`
        UPDATE \`ParticipantCategory\` SET \`labelPt\` = 'Média' WHERE \`code\` = 'MEDIA' AND \`labelPt\` IS NULL;
        UPDATE \`NotificationTemplate\` SET \`bodyFr\` = 'Nouveau ; texte'
          WHERE \`key\` = 'invitation' AND \`bodyFr\` = 'Ancien texte';
      `),
    ).toEqual([]);
  });

  it("un mot-clé dangereux à l'intérieur d'un texte n'alerte pas", () => {
    expect(
      motifs(
        "INSERT INTO `Post` (`id`, `bodyFr`) VALUES ('p', 'DELETE FROM tout ; DROP TABLE x');",
      ),
    ).toEqual([]);
  });

  it("une exception justifiée par écrit", () => {
    expect(
      motifs(
        "-- garde-donnees: colonne remplacée par le second facteur par e-mail, plus lue depuis septembre\nALTER TABLE `User` DROP COLUMN `totpSecret`;",
      ),
    ).toEqual([]);
  });

  it("les migrations de modèles d'e-mails écrites jusqu'ici, gardées texte par texte", () => {
    const sql = readFileSync(
      join(DOSSIER, "20261012100000_modeles_courriels_communication", "migration.sql"),
      "utf-8",
    );
    expect(analyserMigration(sql)).toEqual([]);
  });
});
