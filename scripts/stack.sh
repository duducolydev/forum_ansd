#!/usr/bin/env bash
# =============================================================================
# Stack locale du Forum : MySQL, Redis, Mailpit et l'application (image de
# production), sur le réseau Docker `forum-net`.
#
# Usage
#   ./scripts/stack.sh [demarrer] [options]   démarre tout (commande par défaut)
#   ./scripts/stack.sh arreter                arrête tout, sans rien supprimer
#   ./scripts/stack.sh etat                   état des conteneurs, du code et de l'application
#   ./scripts/stack.sh journaux [service]     suit les journaux (app par défaut)
#   ./scripts/stack.sh aide
#
# Options de `demarrer`
#   (sans option)      reconstruit l'image seulement si le code a changé depuis sa construction
#   --build            reconstruit l'image, même si le code n'a pas changé
#   --sans-build       ne reconstruit pas, même si le code a changé (démarrage rapide)
#   --recreer          recrée le conteneur de l'application même si son image est à jour
#   --sans-migrations  ne lance pas `prisma migrate deploy`
#   --creer-base       crée MySQL s'il n'existe pas (nouvelle machine : base VIDE, puis seed)
#
# Pourquoi pas `docker compose up` : la stack de ce poste a été montée conteneur
# par conteneur, et sa base MySQL garde ses données dans un volume anonyme.
# Compose créerait d'autres conteneurs et d'autres volumes — donc une base vide,
# sans prévenir. Ce script reprend les conteneurs existants, ne supprime jamais
# la base, et ne crée une base neuve que sur demande explicite.
#
# Savoir si l'image est à jour : à chaque construction, le script grave dans
# l'image une empreinte du code source (label `forum.empreinte`). Au démarrage,
# il la compare au code présent : différente, l'image est reconstruite. Une date
# de fichier ne suffirait pas — un simple enregistrement sans modification, ou
# un changement de branche, la ferait bouger sans que le code change.
#
# Les variables de l'application (secrets compris) sont lues dans `.env.docker`,
# non versionné. S'il manque, il est créé à partir du conteneur actuel ; à
# défaut de conteneur, avec des secrets neufs.
# =============================================================================
set -euo pipefail

# Git Bash (Windows) réécrit en chemin Windows tout argument commençant par « / »
# — `/app/storage` deviendrait `C:/Program Files/Git/app/storage`.
export MSYS_NO_PATHCONV=1

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && (pwd -W 2>/dev/null || pwd))"
cd "$RACINE"

RESEAU="forum-net"
C_MYSQL="forum-ansd-mysql"
C_REDIS="forum-ansd-redis"
C_MAILPIT="forum-ansd-mailpit"
C_APP="forum-ansd-app"
IMAGE_APP="forum-ansd:local"
LABEL_EMPREINTE="forum.empreinte"

PORT_APP="${PORT_APP:-3010}"
PORT_MYSQL="${PORT_MYSQL:-3308}"
PORT_REDIS="${PORT_REDIS:-6380}"
PORT_MAILPIT_WEB="${PORT_MAILPIT_WEB:-8025}"
PORT_MAILPIT_SMTP="${PORT_MAILPIT_SMTP:-1025}"

FICHIER_ENV="$RACINE/.env.docker"
JOURNAL_BUILD="${TMPDIR:-/tmp}/forum-ansd-build.log"

# Ce qui entre dans l'image. Les tests en sont exclus de l'empreinte : en
# modifier un ne change rien à l'application, et ne doit pas coûter un build.
SOURCES_IMAGE=(src prisma public messages package.json pnpm-lock.yaml Dockerfile
  next.config.ts tsconfig.json postcss.config.mjs prisma.config.ts)

# Variables fournies par l'image elle-même : inutile (et trompeur) de les figer
# dans `.env.docker`, elles changeraient avec l'image.
VARIABLES_IMAGE='^(PATH|NODE_VERSION|YARN_VERSION|NEXT_TELEMETRY_DISABLED|PUPPETEER_EXECUTABLE_PATH|PORT|HOSTNAME|NODE_ENV)='

# --- Affichage ----------------------------------------------------------------

info() { printf '\033[36m▸\033[0m %s\n' "$*"; }
ok() { printf '\033[32m✔\033[0m %s\n' "$*"; }
alerte() { printf '\033[33m!\033[0m %s\n' "$*"; }
echec() {
  printf '\033[31m✘ %s\033[0m\n' "$*" >&2
  exit 1
}

# --- Outils --------------------------------------------------------------------

