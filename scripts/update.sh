#!/usr/bin/env bash
# Единая точка деплоя server-shop-sp-next + миграция со старой Vite-витрины.
#
# Обычное обновление (после миграции — сам обновляет Next-витрину):
#   ./scripts/update.sh                              # синк ветки + latest
#   ./scripts/update.sh --ref-type tag --ref v1.2.3  # тег-релиз
#   ./scripts/update.sh --no-sync                    # без git (deploy.sh)
#   CI:      ./scripts/update.sh --ref-type tag --ref v1.2.3
#            ./scripts/update.sh --ref-type branch --ref main   (workflow_dispatch)
#
# Миграция с server-shop-sp-ui (Vite SPA) — один клик:
#   ./scripts/update.sh --migrate                    # авто-поиск ../server-shop-sp-ui
#   ./scripts/update.sh --migrate --old-ui /path     # явно
#   ./scripts/update.sh --migrate --dry-run          # показать план
#   ./scripts/update.sh --migrate --keep-images      # не удалять образы старой
#
# АВТООПРЕДЕЛЕНИЕ: если .env.prod отсутствует, но рядом найдена старая
# витрина с .env.prod — update.sh сам переходит в режим миграции (кроме
# тег-деплоя из CI — там миграция должна быть явной). После миграции
# .env.prod существует, и все последующие вызовы (вкл. Deploy workflow)
# обновляют Next-витрину без каких-либо флагов.
#
# Миграция делает: конвертацию VITE_*→NEXT_* → canary-деплой (прод не
# тронут) → стоп старой витрины → Next с прод-алиасом (Caddyfile не
# меняется: Next слушает :80, как nginx старой витрины) → smoke →
# автовой при провале → очистка старых контейнеров (cleanup-old-ui.sh).
#
# Стратегия обновлений — DEPLOY_STRATEGY в .env.prod:
#   build (по умолчанию) | pull | pull-or-build.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/scripts/lib-github.sh"
cd "$ROOT"

REF_TYPE="branch"
REF_NAME=""
NO_SYNC=0
MIGRATE=0
OLD_UI=""
DRY_RUN=0
KEEP_IMAGES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --ref-type) REF_TYPE="${2:-branch}"; shift 2 ;;
    --ref-type=*) REF_TYPE="${1#--ref-type=}"; shift ;;
    --ref) REF_NAME="${2:-}"; shift 2 ;;
    --ref=*) REF_NAME="${1#--ref=}"; shift ;;
    --no-sync) NO_SYNC=1; shift ;;
    --migrate) MIGRATE=1; shift ;;
    --old-ui) OLD_UI="${2:-}"; shift 2 ;;
    --old-ui=*) OLD_UI="${1#--old-ui=}"; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --keep-images) KEEP_IMAGES=1; shift ;;
    --help|-h) sed -n '2,29p' "$0"; exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

# Общий VM lock — и для миграции, и для деплоя (межрепозиторная гонка с
# соседними витринами на той же VPS; GitHub concurrency её не покрывает).
LOCK_DIR="${DEPLOY_LOCK_DIR:-/tmp/server-shop-deploy.lock}"
_vm_lock() {
  _t=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    _o="$(cat "$LOCK_DIR/owner" 2>/dev/null || echo unknown)"
    if [ "$_t" -ge 600 ]; then echo "VM lock занят >600s ($_o)" >&2; return 1; fi
    [ "$_t" -eq 0 ] && echo "  Жду VM lock (занят: $_o)…"
    sleep 5; _t=$((_t + 5))
  done
  printf '%s %s %s %s' "$(date -u +%FT%TZ)" "$([ "$MIGRATE" -eq 1 ] && echo migrate || echo update)" "${COMPOSE_PROJECT_NAME:-?}" "$$" >"$LOCK_DIR/owner" 2>/dev/null || true
  trap 'rm -f "$LOCK_DIR/owner" 2>/dev/null; rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM
}
_vm_lock || exit 1

# ── Режим миграции ──────────────────────────────────────────────────────────
if [ "$MIGRATE" -eq 1 ]; then
  # shellcheck disable=SC1091
  . "$ROOT/scripts/lib-migrate.sh"
  do_migrate
  exit $?
fi

if [ -f .env.prod ]; then
  load_prod_env "$ROOT"
elif [ -f .env ]; then
  _dotenv_load_safe ./.env
fi

if [ ! -f .env.prod ]; then
  # АВТООПРЕДЕЛЕНИЕ: первого запуска ещё не было. Если рядом живёт старая
  # витрина — это миграция в один клик; тег-деплой из CI не мигрирует сам
  # (миграция — осознанное действие с переключением прода).
  # shellcheck disable=SC1091
  . "$ROOT/scripts/lib-migrate.sh"
  if [ "$REF_TYPE" = "tag" ]; then
    echo "✗ Нет .env.prod и передан --ref-type tag — тег-деплой не запускает миграцию сам." >&2
    echo "  Сначала мигрируйте вручную: ./scripts/update.sh --migrate" >&2
    exit 1
  fi
  if detect_old_ui >/dev/null; then
    echo "==> .env.prod отсутствует, но найдена старая Vite-витрина → режим миграции."
    echo "    (явный вызов: ./scripts/update.sh --migrate [--dry-run] [--old-ui <path>])"
    do_migrate
    exit $?
  fi
  echo "Нет .env.prod — это enterprise-скрипт. Сначала: ./scripts/configure.sh --mode enterprise или ./scripts/update.sh --migrate (перенесёт конфиг со старой витрины)" >&2
  exit 1
