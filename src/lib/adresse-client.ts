/**
 * Adresse IP du visiteur, pour les limites de débit et le journal d'audit
 * (PLAN.md §18).
 *
 * ## Le défaut que cela ferme
 *
 * Six endroits lisaient le **premier** élément de `X-Forwarded-For`. Or nginx
 * (`docker/nginx.conf`) **ajoutait** l'adresse réelle à la suite de l'en-tête
 * envoyé par le client : le premier élément était donc celui que le visiteur
 * avait choisi. Mesuré : 35 vérifications de badge avec la même IP annoncée,
 * 5 refusées ; en changeant le premier élément à chaque requête, aucune. Les
 * limites par IP (inscription, vérification de badge) ne limitaient rien, et
 * les IP du journal d'audit étaient celles que l'on voulait y lire.
 *
 * ## La règle
 *
 * 1. `X-Real-IP`, que le reverse proxy **écrase** avec l'adresse de la
 *    connexion (`$remote_addr`) : une valeur envoyée par le client ne survit
 *    pas au proxy.
 * 2. À défaut, le **dernier** élément de `X-Forwarded-For` : c'est celui
 *    qu'ajoute le proxy le plus proche, le seul à avoir vu la connexion.
 * 3. Sinon, `inconnue`.
 *
 * Cela suppose que l'application ne soit joignable **que** par le proxy, ce
 * qu'assure `docker-compose.prod.yml` (aucun port publié pour `app`). Exposée
 * directement, aucun en-tête ne serait digne de confiance.
 */
export function adresseClient(entetes: Pick<Headers, "get">): string {
  const reelle = entetes.get("x-real-ip")?.trim();
  if (reelle) return reelle;

  const relais = entetes
    .get("x-forwarded-for")
    ?.split(",")
    .map((element) => element.trim())
    .filter(Boolean);
  return relais?.at(-1) ?? "inconnue";
}