existe() { docker container inspect "$1" >/dev/null 2>&1; }
en_route() { [ "$(docker container inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }
image_existe() { docker image inspect "$IMAGE_APP" >/dev/null 2>&1; }
image_de() { docker container inspect -f '{{.Image}}' "$1"; }
court() { printf '%s' "${1#sha256:}" | cut -c1-12; }

# attendre <description> <délai en secondes> <commande...>
attendre() {
  local description=$1 delai=$2
  shift 2
  local fin=$((SECONDS + delai))
  until "$@" >/dev/null 2>&1; do
    [ "$SECONDS" -lt "$fin" ] || echec "$description : toujours pas prêt après ${delai} s"
    sleep 2
  done
  ok "$description"
}

# Empêche la mise en veille de Windows pendant une construction longue : une
# veille en plein téléchargement des dépendances fait échouer le build.
PID_VEILLE=""
empecher_veille() {
  command -v powershell.exe >/dev/null 2>&1 || return 0
  [ -z "$PID_VEILLE" ] || return 0
  powershell.exe -NoProfile -Command "Add-Type -Namespace Veille -Name Etat -MemberDefinition '[System.Runtime.InteropServices.DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint esFlags);'; [void][Veille.Etat]::SetThreadExecutionState([uint32]'0x80000001'); Start-Sleep -Seconds 3600" >/dev/null 2>&1 &
  PID_VEILLE=$!
}
nettoyer() {
  if [ -n "$PID_VEILLE" ]; then kill "$PID_VEILLE" 2>/dev/null || true; fi
}
trap nettoyer EXIT

# --- Empreinte du code ----------------------------------------------------------

empreinte_sources() {
  local presents=() source
  for source in "${SOURCES_IMAGE[@]}"; do
    [ -e "$RACINE/$source" ] && presents+=("$source")
  done
  find "${presents[@]}" -type f -not -name '*.test.ts' -not -name '*.test.tsx' -print0 |
    LC_ALL=C sort -z | xargs -0 sha1sum | sha1sum | cut -c1-16
}

empreinte_image() {
  docker image inspect -f "{{if .Config.Labels}}{{index .Config.Labels \"$LABEL_EMPREINTE\"}}{{end}}" \
    "$IMAGE_APP" 2>/dev/null || true
}

# absente | inconnue (construite hors de ce script) | identique | modifie
etat_du_code() {
  image_existe || {
    echo absente
    return 0
  }
  local empreinte
  empreinte=$(empreinte_image)
  if [ -z "$empreinte" ] || [ "$empreinte" = "<no value>" ]; then
    echo inconnue
  elif [ "$empreinte" = "$(empreinte_sources)" ]; then
    echo identique
  else
    echo modifie
  fi
}

# --- Étapes --------------------------------------------------------------------

verifier_docker() {
  docker info >/dev/null 2>&1 && return 0
  local desktop="/c/Program Files/Docker/Docker/Docker Desktop.exe"
  if [ -f "$desktop" ] && command -v powershell.exe >/dev/null 2>&1; then
    info "Docker ne répond pas : lancement de Docker Desktop…"
    powershell.exe -NoProfile -Command "Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" >/dev/null 2>&1
    attendre "Docker démarré" 180 docker info
  else
    echec "Docker ne répond pas. Démarrez Docker, puis relancez ce script."
  fi
}

preparer_env() {
  if [ -f "$FICHIER_ENV" ]; then
    ok ".env.docker présent"
    return 0
  fi

  if existe "$C_APP"; then
    info "Création de .env.docker à partir du conteneur actuel (secrets conservés)…"
    docker container inspect "$C_APP" --format '{{range .Config.Env}}{{println .}}{{end}}' |
      sed '/^$/d' | grep -Ev "$VARIABLES_IMAGE" >"$FICHIER_ENV"
  else
    # Nouvelle machine. Les secrets sont tirés au hasard : les réutiliser d'une
    # installation à l'autre rendrait les badges et les liens interchangeables.
    command -v openssl >/dev/null 2>&1 || echec "openssl est nécessaire pour générer les secrets."
    info "Création de .env.docker avec des secrets neufs…"
    cat >"$FICHIER_ENV" <<EOF
DATABASE_URL=mysql://forum:$(openssl rand -hex 16)@$C_MYSQL:3306/forum_ansd
REDIS_URL=redis://$C_REDIS:6379
SMTP_HOST=$C_MAILPIT
SMTP_PORT=1025
SMTP_FROM=Forum international sur les données <forum@ansd.sn>
AUTH_URL=http://localhost:$PORT_APP
PUBLIC_BASE_URL=http://localhost:$PORT_APP
AUTH_SECRET=$(openssl rand -hex 32)
MAGIC_LINK_SECRET=$(openssl rand -hex 32)
BADGE_HMAC_SECRET=$(openssl rand -hex 32)
EOF
    alerte "Relisez .env.docker avant une mise en service réelle (SMTP, domaine public)."
  fi

  chmod 600 "$FICHIER_ENV" 2>/dev/null || true
  [ "$(grep -c '=' "$FICHIER_ENV")" -ge 8 ] || echec ".env.docker semble incomplet : vérifiez-le."
  ok ".env.docker créé (non versionné)"
}

valeur_env() { grep -E "^$1=" "$FICHIER_ENV" | head -n 1 | cut -d= -f2-; }

construire() {
  local empreinte debut=$SECONDS
  empreinte=$(empreinte_sources)
  info "Construction de l'image $IMAGE_APP (plusieurs minutes, davantage si les dépendances ont changé)…"
  empecher_veille
  if ! docker build --label "$LABEL_EMPREINTE=$empreinte" -t "$IMAGE_APP" . >"$JOURNAL_BUILD" 2>&1; then
    tail -n 25 "$JOURNAL_BUILD" >&2
    echec "Construction en échec — aucun conteneur n'a été touché. Journal : $JOURNAL_BUILD"
  fi
  if grep -qE 'Failed to compile|Type error' "$JOURNAL_BUILD"; then
    echec "Erreur de compilation dans le build. Journal : $JOURNAL_BUILD"
  fi
  ok "Image construite en $(((SECONDS - debut) / 60)) min $(((SECONDS - debut) % 60)) s (empreinte $empreinte)"
}

# Décide s'il faut construire, selon l'option et l'état du code.
decider_build() {
  local code
  code=$(etat_du_code)
  case "$BUILD" in
    oui)
      construire
      RECREER=oui
      ;;
    auto)
      case "$code" in
        identique) ok "Image à jour avec le code (aucune construction nécessaire)" ;;
        absente) info "Aucune image : construction." && construire && RECREER=oui ;;
        inconnue) info "Image construite hors de ce script, version du code inconnue : construction." && construire && RECREER=oui ;;
        modifie) info "Le code a changé depuis la construction de l'image : reconstruction." && construire && RECREER=oui ;;
      esac
      ;;
    non)
      if [ "$code" = absente ]; then
        info "Aucune image : construction malgré --sans-build."
        construire
        RECREER=oui
      elif [ "$code" != identique ]; then
        alerte "Le code a changé depuis la construction de l'image : l'application démarrée ne l'inclut pas."
      fi
      ;;
  esac
}

