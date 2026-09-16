import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

export interface RenderPdfOptions {
  format?: "A4" | "A6" | "CR80";
  landscape?: boolean;
}

export interface RenderPngOptions {
  /** Largeur du rendu en pixels CSS ; la hauteur suit le contenu. */
  width?: number;
  /** Facteur d'échelle — 2 pour une sortie « retina » adaptée à l'impression. */
  deviceScaleFactor?: number;
}

/** Formats physiques. CR80 = format carte bancaire, standard des badges. */
const PAGE_SIZES: Record<
  NonNullable<RenderPdfOptions["format"]>,
  { width: string; height: string }
> = {
  A4: { width: "210mm", height: "297mm" },
  A6: { width: "105mm", height: "148mm" },
  CR80: { width: "53.98mm", height: "85.6mm" },
};

/**
 * Chemin du navigateur. On utilise `puppeteer-core` (sans Chromium embarqué)
 * plutôt que `puppeteer` : l'image Docker est sur Alpine, où le Chromium livré
 * par Puppeteer (lié à la glibc) ne s'exécute pas — c'est le paquet système
 * `chromium` qui sert. Télécharger 300 Mo à l'installation pour ne jamais s'en
 * servir n'aurait aucun intérêt.
 */
const CANDIDATE_PATHS = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function resolveBrowserPath(): string | null {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (configured) return existsSync(configured) ? configured : null;
  return CANDIDATE_PATHS.find((path) => existsSync(path)) ?? null;
}

declare global {
  var __pdfBrowser: Promise<Browser> | undefined;
}

/**
 * Instance de navigateur partagée. Un `launch()` par badge coûterait ~1 s :
 * intenable face à l'objectif « 500 badges en moins de 5 min » (600 ms/badge).
 * On relance si l'instance précédente s'est fermée (crash, OOM).
 */
async function getBrowser(): Promise<Browser> {
  const existing = globalThis.__pdfBrowser;
  if (existing) {
    const browser = await existing.catch(() => null);
    if (browser?.connected) return browser;
  }

  const executablePath = resolveBrowserPath();
  if (!executablePath) {
    throw new Error(
      "Aucun navigateur trouvé pour le rendu PDF/PNG. Définir PUPPETEER_EXECUTABLE_PATH " +
        "(dans l'image Docker : /usr/bin/chromium-browser).",
    );
  }

  const launched = puppeteer.launch({
    executablePath,
    headless: true,
    // --no-sandbox : le conteneur tourne déjà sans privilèges, sous un
    // utilisateur non root, et n'ouvre que du HTML que nous produisons
    // nous-mêmes (jamais de contenu distant).
    //
    // Les trois drapeaux `*-backgrounding-*` / `*-throttling` sont
    // indispensables au pool : Chromium met en veille les onglets qui ne sont
    // pas au premier plan, et une capture d'écran sur un onglet gelé n'obtient
    // jamais sa frame du compositeur — le rendu reste bloqué jusqu'au
    // `protocolTimeout` (180 s). Constaté puis corrigé lors de la mise au point.
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--hide-scrollbars",
    ],
  });
  globalThis.__pdfBrowser = launched;
  return launched;
}

/**
 * Pool d'onglets réutilisés.
 *
 * Deux raisons, mesurées : ouvrir puis fermer une page coûte 150 à 250 ms (sur
 * 500 badges, plus de deux minutes à elle seule), et un rendu séquentiel
 * plafonne à ~780 ms/badge — au-delà du budget de 600 ms fixé par le brief
 * (500 badges en moins de 5 min). Le rendu étant dominé par le CPU de
 * Chromium, plusieurs onglets en parallèle tiennent la cible. Le contenu est
 * intégralement remplacé par `setContent` à chaque rendu : rien ne fuit d'un
 * badge au suivant.
 */
const POOL_SIZE = Math.max(1, Number(process.env.PDF_RENDER_CONCURRENCY ?? 4));

interface Slot {
  page: import("puppeteer-core").Page | null;
}

let slots: Slot[] | null = null;
let freeSlots: Slot[] = [];
let waiters: ((slot: Slot) => void)[] = [];

function acquireSlot(): Promise<Slot> {
  if (!slots) {
    slots = Array.from({ length: POOL_SIZE }, () => ({ page: null }) as Slot);
    freeSlots = [...slots];
  }
  const free = freeSlots.pop();
  if (free) return Promise.resolve(free);
  return new Promise((resolve) => waiters.push(resolve));
}

function releaseSlot(slot: Slot): void {
  const waiter = waiters.shift();
  if (waiter) waiter(slot);
  else freeSlots.push(slot);
}

const CLOSE_TIMEOUT_MS = 5000;

/**
 * Ferme le navigateur partagé — à appeler en fin de script court-lived (seed,
 * tests) ou à l'arrêt du service.
 *
 * `browser.close()` demande une fermeture propre au protocole ; sous forte
 * charge, cet aller-retour peut ne jamais aboutir et bloquait alors
 * indéfiniment l'appelant (constaté : un `afterAll` de tests figé). On borne
 * donc l'attente et on tue le processus en dernier recours : à ce stade, plus
 * rien n'a besoin du navigateur.
 */