fi

# ── Обычное обновление Next-витрины (миграция уже была или не нужна) ───────
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
if [ "${PUBLISH_UI:-}" = y ] || [ "${PUBLISH_UI:-}" = true ]; then
  if [ -f docker-compose.publish.yml ]; then
    COMPOSE=(docker compose -f docker-compose.prod.yml -f docker-compose.publish.yml --env-file .env.prod)
  fi
fi
REMOTE_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
if [ -z "$REMOTE_URL" ]; then
  echo "Нет remote origin в $(pwd) — деплой невозможен" >&2
  exit 1
fi
# Единый источник имени образа — Compose, а не git remote.
IMG_COMPOSE="$(docker compose -f docker-compose.prod.yml --env-file .env.prod config --format json 2>/dev/null | grep -o '"image":"[^"]*"' | head -n1 | cut -d'"' -f4 || true)"
IMG_REPO="${IMAGE_REPO:-$(basename "${REMOTE_URL%.git}")}"
IMG_BASE="ghcr.io/${GITHUB_REPOSITORY_OWNER:-local}/$IMG_REPO"
if [ -n "$IMG_COMPOSE" ]; then
  _compose_repo="$(printf '%s' "$IMG_COMPOSE" | sed -e 's#^.*/##' -e 's#:.*$##')"
  if [ -n "$_compose_repo" ] && [ "$_compose_repo" != "$IMG_REPO" ] && [ -z "${IMAGE_REPO:-}" ]; then
    echo "  WARN: git remote даёт образ $IMG_REPO, а compose использует $_compose_repo — беру compose (установите IMAGE_REPO для точности)" >&2
    IMG_REPO="$_compose_repo"
    IMG_BASE="ghcr.io/${GITHUB_REPOSITORY_OWNER:-local}/$IMG_REPO"
  fi
fi

# Последний удачный релиз — цель отката.
# Формат .deploy-state:
#   line1: IMAGE_TAG фактический запущенный
#   line2: BRANCH
#   line3: GIT_SHA
#   line4: epoch + status (ok|rolled-back)
STATE="$ROOT/.deploy-state"
PREV_TAG=""
BRANCH=""
PREV_SHA=""
if [ -f "$STATE" ]; then
  PREV_TAG="$(sed -n '1p' "$STATE")"
  BRANCH="$(sed -n '2p' "$STATE")"
  PREV_SHA="$(sed -n '3p' "$STATE" 2>/dev/null || true)"
fi
[ -n "$BRANCH" ] || BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo main)"
CUR_SHA_BEFORE="$(git rev-parse HEAD 2>/dev/null || echo unknown)"

# 1) Код
if [ "$NO_SYNC" -eq 0 ]; then
  require_gh_token
  if [ "$REF_TYPE" = "tag" ]; then
    [ -n "$REF_NAME" ] || { echo "--ref обязателен для --ref-type tag" >&2; exit 1; }
    github_checkout_tag "$REF_NAME"
    IMAGE_TAG_ARG="${REF_NAME#v}"
  else
    if [ -n "$REF_NAME" ] && [ "$REF_NAME" != "$BRANCH" ]; then
      echo "  Branch deploy: переключаюсь на $REF_NAME (был $BRANCH)"
      git fetch origin "$REF_NAME" 2>/dev/null || true
      git checkout -f "$REF_NAME" 2>/dev/null || git checkout -f -b "$REF_NAME" "origin/$REF_NAME"
      BRANCH="$REF_NAME"
    elif ! git symbolic-ref --short HEAD >/dev/null 2>&1; then
      echo "  HEAD detached — возвращаюсь на ветку $BRANCH"
      git checkout -f "$BRANCH"
    fi
    github_git_pull
    IMAGE_TAG_ARG="${IMAGE_TAG:-latest}"
  fi
else
  IMAGE_TAG_ARG="${IMAGE_TAG:-latest}"
fi
NEW_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"

# 2) ghcr-логин — нужен только для стратегии pull и откатов к образам из GHCR
if [ -n "${GH_TOKEN:-}" ]; then
  github_docker_login || echo "  ghcr.io login не удался — pull приватных образов недоступен (при стратегии build не мешает)"
fi