preparer_reseau() {
  docker network inspect "$RESEAU" >/dev/null 2>&1 || docker network create "$RESEAU" >/dev/null
}

rejoindre_reseau() {
  if ! docker network inspect "$RESEAU" -f '{{range .Containers}}{{.Name}} {{end}}' | grep -qw "$1"; then
    docker network connect "$RESEAU" "$1"
  fi
}

demarrer_existant() {
  if en_route "$1"; then
    ok "$1 déjà démarré"
  else
    docker start "$1" >/dev/null
    info "$1 démarré"
  fi
}

mysql_repond() {
  # Requête réelle, en TCP : pendant son initialisation, MySQL lance un serveur
  # temporaire sans réseau qui répondrait à un simple `ping`.
  docker exec "$C_MYSQL" sh -c \
    'mysql -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" "$MYSQL_DATABASE"'
}

BASE_NEUVE=non
demarrer_mysql() {
  if existe "$C_MYSQL"; then
    demarrer_existant "$C_MYSQL"
  elif [ "$CREER_BASE" = oui ]; then
    local url utilisateur mot_de_passe base
    url=$(valeur_env DATABASE_URL)
    utilisateur=$(printf '%s' "$url" | sed -E 's#^mysql://([^:]+):.*#\1#')
    mot_de_passe=$(printf '%s' "$url" | sed -E 's#^mysql://[^:]+:([^@]+)@.*#\1#')
    base=$(printf '%s' "$url" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')
    info "Création de MySQL (base vide « $base »)…"
    docker run -d --name "$C_MYSQL" --network "$RESEAU" -p "$PORT_MYSQL:3306" \
      -v forum-ansd-mysql-data:/var/lib/mysql \
      -e MYSQL_ROOT_PASSWORD="$(openssl rand -hex 16)" \
      -e MYSQL_DATABASE="$base" -e MYSQL_USER="$utilisateur" -e MYSQL_PASSWORD="$mot_de_passe" \
      mysql:8.4 >/dev/null
    BASE_NEUVE=oui
  else
    echec "Le conteneur $C_MYSQL n'existe pas. Sur une nouvelle machine, relancez avec --creer-base (base vide). S'il a été supprimé par erreur, ses données sont dans un volume anonyme : ne créez rien avant de l'avoir retrouvé (docker volume ls)."
  fi
  rejoindre_reseau "$C_MYSQL"
  attendre "MySQL prêt (localhost:$PORT_MYSQL)" 180 mysql_repond
}

demarrer_redis() {
  if existe "$C_REDIS"; then
    demarrer_existant "$C_REDIS"
  else
    info "Création de Redis…"
    docker run -d --name "$C_REDIS" --network "$RESEAU" -p "$PORT_REDIS:6379" \
      -v forum-ansd-redis-data:/data redis:7-alpine >/dev/null
  fi
  rejoindre_reseau "$C_REDIS"
  attendre "Redis prêt (localhost:$PORT_REDIS)" 60 docker exec "$C_REDIS" redis-cli ping
}

demarrer_mailpit() {
  if existe "$C_MAILPIT"; then
    demarrer_existant "$C_MAILPIT"
  else
    info "Création de Mailpit…"
    docker run -d --name "$C_MAILPIT" --network "$RESEAU" \
      -p "$PORT_MAILPIT_SMTP:1025" -p "$PORT_MAILPIT_WEB:8025" axllent/mailpit >/dev/null
  fi
  rejoindre_reseau "$C_MAILPIT"
  attendre "Mailpit prêt (http://localhost:$PORT_MAILPIT_WEB)" 60 \
    curl -fsS "http://localhost:$PORT_MAILPIT_WEB/readyz"
}

migrer() {
  if [ ! -x "$RACINE/node_modules/.bin/prisma" ]; then
    alerte "Migrations non lancées : dépendances absentes sur ce poste (lancez « pnpm install »)."
    return 0
  fi
  # L'application joint MySQL par son nom de conteneur ; depuis le poste, c'est
  # le port publié. L'adresse est dérivée de .env.docker pour rester cohérente.
  local url_hote journal="${TMPDIR:-/tmp}/forum-ansd-migrations.log"
  url_hote=$(valeur_env DATABASE_URL | sed -E "s#@$C_MYSQL:3306/#@localhost:$PORT_MYSQL/#")
  info "Migrations (prisma migrate deploy)…"
  if ! DATABASE_URL="$url_hote" "$RACINE/node_modules/.bin/prisma" migrate deploy >"$journal" 2>&1; then
    cat "$journal" >&2
    echec "Migrations en échec — l'application n'a pas été (re)démarrée."
  fi
  ok "Schéma de la base à jour"

  if [ "$BASE_NEUVE" = oui ]; then
    info "Base neuve : chargement des données de référence (seed)…"
    DATABASE_URL="$url_hote" "$RACINE/node_modules/.bin/tsx" prisma/seed.ts
    ok "Données de référence chargées"
  fi
}

demarrer_app() {
  local image
  image=$(docker image inspect -f '{{.Id}}' "$IMAGE_APP")

  if existe "$C_APP" && [ "$RECREER" = non ] && [ "$(image_de "$C_APP")" = "$image" ]; then
    demarrer_existant "$C_APP"
  else
    # Recréer, pas redémarrer : `docker restart` garde l'image d'origine du
    # conteneur, même après une reconstruction (PLAN.md §10.8).
    info "(Re)création du conteneur de l'application…"
    mkdir -p "$RACINE/storage"
    if existe "$C_APP"; then docker rm -f "$C_APP" >/dev/null; fi
    docker run -d --name "$C_APP" --network "$RESEAU" -p "$PORT_APP:3000" \
      -v "$RACINE/storage:/app/storage" --env-file "$FICHIER_ENV" "$IMAGE_APP" >/dev/null
    [ "$(image_de "$C_APP")" = "$image" ] || echec "Le conteneur ne tourne pas sur l'image attendue."
    ok "Application sur l'image $(court "$image")"
  fi

  attendre "Application prête (http://localhost:$PORT_APP)" 120 \
    curl -fsS "http://localhost:$PORT_APP/api/health"
}

resume() {
  cat <<EOF

  Site public    http://localhost:$PORT_APP
  BackOffice     http://localhost:$PORT_APP/admin
  Scanner        http://localhost:$PORT_APP/scan
  Mailpit        http://localhost:$PORT_MAILPIT_WEB
  MySQL (poste)  localhost:$PORT_MYSQL
  Redis (poste)  localhost:$PORT_REDIS

EOF
}

# --- Commandes -----------------------------------------------------------------

cmd_demarrer() {
  local debut=$SECONDS
  verifier_docker
  preparer_env
  # Le build passe avant tout arrêt ou recréation : un build raté ne doit rien
  # avoir touché à ce qui tourne.
  decider_build
  preparer_reseau
  demarrer_mysql
  demarrer_redis
  demarrer_mailpit
  if [ "$MIGRATIONS" = oui ]; then migrer; fi
  demarrer_app
  ok "Stack démarrée en $((SECONDS - debut)) s"
  resume
}

cmd_arreter() {
  verifier_docker
  # Ordre inverse du démarrage ; `stop` et jamais `rm` : les données restent.
  for conteneur in "$C_APP" "$C_MAILPIT" "$C_REDIS" "$C_MYSQL"; do
    if en_route "$conteneur"; then
      docker stop "$conteneur" >/dev/null
      ok "$conteneur arrêté"
    elif existe "$conteneur"; then
      ok "$conteneur déjà arrêté"
    fi
  done
}

cmd_etat() {
  verifier_docker
  for conteneur in "$C_MYSQL" "$C_REDIS" "$C_MAILPIT" "$C_APP"; do
    if existe "$conteneur"; then
      printf '  %-20s %s\n' "$conteneur" "$(docker container inspect -f '{{.State.Status}}' "$conteneur")"
    else
      printf '  %-20s %s\n' "$conteneur" "absent"
    fi
  done

  case "$(etat_du_code)" in
    identique) printf '  %-20s %s\n' "code" "identique à l'image" ;;
    modifie) printf '  %-20s %s\n' "code" "MODIFIÉ depuis la construction : ./scripts/stack.sh le reconstruira" ;;
    inconnue) printf '  %-20s %s\n' "code" "version inconnue (image construite hors de ce script)" ;;
    absente) printf '  %-20s %s\n' "code" "aucune image construite" ;;
  esac

  if existe "$C_APP" && image_existe; then
    if [ "$(image_de "$C_APP")" = "$(docker image inspect -f '{{.Id}}' "$IMAGE_APP")" ]; then
      printf '  %-20s %s\n' "conteneur" "sur la dernière image ($(court "$(image_de "$C_APP")"))"
    else
      printf '  %-20s %s\n' "conteneur" "sur une image PLUS ANCIENNE : relancez avec --recreer"
    fi
  fi

  if curl -fsS "http://localhost:$PORT_APP/api/health" >/dev/null 2>&1; then
    printf '  %-20s %s\n' "application" "répond (http://localhost:$PORT_APP)"
  else
    printf '  %-20s %s\n' "application" "ne répond pas"
  fi
}

