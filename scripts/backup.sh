#!/bin/sh
# Sauvegarde quotidienne (brief §8) : dump MySQL compressé + fichiers de
# stockage (badges, pièces jointes), rétention 30 jours.
#
# Usage :   ./scripts/backup.sh [répertoire_de_destination]
# Cron  :   voir scripts/backup.cron
#
# `set -eu` : une sauvegarde qui échoue à mi-parcours ne doit pas laisser croire
# qu'elle a réussi — le pire défaut possible pour une sauvegarde. Le dump est
# écrit dans un fichier temporaire puis renommé : un fichier présent dans le
# répertoire de sauvegarde est donc toujours un fichier complet.
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
APP_SERVICE="${APP_SERVICE:-app}"

log() { echo "[backup $(date -u +%H:%M:%S)] $*"; }

# Deux modes d'accès aux conteneurs : par Compose en production, par nom de
# conteneur sinon. Sans cette indirection, le script ne serait vérifiable que
# sur une pile Compose complète — donc, en pratique, jamais avant l'incident.
in_db() {
  if [ -n "${MYSQL_CONTAINER:-}" ]; then
    docker exec -i "$MYSQL_CONTAINER" "$@"
  else
    docker compose -f "$COMPOSE_FILE" exec -T "$MYSQL_SERVICE" "$@"
  fi
}
in_app() {
  if [ -n "${APP_CONTAINER:-}" ]; then
    docker exec -i "$APP_CONTAINER" "$@"
  else
    docker compose -f "$COMPOSE_FILE" exec -T "$APP_SERVICE" "$@"
  fi
}
fail() {
  echo "[backup] ÉCHEC : $*" >&2
  exit 1
}

[ -n "${MYSQL_DATABASE:-}" ] || fail "MYSQL_DATABASE non défini (charger le .env de production)."
[ -n "${MYSQL_USER:-}" ] || fail "MYSQL_USER non défini."
[ -n "${MYSQL_PASSWORD:-}" ] || fail "MYSQL_PASSWORD non défini."

mkdir -p "$BACKUP_DIR"

# --- Base de données ---------------------------------------------------------
DB_TMP="$BACKUP_DIR/.db-$STAMP.sql.gz.part"
DB_OUT="$BACKUP_DIR/db-$STAMP.sql.gz"

log "dump de $MYSQL_DATABASE…"
# --single-transaction : dump cohérent sans verrouiller les tables, donc sans
# interrompre le service. --routines/--triggers : le schéma complet, pas
# seulement les données. --no-tablespaces : le compte applicatif n'a pas le
# privilège PROCESS — et ne doit pas l'avoir ; sans cette option, mysqldump 8
# affiche une erreur à chaque exécution alors que le dump est bel et bien
# complet, ce qui finirait par faire ignorer les vraies erreurs.
in_db mysqldump \
  --single-transaction \
  --no-tablespaces \
  --quick \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  "$MYSQL_DATABASE" | gzip -9 >"$DB_TMP" || fail "mysqldump a échoué."

# Un dump vide ou tronqué passerait inaperçu sans ce contrôle.
gzip -t "$DB_TMP" || fail "archive du dump corrompue."
[ "$(stat -c %s "$DB_TMP" 2>/dev/null || wc -c <"$DB_TMP")" -gt 1024 ] ||
  fail "dump suspect (< 1 Kio) — sauvegarde non validée."

mv "$DB_TMP" "$DB_OUT"
log "base sauvegardée : $DB_OUT"

# --- Fichiers de stockage ----------------------------------------------------
# Badges PDF/PNG et pièces jointes : régénérables pour la plupart, mais les
# restaurer coûte moins cher que les reproduire.
FILES_TMP="$BACKUP_DIR/.storage-$STAMP.tar.gz.part"
FILES_OUT="$BACKUP_DIR/storage-$STAMP.tar.gz"

log "archivage du stockage applicatif…"
# `sh -c 'cd /app && …'` plutôt que `tar -C /app` : lancé depuis Git Bash sous
# Windows, un argument commençant par « / » est réécrit en chemin Windows avant
# même d'atteindre le conteneur. Cette forme est identique sur un serveur Linux
# et reste vérifiable depuis un poste de développement.
if in_app sh -c 'cd /app && tar -czf - storage' >"$FILES_TMP" 2>"$FILES_TMP.err"; then
  gzip -t "$FILES_TMP" && mv "$FILES_TMP" "$FILES_OUT" && log "stockage sauvegardé : $FILES_OUT"
else
  # La sauvegarde n'est pas interrompue : la base est l'actif critique, les
  # badges se régénèrent. Mais l'erreur est affichée, jamais avalée.
  log "stockage NON sauvegardé — $(head -c 200 "$FILES_TMP.err" 2>/dev/null)"
  rm -f "$FILES_TMP"
fi
rm -f "$FILES_TMP.err"

# --- Rétention ---------------------------------------------------------------
log "purge des sauvegardes de plus de $RETENTION_DAYS jours…"
find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'storage-*.tar.gz' -mtime "+$RETENTION_DAYS" -print -delete
# Fichiers partiels laissés par une exécution interrompue.
find "$BACKUP_DIR" -maxdepth 1 -name '.*.part' -mtime +1 -delete

log "terminé — $(find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' | wc -l) sauvegarde(s) conservée(s)."
