#!/usr/bin/env bash
# =============================================================================
# Mise à jour du portail en production, sans toucher aux données.
#
# Usage, sur le serveur :
#   cd /opt/forum-ansd && ./scripts/deployer.sh
#
# Étapes, chacune bloquante :
#   1. vérifications : fichiers de production présents, aucun changement local ;
#   2. sauvegarde (scripts/backup.sh) : sans sauvegarde, pas de mise à jour ;
#   3. comptage des données (participants, invitations, contenus…) ;
#   4. récupération du code (git pull --ff-only) ;
#   5. construction des images `app` et `outils`, ensemble ;
#   6. relecture des migrations (pnpm migrations:verifier) : une migration qui
#      supprimerait ou réécrirait des données arrête tout, avant la base ;
#   7. redémarrage de l'application, puis `prisma migrate deploy` ;
#   8. second comptage : une table qui a perdu des lignes est signalée, avec la
#      sauvegarde à restaurer.
#
# Ce qu'il ne fait jamais : rejouer le seed, lancer un script de section ou de
# démonstration, supprimer un volume. Les données de production ne changent
# que par le BackOffice — et par les migrations, qui ne font qu'ajouter
# (prisma/garde-migrations.ts).
#
# Pourquoi un script plutôt que les cinq commandes de docs/DEPLOIEMENT.md :
# chacune de ces étapes a déjà été oubliée ou faite dans le désordre au moins
# une fois (image `outils` non reconstruite le 29 septembre, surcouche interne
# ajoutée le 25). Une procédure qui se tape à la main finit par se taper mal.
# =============================================================================
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

COMPOSE_FILE="docker-compose.prod.yml"
forum() { docker compose -f "$COMPOSE_FILE" "$@"; }

info() { printf '\033[36m▸\033[0m %s\n' "$*"; }
ok() { printf '\033[32m✔\033[0m %s\n' "$*"; }
alerte() { printf '\033[33m!\033[0m %s\n' "$*"; }
echec() {
  printf '\033[31m✘ %s\033[0m\n' "$*" >&2
  exit 1
}

# Tables comptées avant et après. Pendant la mise à jour, le site reste ouvert :
# les inscriptions continuent, les nombres peuvent monter. Ils ne descendent
# que si quelque chose a supprimé des lignes.
TABLES=(Participant Invitation Delegation Referent Badge SessionRegistration ScanLog
  Speaker Session Sponsor Hotel PracticalContact Post Newsletter MediaAlbum MediaItem
  PageSection ContentBlock NotificationTemplate Contribution Document User)

# compter -> lignes « Table<TAB>nombre », lues dans le conteneur MySQL avec
# ses propres identifiants (variables MYSQL_* du service).
compter() {
  local requete="" table
  for table in "${TABLES[@]}"; do
    if [ -n "$requete" ]; then requete+=" UNION ALL "; fi
    requete+="SELECT '$table', COUNT(*) FROM \`$table\`"
  done
  forum exec -T mysql sh -c 'mysql -N -B -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "$1"' \
    sh "$requete" 2>/dev/null
}

# --- 1. Vérifications -----------------------------------------------------------
[ -f "$COMPOSE_FILE" ] || echec "$COMPOSE_FILE introuvable : lancer depuis /opt/forum-ansd."
[ -f .env ] || echec ".env introuvable : ce script ne sert que sur le serveur de production."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echec "Modifications locales sur le serveur (git status) : les commiter ailleurs ou les annuler d'abord."
fi
forum ps --status running --services 2>/dev/null | grep -qx mysql ||
  echec "Le service mysql ne tourne pas : rien n'a été fait."
ok "Serveur prêt"

# --- 2. Sauvegarde ----------------------------------------------------------------
info "Sauvegarde de la base et des fichiers…"
# Sous-shell : le .env ne doit pas rester exporté dans ce shell, où il
# masquerait ensuite les valeurs du fichier pour Compose (docs/DEPLOIEMENT.md §4).
(set -a && . ./.env && set +a && COMPOSE_FILE="$COMPOSE_FILE" ./scripts/backup.sh) ||
  echec "Sauvegarde en échec : rien n'a été mis à jour."