cmd_journaux() {
  local service=${1:-app}
  existe "forum-ansd-$service" || echec "Service inconnu : $service (app, mysql, redis, mailpit)."
  docker logs --tail 100 -f "forum-ansd-$service"
}

cmd_aide() {
  # De la ligne 3 jusqu'au paragraphe « Pourquoi », sans compter les lignes.
  awk 'NR < 3 { next } /^# Pourquoi/ { exit } { sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
}

# --- Arguments -----------------------------------------------------------------

COMMANDE=demarrer
case "${1:-}" in
  demarrer | arreter | etat | journaux | aide) COMMANDE=$1 && shift ;;
  -h | --help) COMMANDE=aide && shift ;;
esac

BUILD=auto
RECREER=non
MIGRATIONS=oui
CREER_BASE=non

if [ "$COMMANDE" = demarrer ]; then
  while [ $# -gt 0 ]; do
    case $1 in
      --build) BUILD=oui ;;
      --sans-build) BUILD=non ;;
      --recreer) RECREER=oui ;;
      --sans-migrations) MIGRATIONS=non ;;
      --creer-base) CREER_BASE=oui ;;
      -h | --help) COMMANDE=aide ;;
      *) echec "Option inconnue : $1 (voir ./scripts/stack.sh aide)" ;;
    esac
    shift
  done
fi

case $COMMANDE in
  demarrer) cmd_demarrer ;;
  arreter) cmd_arreter ;;
  etat) cmd_etat ;;
  journaux) cmd_journaux "${1:-app}" ;;
  aide) cmd_aide ;;
esac
