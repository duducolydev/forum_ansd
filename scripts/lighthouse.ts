import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Audit Lighthouse des pages publiques (brief §3.2 : ≥ 90 en performance,
 * accessibilité et SEO sur mobile).
 *
 *   pnpm audit:lighthouse                    → la page d'accueil
 *   pnpm audit:lighthouse a-propos verifier  → ces pages
 *
 * Les chemins s'écrivent **sans barre oblique initiale** : sous Git Bash, un
 * argument commençant par « / » est réécrit en chemin Windows avant d'atteindre
 * le script.
 *
 * Deux précautions, apprises en mesurant :
 *
 * — Chaque page est **préchauffée** avant la mesure. Le premier appel après un
 *   démarrage de conteneur compile la route et interroge la base à froid : il
 *   donnait 860 ms de réponse serveur et 18 points de performance en moins,
 *   ce qui ne décrit aucune situation réelle pour un visiteur.
 *
 * — Chaque page est mesurée **trois fois** et c'est la **médiane** qui est
 *   retenue. Lighthouse mesure aussi la charge de la machine : sur un poste
 *   occupé, une exécution isolée varie de plusieurs points.
 */
const SEUIL = 90;
const EXECUTIONS = 3;
/** Repos entre deux pages, le temps que la machine retombe (cf. boucle principale). */
const REPOS_MS = 5_000;

const CHROME = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((chemin) => chemin && existsSync(chemin));

const BASE = process.env.LH_BASE_URL ?? "http://localhost:3010";
const PAGES = (process.argv.slice(2).length > 0 ? process.argv.slice(2) : [""]).map((chemin) =>
  chemin.startsWith("/") ? chemin : `/${chemin}`,
);

const CATEGORIES = [
  ["performance", "Performance"],
  ["accessibility", "Accessibilité"],
  ["seo", "SEO"],
  ["best-practices", "Bonnes pratiques"],
] as const;

function mediane(valeurs: number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.floor(tri.length / 2)]!;
}

async function prechauffer(url: string): Promise<void> {
  // Quelques essais : entre deux audits, le serveur peut refuser brièvement une
  // connexion pendant que Chromium libère les siennes. Un échec de préchauffage
  // n'est pas un échec d'audit.
  for (let appel = 0; appel < 2; appel++) {
    for (let essai = 0; essai < 5; essai++) {
      try {
        await fetch(url).then((r) => r.text());
        break;
      } catch {
        if (essai === 4) throw new Error(`Page injoignable après cinq essais : ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

/*
 * Lighthouse est invoqué par son entrée Node, pas via `pnpm exec` : sous Git
 * Bash, l'appel passait par un chemin réécrit et le binaire devenait
 * introuvable. Résoudre le module donne le même résultat sur tout système.
 */
const require_ = createRequire(import.meta.url);
const CLI_LIGHTHOUSE = join(
  dirname(require_.resolve("lighthouse/package.json")),
  "cli",
  "index.js",
);

function auditer(url: string, dossier: string, index: number) {
  const sortie = join(dossier, `lh-${index}.json`);
  try {
    execFileSync(
      process.execPath,
      [
        CLI_LIGHTHOUSE,
        url,
        "--quiet",
        "--chrome-flags=--headless=new --no-sandbox",
        "--output=json",
        `--output-path=${sortie}`,
      ],
      { stdio: "ignore", env: { ...process.env, ...(CHROME ? { CHROME_PATH: CHROME } : {}) } },
    );
  } catch (erreur) {
    /*
     * Sous Windows, Lighthouse écrit son rapport **puis** efface le profil
     * Chrome temporaire qu'il s'est créé. Cette suppression échoue par
     * intermittence en `EBUSY` : le processus Chrome n'a pas encore rendu ses
     * fichiers, et le script mourait sur un nettoyage raté alors que la mesure
     * était faite et écrite.
     *
     * On juge donc sur le rapport, pas sur le code de sortie. Si le fichier est
     * absent, l'audit a réellement échoué et l'erreur d'origine repart.
     */
    if (!existsSync(sortie)) throw erreur;
  }

  return JSON.parse(readFileSync(sortie, "utf8")) as {
    categories: Record<string, { score: number | null }>;
  };
}

/**
 * Termine les Chrome *headless* laissés derrière par une mesure.
 *
 * Lighthouse ferme son navigateur, mais des processus enfants survivent : sur
 * une série de onze pages, ils s'accumulent et faussent la mesure suivante,
 * puisque Lighthouse mesure aussi la charge de la machine. L'écart constaté
 * n'était pas anodin — **73 en série contre 91 isolément** sur la même page,
 * même image. Sans ce nettoyage, un audit groupé décrit l'encombrement du poste
 * plutôt que le site.
 *
 * Seuls les processus portant `--headless` sont visés : le navigateur ouvert
 * par la personne qui lance l'audit ne doit pas être fermé sous ses yeux.
 */
function nettoyerChrome(): void {
  if (process.platform !== "win32") return;
  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | " +
          "Where-Object { $_.CommandLine -like '*--headless*' } | " +
          "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ],
      { stdio: "ignore" },
    );
  } catch {
    // Le nettoyage est une précaution, pas une étape : son échec n'invalide rien.
  }
}

async function main(): Promise<void> {
  if (!CHROME) {
    console.error("Chrome introuvable — définir CHROME_PATH.");
    process.exit(1);
  }

  const dossier = mkdtempSync(join(tmpdir(), "lh-"));
  let echecs = 0;

  try {
    for (const page of PAGES) {
      const url = BASE + page;
      /*
       * Repartir d'une machine propre, puis lui laisser le temps de retomber.
       *
       * Tuer les processus ne suffit pas : le système continue quelques
       * secondes à libérer mémoire et fichiers, et la mesure lancée aussitôt
       * enregistre cette activité. Sans la pause, les scores d'une série
       * décroissaient avec le rang de la page — 90 pour la première, 78 pour la
       * huitième, sur des pages de complexité comparable.
       */
      nettoyerChrome();
      await new Promise((resolve) => setTimeout(resolve, REPOS_MS));
      await prechauffer(url);

      const scores: Record<string, number[]> = {};
      for (let i = 0; i < EXECUTIONS; i++) {
        const rapport = auditer(url, dossier, i);
        for (const [cle] of CATEGORIES) {
          (scores[cle] ??= []).push(Math.round((rapport.categories[cle]?.score ?? 0) * 100));
        }
      }

      const resume = CATEGORIES.map(([cle, titre]) => {
        const valeur = mediane(scores[cle]!);
        // Les « bonnes pratiques » ne figurent pas au seuil du brief : affichées
        // pour information, elles ne font pas échouer l'audit.
        const compte = cle !== "best-practices";
        if (compte && valeur < SEUIL) echecs++;
        return `${titre} ${valeur}${compte && valeur < SEUIL ? " ✗" : ""}`;
      }).join(" · ");

      console.log(`${page.padEnd(20)} ${resume}`);
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }

  console.log(
    echecs === 0
      ? `\nToutes les pages atteignent ${SEUIL}.`
      : `\n${echecs} score(s) sous ${SEUIL}.`,
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main();
