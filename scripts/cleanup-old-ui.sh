#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ОЧИСТКА СТАРОЙ VITE-ВИТРИНЫ (server-shop-sp-ui): контейнеры, образы, кеш.
# Запускать ПОСЛЕ успешного переключения на server-shop-sp-next
# (или scripts/update.sh --migrate вызовет сам).
#
#   ./scripts/cleanup-old-ui.sh                       # только контейнеры
#   ./scripts/cleanup-old-ui.sh --images              # + образы старой витрины
#   ./scripts/cleanup-old-ui.sh --images --all-tags   # + ВСЕ теги образов из GHCR
#   ./scripts/cleanup-old-ui.sh --dry-run             # показать, что будет удалено
#   ./scripts/cleanup-old-ui.sh --old-ui /path/to/sp-ui
#
# БЕЗОПАСНОСТЬ: не трогает сеть shop (внешняя, общая с Caddy/backend),
# не делает docker system prune, удаляет только ресурсы старой витрины.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/scripts/lib-github.sh"

OLD_UI="${OLD_UI:-}"
WITH_IMAGES=0
ALL_TAGS=0
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --old-ui) OLD_UI="${2:-}"; shift 2 ;;
    --old-ui=*) OLD_UI="${1#--old-ui=}"; shift ;;
    --images) WITH_IMAGES=1; shift ;;
    --all-tags) ALL_TAGS=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$OLD_UI" ]; then
  for _cand in "$ROOT/../server-shop-sp-ui" "$ROOT/../sp-ui" "$ROOT/../server-shop-sale-ui"; do
    [ -f "$_cand/.env.prod" ] && OLD_UI="$_cand" && break
  done
fi
if [ -z "$OLD_UI" ] || [ ! -d "$OLD_UI" ]; then
  echo "✗ Каталог старой витрины не найден. Укажите: --old-ui /path/to/server-shop-sp-ui" >&2
  exit 1
fi
OLD_UI="$(cd "$OLD_UI" && pwd)"

# Имя проекта и образ — из compose старой витрины (как в update.sh)
OLD_PROJECT="$(cd "$OLD_UI" && docker compose -f docker-compose.prod.yml --env-file .env.prod config --format json 2>/dev/null | grep -o '"name":"[^"]*"' | head -n1 | cut -d'"' -f4 || true)"
[ -n "$OLD_PROJECT" ] || OLD_PROJECT="$(cd "$OLD_UI" && grep -oP 'COMPOSE_PROJECT_NAME:-\K[a-z0-9-]+' docker-compose.prod.yml | head -n1 || true)"
[ -n "$OLD_PROJECT" ] || OLD_PROJECT="server-shop-sp-ui"
OLD_IMAGE="$(cd "$OLD_UI" && docker compose -f docker-compose.prod.yml --env-file .env.prod config --format json 2>/dev/null | grep -o '"image":"[^"]*"' | head -n1 | cut -d'"' -f4 || true)"
[ -n "$OLD_IMAGE" ] || OLD_IMAGE="ghcr.io/local/server-shop-sp-ui:latest"

run() {
  if [ "$DRY_RUN" -eq 1 ]; then echo "  [dry-run] $*"; else "$@"; fi
}

echo "==> Старая витрина: $OLD_UI"
echo "    Compose project: $OLD_PROJECT"
echo "    Образ:           $OLD_IMAGE"
echo

# 1) Контейнеры (down БЕЗ -v и без внешней сети; compose down внешнюю сеть не удаляет)
echo "==> 1/3 Остановка и удаление контейнеров старой витрины…"
if [ -f "$OLD_UI/docker-compose.prod.yml" ] && [ -f "$OLD_UI/.env.prod" ]; then
  run bash -c "cd '$OLD_UI' && docker compose -f docker-compose.prod.yml --env-file .env.prod down --remove-orphans"
else
  # Fallback: по имени проекта (compose labels) и контейнеру
  run docker rm -f "${OLD_PROJECT}-web" 2>/dev/null || echo "  (контейнер ${OLD_PROJECT}-web уже отсутствует)"
fi

# Остаточные контейнеры проекта (любые сервисы/инстансы)
for _c in $(docker ps -a --filter "label=com.docker.compose.project=$OLD_PROJECT" --format '{{.Names}}' 2>/dev/null); do
  run docker rm -f "$_c"
done

# 2) Образы
if [ "$WITH_IMAGES" -eq 1 ]; then
  echo "==> 2/3 Удаление образов старой витрины…"
  _repo="$(printf '%s' "$OLD_IMAGE" | sed 's/:.*$//')"
  if [ "$ALL_TAGS" -eq 1 ]; then
    for _img in $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -F "$_repo" || true); do
      run docker image rm "$_img"
    done
  else
    # Только тег, который реально был в проде (обычно latest / из .deploy-state)
    _tag="$(sed -n '1p' "$OLD_UI/.deploy-state" 2>/dev/null || true)"
    case "$_tag" in ''|*[!A-Za-z0-9._-]*) _tag='latest' ;; esac
    if docker image inspect "$_repo:$_tag" >/dev/null 2>&1; then
      run docker image rm "$_repo:$_tag"
    fi
    # Висячие слои от пересборок старой витрины
    run docker image prune -f --filter "dangling=true"
  fi
else
  echo "==> 2/3 Образы НЕ трогаю (добавьте --images)."
fi

# 3) Билд-кеш проекта (builder старой витрины больше не нужен)
echo "==> 3/3 Очистка билд-кеша compose-проекта…"
run docker builder prune -f --filter "type=regular" -- >/dev/null 2>&1 || true

echo
echo "✓ Очистка завершена."
echo "  Полный откат после --images невозможен локально: образ придётся пересобрать"
echo "  (cd $OLD_UI && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build)"
echo "  или вытянуть из GHCR: $OLD_IMAGE"
