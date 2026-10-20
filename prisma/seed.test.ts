import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decouperInstructions } from "./garde-migrations";

/**
 * Garde-fous contre l'écrasement des données saisies en BackOffice (demande
 * du 1er octobre 2026 : traductions portugaises des contenus et des sections).
 *
 * Ces tests lisent le **code** du seed et des migrations : une réécriture
 * reintroduite par mégarde échoue ici, avant d'atteindre une base en service.
 */
const seed = readFileSync(join(__dirname, "seed.ts"), "utf-8");

describe("seed : création seulement", () => {
  it("n'a que des upserts à `update: {}`", () => {
    const reecritures = [...seed.matchAll(/update:(?!\s*\{\s*\})[^,\n]*/g)].map((m) => m[0]);
    expect(reecritures).toEqual([]);
  });

  it("ne supprime rien, sauf les tarifs d'un hôtel qu'il vient de créer", () => {
    const suppressions = [...seed.matchAll(/prisma\.(\w+)\.(delete|deleteMany)\(/g)].map(
      (m) => `${m[1]}.${m[2]}`,
    );
    expect(suppressions).toEqual(["hotelRate.deleteMany"]);
  });

  it("ne modifie une ligne existante que pour remplir un champ vide", () => {
    // `update` isolé : seul le rattachement d'une invitation de démonstration,
    // posé uniquement quand le participant n'en a pas.
    const updates = [...seed.matchAll(/prisma\.(\w+)\.update\(/g)].map((m) => m[1]);
    expect(updates).toEqual(["participant"]);

    // `updateMany` : chacun doit filtrer sur un champ encore vide (`: null`).
    const blocs = [...seed.matchAll(/prisma\.\w+\.updateMany\(\{\s*where: \{([^}]*)\}/g)];
    expect(blocs.length).toBeGreaterThan(0);
    for (const [, where] of blocs) expect(where).toMatch(/:\s*null/);
  });
});

describe("seed : base vide seulement, démonstration à part (19 octobre 2026)", () => {
  const main = seed.slice(
    seed.indexOf("async function main()"),
    seed.indexOf("async function seedReference()"),
  );
  const reference = seed.slice(
    seed.indexOf("async function seedReference()"),
    seed.indexOf("type Reference ="),
  );

  it("décide avant toute écriture, et s'arrête sans rien écrire si la base est initialisée", () => {
    expect(main).toContain("decisionSeed(");
    expect(main.slice(0, main.indexOf("decisionSeed("))).not.toMatch(
      /\.(create|upsert|update|delete)\w*\(/,
    );
    expect(main).toMatch(/decision\.action === "rien"\) \{[^}]*return;/);
    expect(main.indexOf('decision.action === "rien"')).toBeLessThan(
      main.indexOf("seedReference()"),
    );
  });

  it("n'écrit les données de démonstration que dans seedDemo, et seulement sur décision", () => {
    expect(reference.length).toBeGreaterThan(0);
    expect(reference).not.toMatch(/DEMO|demo\.|example\.test/);
    expect(main).toMatch(/if \(decision\.demo\) \{\s*await seedDemo\(/);
  });
});

describe("migrations de données", () => {
  const dossier = join(__dirname, "migrations");
  // Migrations écrites à partir de l'ajout du portugais : les plus anciennes ont
  // déjà tourné partout et ne seront plus rejouées.
  //
  // Découpées par `decouperInstructions`, chaînes vidées : un découpage naïf sur
  // « ; » coupait les modèles d'e-mails en plein texte, et le test échouait
  // depuis la migration du 12 octobre alors qu'aucune garde n'y manquait.
  const recentes = readdirSync(dossier)
    .filter((nom) => /^\d{14}_/.test(nom) && nom >= "20260930")
    .map((nom) => ({
      nom,
      ordres: decouperInstructions(readFileSync(join(dossier, nom, "migration.sql"), "utf-8")).map(
        (instruction) => instruction.squelette,
      ),
    }));

  it("ne réécrivent un champ portugais que s'il est vide ou encore d'origine", () => {
    for (const { nom, ordres } of recentes) {
      for (const ordre of ordres.filter((o) => /^UPDATE\b/i.test(o))) {
        const [ecriture, condition = ""] = ordre.split(/\bWHERE\s+(?=`)/);
        const champsPt = [...ecriture.matchAll(/`(\w+Pt)`\s*=/g)].map((m) => m[1]);
        for (const champ of champsPt) {
          // Vide, ou égal au texte d'origine : une retouche faite dans le
          // BackOffice ne correspond plus et n'est donc jamais écrasée.
          expect(condition, `${nom} : ${champ} écrit sans garde`).toMatch(
            new RegExp(`\`${champ}\`\\s+(IS NULL|= ')`),
          );
        }
      }
    }
  });

  it("ne réécrivent un modèle d'e-mail que s'il est encore d'origine", () => {
    for (const { nom, ordres } of recentes) {
      for (const ordre of ordres.filter((o) => /^UPDATE\s+`NotificationTemplate`/i.test(o))) {
        const [ecriture, condition = ""] = ordre.split(/\bWHERE\s+(?=`)/);
        for (const [, champ] of ecriture.matchAll(/`((?:body|subject)(?:Fr|En|Pt))`\s*=/g)) {
          expect(condition, `${nom} : ${champ} écrasé sans garde`).toMatch(
            new RegExp(`\`${champ}\`\\s+(IS NULL|= ')`),
          );
        }
      }
    }
  });
});
