/**
 * Enregistrement des workers au démarrage du serveur (§34.1).
 *
 * ## Le défaut que cela ferme
 *
 * Les trois workers — notifications, badges, invitations — s'enregistraient
 * **paresseusement**, au premier `enqueue` du processus. Tant que l'application
 * n'avait rien mis en file elle-même, aucun worker n'écoutait, et les jobs déjà
 * présents dans Redis restaient en attente.
 *
 * En marche normale, cela ne se voyait pas : une inscription ou un badge
 * survient vite après un démarrage, et la file se vidait alors d'un coup. Le
 * défaut se manifeste exactement quand il coûte le plus cher — un redémarrage
 * juste après un envoi groupé. Une newsletter expédiée à cinq cents personnes
 * puis un déploiement dans la minute, et les messages attendent qu'un visiteur
 * s'inscrive pour partir. Une nuit, un week-end.
 *
 * Constaté le 24 septembre 2026 : seize jobs en attente, zéro message envoyé,
 * sur une file pourtant alimentée.
 *
 * ## Pourquoi ici, et pourquoi dans un bloc `if`
 *
 * `instrumentation.ts` est le seul point que Next exécute **une fois par
 * processus serveur**, avant de servir la première requête. Un import en tête
 * d'un module de route ne s'exécuterait qu'à la première visite de cette
 * route-là.
 *
 * Next compile ce fichier pour les **deux** runtimes, Node et Edge — le
 * middleware vit sur Edge. L'import doit donc être dynamique **et** enfermé
 * dans un `if` : `process.env.NEXT_RUNTIME` est remplacé par sa valeur à la
 * construction, la condition devient fausse côté Edge, et le bloc disparaît
 * avec tout ce qu'il tire. Un `if (…) return;` en début de fonction ne suffit
 * pas : le bundler trace alors quand même l'import qui suit, et la
 * construction échoue sur `crypto`, `stream` et `net`, absents d'Edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enregistrerWorkers } = await import("./instrumentation-node");
    enregistrerWorkers();
  }
}