export async function closeBrowser(): Promise<void> {
  const existing = globalThis.__pdfBrowser;
  globalThis.__pdfBrowser = undefined;
  slots = null;
  freeSlots = [];
  waiters = [];
  if (!existing) return;

  const browser = await existing.catch(() => null);
  if (!browser) return;

  const closed = await Promise.race([
    browser
      .close()
      .then(() => true)
      .catch(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), CLOSE_TIMEOUT_MS)),
  ]);

  if (!closed) {
    browser.process()?.kill("SIGKILL");
  }
}

async function withPage<T>(
  html: string,
  fn: (page: import("puppeteer-core").Page) => Promise<T>,
): Promise<T> {
  const browser = await getBrowser();
  const slot = await acquireSlot();
  try {
    if (!slot.page || slot.page.isClosed()) {
      slot.page = await browser.newPage();
    }
    // `domcontentloaded` suffit : le HTML est autonome (CSS en ligne, images en
    // data: URI) — attendre le réseau ferait patienter jusqu'au timeout.
    await slot.page.setContent(html, { waitUntil: "domcontentloaded" });
    await slot.page.evaluateHandle("document.fonts.ready");
    return await fn(slot.page);
  } catch (error) {
    // Onglet laissé dans un état incertain : on le jette pour que le rendu
    // suivant reparte d'une page saine plutôt que d'hériter du problème.
    await slot.page?.close().catch(() => undefined);
    slot.page = null;
    throw error;
  } finally {
    releaseSlot(slot);
  }
}

async function pdfFromPage(
  page: import("puppeteer-core").Page,
  options: RenderPdfOptions,
): Promise<Buffer> {
  const size = PAGE_SIZES[options.format ?? "CR80"];
  const pdf = await page.pdf({
    width: options.landscape ? size.height : size.width,
    height: options.landscape ? size.width : size.height,
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    preferCSSPageSize: false,
  });
  return Buffer.from(pdf);
}

/**
 * Verrou de capture. Contrairement au PDF — qui se génère en parallèle sans
 * difficulté (mesuré à ~116 ms/badge sur 4 onglets) —, une capture d'écran a
 * besoin d'une frame du compositeur, que Chromium ne produit que pour l'onglet
 * de premier plan. Deux captures concurrentes se bloquaient indéfiniment
 * jusqu'au `protocolTimeout`. On amène donc la page au premier plan et on
 * sérialise cette seule étape ; le reste du rendu reste parallèle.
 */
let screenshotLock: Promise<unknown> = Promise.resolve();

async function pngFromPage(
  page: import("puppeteer-core").Page,
  options: RenderPngOptions,
): Promise<Buffer> {
  const run = screenshotLock.then(async () => {
    const target = options.width ?? 1200;
    const element = (await page.$("[data-capture]")) ?? (await page.$("body"));
    if (!element) throw new Error("Rendu PNG : aucun élément à capturer.");

    await page.bringToFront();

    // Le gabarit est dimensionné en millimètres (53,98 mm ≈ 204 px CSS) :
    // élargir le viewport ne l'agrandit pas. C'est le facteur d'échelle qui
    // donne la largeur demandée en pixels.
    const box = await element.boundingBox();
    const scale = box && box.width > 0 ? target / box.width : 1;
    await page.setViewport({
      width: Math.ceil(box?.width ?? target),
      height: Math.ceil(box?.height ?? target * 1.5),
      deviceScaleFactor: options.deviceScaleFactor ?? scale,
    });

    const shot = await element.screenshot({ type: "png", omitBackground: false });
    return Buffer.from(shot);
  });
  screenshotLock = run.catch(() => undefined);
  return run;
}

/** Rendu HTML → PDF (Puppeteer, brief §3.1). */
export async function renderHtmlToPdf(
  html: string,
  options: RenderPdfOptions = {},
): Promise<Buffer> {
  return withPage(html, (page) => pdfFromPage(page, options));
}

/** Rendu HTML → PNG (aperçu écran et badge à afficher sur mobile). */
export async function renderHtmlToPng(
  html: string,
  options: RenderPngOptions = {},
): Promise<Buffer> {
  return withPage(html, (page) => pngFromPage(page, options));
}

/**
 * PDF **et** PNG en une seule visite de page. C'est la voie utilisée par la
 * génération de badges : deux appels séparés rechargeraient le même HTML deux
 * fois, ce qui doublait le coût pour rien.
 */
export async function renderHtmlToPdfAndPng(
  html: string,
  pdfOptions: RenderPdfOptions = {},
  pngOptions: RenderPngOptions = {},
): Promise<{ pdf: Buffer; png: Buffer }> {
  return withPage(html, async (page) => {
    const pdf = await pdfFromPage(page, pdfOptions);
    const png = await pngFromPage(page, pngOptions);
    // Le viewport a été redimensionné pour la capture : on le remet à une
    // taille neutre, sinon le rendu suivant hérite du facteur d'échelle.
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
    return { pdf, png };
  });
}
