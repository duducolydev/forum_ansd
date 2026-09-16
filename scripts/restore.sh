#!/bin/sh
# Restauration d'une sauvegarde produite par scripts/backup.sh.
#
# Usage :   ./scripts/restore.sh backups/db-20260902-030000.sql.gz
#
# Une sauvegarde jamais restaurée n'est pas une sauvegarde : ce script existe
# pour que la restauration soit répétée périodiquement, pas improvisée le jour
# de l'incident.
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
DUMP="${1:-}"

fail() { echo "[restore] ÉCHEC : $*" >&2; exit 1; }

in_db() {
  if [ -n "${MYSQL_CONTAINER:-}" ]; then
    docker exec -i "$MYSQL_CONTAINER" "$@"
  else
    docker compose -f "$COMPOSE_FILE" exec -T "$MYSQL_SERVICE" "$@"
  fi
}

[ -n "$DUMP" ] || fail "usage : ./scripts/restore.sh <fichier .sql.gz>"
[ -f "$DUMP" ] || fail "fichier introuvable : $DUMP"
[ -n "${MYSQL_DATABASE:-}" ] || fail "MYSQL_DATABASE non défini (charger le .env)."
[ -n "${MYSQL_USER:-}" ] || fail "MYSQL_USER non défini."
[ -n "${MYSQL_PASSWORD:-}" ] || fail "MYSQL_PASSWORD non défini."

gzip -t "$DUMP" || fail "archive corrompue : $DUMP"

# Garde-fou : la restauration écrase la base. On exige une confirmation
# explicite plutôt que de s'en remettre à l'attention de l'opérateur.
if [ "${FORCE:-}" != "1" ]; then
  printf 'Écraser la base "%s" avec %s ? Tapez RESTAURER : ' "$MYSQL_DATABASE" "$DUMP"
  read -r answer
  [ "$answer" = "RESTAURER" ] || fail "annulé."
fi

echo "[restore] restauration en cours…"
gunzip -c "$DUMP" | in_db mysql --default-character-set=utf8mb4 \
  -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"

echo "[restore] terminé. Redémarrer l'application : docker compose -f $COMPOSE_FILE restart app"