SAUVEGARDE="$(ls -1t backups/db-*.sql.gz 2>/dev/null | head -n 1)"
[ -n "$SAUVEGARDE" ] || echec "Aucune sauvegarde trouvée dans backups/ : rien n'a été mis à jour."
ok "Sauvegarde : $SAUVEGARDE"

# --- 3. Comptage avant ----------------------------------------------------------------
declare -A AVANT
while IFS=$'\t' read -r table nombre; do
  AVANT[$table]=$nombre
done < <(compter)
[ "${#AVANT[@]}" -eq "${#TABLES[@]}" ] || echec "Comptage impossible avant la mise à jour : rien n'a été fait."
ok "Comptage fait (${AVANT[Participant]} participants, ${AVANT[Invitation]} invitations)"

# --- 4. Code ----------------------------------------------------------------------------
COMMIT_AVANT="$(git rev-parse --short HEAD)"
info "Récupération du code…"
git pull --ff-only || echec "git pull a échoué : rien n'a été mis à jour."
COMMIT_APRES="$(git rev-parse --short HEAD)"
if [ "$COMMIT_AVANT" = "$COMMIT_APRES" ]; then
  ok "Code déjà à jour ($COMMIT_APRES) : reconstruction quand même"
else
  ok "Code : $COMMIT_AVANT → $COMMIT_APRES"
fi
retour="pour revenir au code précédent : git reset --hard $COMMIT_AVANT"

# --- 5. Images ------------------------------------------------------------------------------
info "Construction des images app et outils (plusieurs minutes)…"
forum build app outils || echec "Construction en échec : l'application en service n'a pas été touchée ($retour)."

# Le piège du 29 septembre : une image `outils` qui n'embarque pas les
# migrations du code tiré répond « No pending migrations » et laisse
# l'application sans ses colonnes.
attendues="$(ls -d prisma/migrations/*/ | wc -l | tr -d ' ')"
embarquees="$(forum run --rm -T outils sh -c 'ls -d prisma/migrations/*/ | wc -l' | tr -d ' \r')"
[ "$attendues" = "$embarquees" ] ||
  echec "L'image outils embarque $embarquees migrations, le code en compte $attendues : rien n'a été appliqué."
ok "Images construites ($attendues migrations embarquées)"

# --- 6. Relecture des migrations ---------------------------------------------------------------
info "Relecture des migrations…"
forum run --rm -T outils pnpm -s migrations:verifier ||
  echec "Migration refusée : rien n'a été appliqué, l'application en service n'a pas été touchée ($retour)."

# --- 7. Application et schéma --------------------------------------------------------------------
info "Redémarrage de l'application…"
forum up -d app
info "Migrations…"
forum run --rm -T outils pnpm prisma migrate deploy ||
  echec "prisma migrate deploy a échoué. Sauvegarde à restaurer si besoin : $SAUVEGARDE (scripts/restore.sh)."

info "Attente de l'application…"
for _ in $(seq 1 60); do
  if forum exec -T app wget --spider -q http://127.0.0.1:3000/api/health 2>/dev/null; then break; fi
  sleep 2
done
forum exec -T app wget --spider -q http://127.0.0.1:3000/api/health 2>/dev/null ||
  alerte "L'application ne répond pas encore : forum logs -f app"

# --- 8. Comptage après ------------------------------------------------------------------------------
declare -A APRES
while IFS=$'\t' read -r table nombre; do
  APRES[$table]=$nombre
done < <(compter)

pertes=0
for table in "${TABLES[@]}"; do
  avant="${AVANT[$table]:-0}"
  apres="${APRES[$table]:-}"
  if [ -z "$apres" ]; then
    alerte "$table : comptage impossible après la mise à jour"
    pertes=1
  elif [ "$apres" -lt "$avant" ]; then
    alerte "$table : $avant → $apres lignes"
    pertes=1
  fi
done

if [ "$pertes" -ne 0 ]; then
  printf '\033[31m✘ Des lignes ont disparu pendant la mise à jour.\033[0m\n' >&2
  echo "  Si personne n'a supprimé de fiche dans le BackOffice entre-temps, restaurer :" >&2
  echo "  ( set -a && . ./.env && set +a && ./scripts/restore.sh $SAUVEGARDE )" >&2
  exit 2
fi

ok "Données intactes (${APRES[Participant]} participants, ${APRES[Invitation]} invitations)"
ok "Mise à jour terminée : $COMMIT_APRES"