# 3) Деплой: pull = только CI-образ; build = локальная сборка; без неявных fallback.
DEPLOY_STRATEGY="${DEPLOY_STRATEGY:-build}"
echo "==> Цель: $IMG_BASE:$IMAGE_TAG_ARG (стратегия: $DEPLOY_STRATEGY)"
DEPLOYED=""
deploy_build() {
  IMAGE_TAG="$IMAGE_TAG_ARG" "${COMPOSE[@]}" up -d --build
  DEPLOYED="build"
}
deploy_pull() {
  IMAGE_TAG="$IMAGE_TAG_ARG" "${COMPOSE[@]}" pull || return 1
  IMAGE_TAG="$IMAGE_TAG_ARG" "${COMPOSE[@]}" up -d --no-build || return 1
  DEPLOYED="pull"
  return 0
}
if [ "$DEPLOY_STRATEGY" = "pull" ]; then
  deploy_pull || { echo "  ✗ Образ $IMAGE_TAG_ARG недоступен в GHCR — fallback ЗАПРЕЩЁН в режиме pull (production). Проверьте images workflow." >&2; exit 1; }
elif [ "$DEPLOY_STRATEGY" = "pull-or-build" ]; then
  deploy_pull || {
    echo "  Образ $IMAGE_TAG_ARG недоступен в GHCR — собираю на сервере (явный pull-or-build)"
    deploy_build
  }
else
  deploy_build
fi

# 4) Smoke: контейнер отвечает на /api/healthz, SSR-HTML содержит <title>,
#    в клиентском бандле ожидаемый API-URL (ловим образ, собранный с чужим
#    NEXT_PUBLIC_ конфигом — URL передаём через env, не интерполяцией).
smoke() {
  "${COMPOSE[@]}" exec -T web wget -qO- http://127.0.0.1:80/api/healthz >/dev/null || return 1
  "${COMPOSE[@]}" exec -T web wget -qO- http://127.0.0.1:80/ | grep -qi "<title" || return 1
  if [ -n "${NEXT_PUBLIC_API_BASE_URL:-}" ] && [ "${NEXT_PUBLIC_API_BASE_URL#http://127.0.0.1}" = "$NEXT_PUBLIC_API_BASE_URL" ]; then
    NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" "${COMPOSE[@]}" exec -T -e NEXT_PUBLIC_API_BASE_URL web sh -c 'grep -rqF -- "$NEXT_PUBLIC_API_BASE_URL" /app/.next/static' || {
      echo "  ✗ В клиентском бандле нет $NEXT_PUBLIC_API_BASE_URL — задайте vars NEXT_PUBLIC_* в GitHub (Settings → Variables)" >&2
      return 1
    }
  fi
  return 0
}
smoke_external() {
  # Внешняя доступность через Caddy (домен/TLS/маршрут)
  _url="${APP_URL:-}"
  case "$_url" in
    https://*|http://*)
      if command -v curl >/dev/null 2>&1; then
        curl -fsS -m 15 -o /dev/null "$_url" || return 1
        curl -fsS -m 15 "$_url" | grep -qi "<title" || return 1
      else
        wget -qO- "$_url" 2>/dev/null | grep -qi "<title" || return 1
      fi
      ;;
    *) return 0 ;; # localhost/dev — внешний smoke неприменим
  esac
  return 0
}

if smoke; then
  if ! smoke_external; then
    warn_msg="Внутренний smoke OK, но внешний URL ${APP_URL:-?} не отвечает — проверьте Caddy/DNS/TLS (деплой НЕ откатываю, контейнер новый работает)"
    echo "  ! $warn_msg" >&2
  fi
  printf '%s\n%s\n%s\n%s %s\n' "$IMAGE_TAG_ARG" "$BRANCH" "$NEW_SHA" "$(date +%s)" "ok" >"$STATE"
  chmod 600 "$STATE"
  # prune только висячие (dangling), а не всё подряд во время соседнего деплоя
  docker image prune -f --filter "dangling=true" >/dev/null 2>&1 || true
  echo "OK ($DEPLOYED): ${APP_URL:-} | API: ${NEXT_PUBLIC_API_BASE_URL:-} | alias: ${STOREFRONT_ALIAS:-?}"
  exit 0
fi

echo "✗ Smoke не прошёл — откатываюсь (образ + git ref + state атомарно)" >&2
if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$IMAGE_TAG_ARG" ]; then
  if IMAGE_TAG="$PREV_TAG" "${COMPOSE[@]}" pull 2>/dev/null \
     || docker image inspect "$IMG_BASE:$PREV_TAG" >/dev/null 2>&1; then
    if IMAGE_TAG="$PREV_TAG" "${COMPOSE[@]}" up -d --no-build && smoke; then
      if [ -n "$PREV_SHA" ] && [ "$PREV_SHA" != unknown ]; then
        git checkout -f "$PREV_SHA" 2>/dev/null || git checkout -f "$BRANCH" 2>/dev/null || true
      fi
      printf '%s\n%s\n%s\n%s %s\n' "$PREV_TAG" "$BRANCH" "$(git rev-parse HEAD 2>/dev/null || echo unknown)" "$(date +%s)" "rolled-back" >"$STATE"
      chmod 600 "$STATE"
      echo "  Откат на $PREV_TAG выполнен — сайт работает на предыдущей версии (git+state тоже откачены)." >&2
      exit 1
    fi
  fi
  echo "  Автооткат не удался. Вручную: IMAGE_TAG=$PREV_TAG ${COMPOSE[*]} up -d" >&2
else
  echo "  Предыдущий тег неизвестен — автоотката нет. Логи: ${COMPOSE[*]} logs web" >&2
fi
exit 1
