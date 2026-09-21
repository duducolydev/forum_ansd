import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";
import { utiliseLaCamera } from "./lib/pages-camera";

const { auth } = NextAuth(authConfig);

/**
 * En-têtes de sécurité (brief §7) + contrôle d'accès du BackOffice.
 *
 * La CSP est **à nonce** plutôt qu'à `'unsafe-inline'`. Next injecte ses propres
 * scripts en ligne pour l'hydratation : les autoriser par `'unsafe-inline'`
 * autoriserait du même coup n'importe quel script injecté, ce qui vide la CSP de
 * sa protection principale. Un nonce par requête ne laisse passer que les
 * scripts que nous émettons — Next le reprend automatiquement dès qu'il le
 * trouve dans l'en-tête posé sur la requête.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // `'strict-dynamic'` laisse les scripts chargés par un script de confiance
    // s'exécuter sans devoir tous les énumérer ; `https:` et `'unsafe-inline'`
    // sont les replis ignorés par les navigateurs qui comprennent le nonce.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'${
      // En développement, Next évalue du code pour le rafraîchissement à chaud.
      isDev ? " 'unsafe-eval'" : ""
    }`,
    // Les attributs `style` en ligne de React (barres de graphiques, largeurs
    // calculées) ne peuvent pas porter de nonce : `'unsafe-inline'` est ici
    // sans danger, une feuille de style ne permettant pas d'exécuter de code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Aucun appel sortant : tout est servi par l'application elle-même.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Restreint la cible des formulaires : une injection ne peut pas détourner
    // une soumission vers un serveur tiers.
    "form-action 'self'",
    // Remplace X-Frame-Options, qu'on garde par ailleurs pour les vieux clients.
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  csp: string,
  autoriserCamera = false,
): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  /*
   * Aucune de ces API n'est utilisée : on les refuse explicitement plutôt que
   * de s'en remettre au défaut du navigateur.
   *
   * La caméra fait exception sur les pages qui en ont besoin — scanner et
   * comptoir d'accueil (`src/lib/pages-camera.ts`) — et seulement là. La
   * refuser partout ailleurs limite les dégâts d'une injection sur les autres
   * pages, et `Permissions-Policy` ne se déclare pas par page dans un fichier
   * de configuration statique — d'où cet aiguillage ici, au seul endroit qui
   * voit le chemin demandé.
   *
   * **Attention** : la politique vaut pour le document **chargé**. Une
   * navigation interne vers une page caméra garde celle du document de départ ;
   * c'est pourquoi le menu y mène par un rechargement complet (PLAN.md §16).
   */
  response.headers.set(
    "Permissions-Policy",
    [
      autoriserCamera ? "camera=(self)" : "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  );
  // HSTS : posé uniquement derrière HTTPS. L'envoyer en HTTP clair n'aurait
  // aucun effet, et le poser en développement rendrait `localhost` inaccessible
  // en HTTP pendant toute la durée du max-age.
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

/**
 * Politique appliquée aux fichiers **déposés par un tiers** et susceptibles
 * d'être exécutables — aujourd'hui le seul logo de partenaire, qui accepte le
 * SVG (cf. `src/modules/sponsors/logo.ts`).
 *
 * Un SVG chargé par `<img src>` n'exécute rien. Mais cette URL peut aussi être
 * ouverte directement, et le fichier devient alors un document à part entière,
 * soumis à la CSP de la réponse. Or la politique du site autorise
 * `script-src 'self' … 'unsafe-inline'` : indispensable aux pages, désastreux
 * ici.
 *
 * La politique est posée **dans le middleware** et non dans la route : le
 * middleware s'exécute en amont et ses en-têtes l'emportent, si bien qu'une CSP
 * écrite par la route serait remplacée sans bruit. C'est exactement ce qui se
 * produisait, et c'est un test qui l'a montré.
 *
 * Les autres routes de fichiers ne figurent pas ici : photos de participants,
 * images d'article et badges passent par `detectImageType`, qui n'accepte que
 * JPEG, PNG et WebP — aucun de ces formats ne porte de script. Le PDF des
 * badges est laissé à la politique du site, `sandbox` empêchant l'affichage
 * intégré par la visionneuse du navigateur.
 */
const CSP_FICHIER_DEPOSE =
  "default-src 'none'; style-src 'unsafe-inline'; sandbox; base-uri 'none'; form-action 'none'";

/**
 * Routes servant un fichier déposé de type potentiellement exécutable.
 *
 * Le logo d'un partenaire et l'illustration d'une section : les deux acceptent
 * le SVG, donc du XML susceptible de porter du script. Les autres routes de
 * fichiers n'y figurent pas — photos, images d'article et badges passent par
 * `detectImageType`, qui n'accepte que JPEG, PNG et WebP.
 */
const ROUTES_FICHIER_DEPOSE = [
  /^\/api\/v1\/sponsors\/[^/]+\/logo$/,
  /^\/api\/v1\/sections\/[^/]+\/image$/,
  // Les contributions de type PHOTO passent par le même détecteur, qui accepte
  // le SVG : la route hérite donc de la même politique verrouillée.
  /^\/api\/v1\/contributions\/[^/]+\/fichier$/,
];

function sertUnFichierDepose(pathname: string): boolean {
  return ROUTES_FICHIER_DEPOSE.some((motif) => motif.test(pathname));
}

export default auth((request) => {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = sertUnFichierDepose(request.nextUrl.pathname)
    ? CSP_FICHIER_DEPOSE
    : buildCsp(nonce, process.env.NODE_ENV !== "production");

  // Le nonce doit voyager sur la **requête** : c'est là que Next le lit pour en
  // marquer ses propres balises `<script>`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  /*
   * Contrôle d'accès du BackOffice.
   *
   * Il est appliqué **ici** et non par le callback `authorized` d'Auth.js :
   * envelopper `auth()` dans un gestionnaire, ce qu'impose l'ajout des en-têtes,
   * neutralise ce callback. Le laisser en place aurait donné un `/admin` en
   * apparence protégé et en réalité ouvert — la page d'enrôlement 2FA, seule à
   * ne pas revérifier la session, plantait alors en 500 au lieu de rediriger.
   */
  const { pathname } = request.nextUrl;
  const estScanner = pathname === "/scan" || pathname.startsWith("/scan/");
  /*
   * Le scanner vise les badges, le comptoir d'accueil prend une photo par
   * webcam (brief §5.7) : les deux ont besoin de la caméra. La liste est tenue
   * dans `src/lib/pages-camera.ts`, que lit aussi le menu — ajouter un écran ne
   * l'autorise pas par inadvertance, et l'en retirer ne laisse pas un lien
   * orphelin.
   */
  const utiliseCamera = utiliseLaCamera(pathname);

  /*
   * Le scanner exige une session, comme le BackOffice. La permission
   * `scan.use`, elle, est vérifiée par la page : le middleware n'a accès qu'à
   * ce que le jeton porte, et dupliquer la règle ici la ferait dériver.
   */
  if (estScanner && !request.auth?.user) {
    const connexion = new URL("/connexion", request.nextUrl);
    connexion.searchParams.set("callbackUrl", request.nextUrl.href);
    return applySecurityHeaders(NextResponse.redirect(connexion), csp, true);
  }

  if (pathname.startsWith("/admin")) {
    const user = request.auth?.user;

    if (!user) {
      const connexion = new URL("/connexion", request.nextUrl);
      connexion.searchParams.set("callbackUrl", request.nextUrl.href);
      return applySecurityHeaders(NextResponse.redirect(connexion), csp);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applySecurityHeaders(response, csp, utiliseCamera);
}) as unknown as (request: NextRequest) => Promise<Response>;

export const config = {
  /*
   * Toutes les routes sauf les fichiers statiques et les images optimisées :
   * les en-têtes de sécurité doivent couvrir les pages publiques autant que le
   * BackOffice.
   *
   * `api/auth` est exclu : y faire passer le middleware d'Auth.js cassait la
   * vérification du jeton CSRF de son propre point d'entrée (`MissingCSRF`,
   * donc plus aucune connexion possible). Ces routes ne renvoient que du JSON
   * et des redirections — aucune page à protéger par une CSP.
   */
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
