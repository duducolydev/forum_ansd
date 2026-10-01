import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("migrations de données", () => {
  const dossier = join(__dirname, "migrations");
  // Migrations écrites à partir de l'ajout du portugais : les plus anciennes ont
  // déjà tourné partout et ne seront plus rejouées.
  const recentes = readdirSync(dossier)
    .filter((nom) => /^\d{14}_/.test(nom) && nom >= "20260930")
    .map((nom) => ({ nom, sql: readFileSync(join(dossier, nom, "migration.sql"), "utf-8") }));

  it("ne remplissent que des champs portugais encore vides", () => {
    for (const { nom, sql } of recentes) {
      for (const ordre of sql.split(";").filter((o) => /^\s*(--.*\n\s*)*UPDATE/i.test(o))) {
        const champsPt = [...ordre.matchAll(/`(\w+Pt)`\s*=/g)].map((m) => m[1]);
        for (const champ of champsPt) {
          expect(ordre, `${nom} : ${champ} écrit sans garde`).toMatch(
            new RegExp(`\`${champ}\`\\s+IS NULL`),
          );
        }
      }
    }
  });
});
