import { chromium, devices } from "@playwright/test";

// Contrôles d'interaction : toucher, clavier, mouvement réduit, curseur.
const BASE = process.argv[2] ?? "http://localhost:3000";
const SORTIE = process.argv[3];
const b = await chromium.launch();
const resultats = {};

async function transformInterieur(page, index) {
  return page.evaluate(
    (i) => getComputedStyle(document.querySelectorAll(".retournable__interieur")[i]).transform,
    index,
  );
}

// 1. Tactile : la carte se retourne au toucher, pas de curseur ni de halo.
{
  const ctx = await b.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(BASE + "/intervenants", { waitUntil: "load", timeout: 180000 });
  await p.waitForTimeout(1500);
  const carte = p.locator(".retournable").first();
  await carte.scrollIntoViewIfNeeded();
  await p.waitForTimeout(1200);
  const avant = await transformInterieur(p, 0);
  await carte.tap();
  await p.waitForTimeout(1200);
  const apres = await transformInterieur(p, 0);
  resultats.toucher = { avant, apres, retournee: avant !== apres };
  resultats.tactileSansCurseur = await p.evaluate(
    () => !document.querySelector(".curseur-actif") && !document.querySelector(".halo-souris"),
  );
  // Pied de page : pas collé quand il est plus haut que l'écran.
  resultats.piedMobile = await p.evaluate(() => {
    const pied = document.querySelector(".pied-revele");
    return { hauteur: pied?.offsetHeight, fenetre: innerHeight, colle: pied?.hasAttribute("data-revele-footer") };
  });
  await ctx.close();
}

// 2. Clavier : le lien du verso reçoit le focus et la carte se retourne.
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 180000 });
  await p.waitForTimeout(1500);
  const lien = p.locator(".retournable .verso__lien").first();
  await lien.focus();
  await p.waitForTimeout(1200);
  resultats.clavier = {
    focus: await p.evaluate(() => document.activeElement?.classList.contains("verso__lien")),
    transform: await transformInterieur(p, 0),
  };
  // Pied de page collé sous le rideau sur grand écran.
  resultats.piedBureau = await p.evaluate(() =>
    document.querySelector(".pied-revele")?.hasAttribute("data-revele-footer"),
  );
  // Curseur : visible une fois la souris bougée sur l'accueil…
  await p.mouse.move(400, 400);
  await p.mouse.move(420, 410);
  await p.waitForTimeout(300);
  resultats.curseurAccueil = await p.evaluate(() => Boolean(document.querySelector(".curseur-actif")));
  // … absent sur l'inscription.
  await p.goto(BASE + "/inscription", { waitUntil: "load", timeout: 180000 });
  await p.waitForTimeout(1200);
  await p.mouse.move(400, 400);
  await p.mouse.move(420, 410);
  await p.waitForTimeout(300);
  resultats.curseurInscription = await p.evaluate(() => Boolean(document.querySelector(".curseur-actif")));
  await ctx.close();
}

// 3. Mouvement réduit : tout est visible, aucune animation en cours.
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 180000 });
  await p.waitForTimeout(2000);
  resultats.mouvementReduit = await p.evaluate(() => {
    const masques = [...document.querySelectorAll("[data-reveal], .retournable, .titre-decoupe__lettre")].filter(
      (el) => Number(getComputedStyle(el).opacity) < 0.99,
    ).length;
    const animations = document.getAnimations().filter((a) => a.playState === "running").length;
    const motion = document.documentElement.hasAttribute("data-motion");
    return { masques, animations, motion };
  });
  if (SORTIE) {
    await p.screenshot({ path: SORTIE, fullPage: true });
  }
  await ctx.close();
}

await b.close();
console.log(JSON.stringify(resultats, null, 1));
