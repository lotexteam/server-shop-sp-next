#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# МИГРАЦИЯ НА NEXT.JS В ОДИН КЛИК: server-shop-sp-ui → server-shop-sp-next
# ─────────────────────────────────────────────────────────────────────────────
# Что делает:
#   1. Читает .env.prod СТАРОЙ витрины и конвертирует VITE_* → NEXT_*
#      (создаёт .env.prod здесь, если ещё нет).
#   2. Деплой Next-контейнера под canary-алиасом (сайт продолжает работать
#      на старом контейнере) + smoke.
#   3. ПЕРЕКЛЮЧЕНИЕ: останавливает старый контейнер → пересоздаёт Next
#      контейнер с прод-алиасом (Caddy upstream меняется сам, Caddyfile
#      НЕ трогаем: Next слушает :80, как nginx старой витрины).
#   4. Внешний smoke по APP_URL. При провале — автовой старой витрины.
#
# Использование (на сервере, в каталоге server-shop-sp-next):
#   ./scripts/migrate-to-next.sh                  # миграция + очистка контейнеров
#   ./scripts/migrate-to-next.sh --old-ui ../server-shop-sp-ui
#   ./scripts/migrate-to-next.sh --dry-run        # показать план без действий
#   ./scripts/migrate-to-next.sh --keep-images    # не удалять образы старой витрины
#
# Откат вручную (после миграции):
#   cd <old-ui> && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
#   cd <sp-next> && docker compose -f docker-compose.prod.yml --env-file .env.prod down
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
. "$ROOT/scripts/lib-github.sh"
cd "$ROOT"

OLD_UI="${OLD_UI:-}"
DRY_RUN=0
KEEP_IMAGES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --old-ui) OLD_UI="${2:-}"; shift 2 ;;
    --old-ui=*) OLD_UI="${1#--old-ui=}"; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --keep-images) KEEP_IMAGES=1; shift ;;
    --help|-h) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

# ── Поиск старой витрины ────────────────────────────────────────────────────
if [ -z "$OLD_UI" ]; then
  for _cand in "$ROOT/../server-shop-sp-ui" "$ROOT/../sp-ui" "$ROOT/../server-shop-sale-ui"; do
    [ -f "$_cand/.env.prod" ] && OLD_UI="$_cand" && break
  done
fi
if [ -z "$OLD_UI" ] || [ ! -f "$OLD_UI/.env.prod" ]; then
  echo "✗ Не найден каталог старой витрины с .env.prod." >&2
  echo "  Укажите: ./scripts/migrate-to-next.sh --old-ui /path/to/server-shop-sp-ui" >&2
  exit 1
fi
OLD_UI="$(cd "$OLD_UI" && pwd)"
echo "==> Старая витрина: $OLD_UI"
echo "==> Новая (Next.js): $ROOT"

run() { # dry-run-безопасный exec
  if [ "$DRY_RUN" -eq 1 ]; then echo "  [dry-run] $*"; else "$@"; fi
}

# ── 1. Чтение env старой витрины и конвертация ─────────────────────────────
load_prod_env "$OLD_UI"
OLD_API="${VITE_API_BASE_URL:-}"
OLD_APP_URL="${VITE_APP_URL:-}"
OLD_MEDIA="${VITE_MEDIA_BASE_URL:-}"
OLD_ALIAS="${STOREFRONT_ALIAS:-}"
OLD_PROJECT="${COMPOSE_PROJECT_NAME:-server-shop-sp-ui}"
OLD_NETWORK="${SHOP_NETWORK:-server-shop_shop}"

if [ -z "$OLD_API" ] || [ -z "$OLD_APP_URL" ]; then
  echo "✗ В $OLD_UI/.env.prod нет VITE_API_BASE_URL / VITE_APP_URL — не из чего строить конфиг." >&2
  exit 1
fi
# Прод-алиас: из старого .env.prod; fallback — дефолт compose старой витрины.
[ -n "$OLD_ALIAS" ] || OLD_ALIAS="${OLD_PROJECT}-storefront"
echo "==> Прод-алиас Caddy upstream: $OLD_ALIAS:80"

echo "    API:      $OLD_API"
echo "    APP_URL:  $OLD_APP_URL"
echo "    MEDIA:    ${OLD_MEDIA:-—}"
echo "    Сеть:     $OLD_NETWORK"

# ── 2. Генерация .env.prod новой витрины (если нет) ─────────────────────────
if [ ! -f "$ROOT/.env.prod" ]; then
  echo "==> Создаю .env.prod из старого (VITE_* → NEXT_*)…"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [dry-run] cat > $ROOT/.env.prod (конвертация значений выше)"
  else
    {
      echo "# Сгенерировано scripts/migrate-to-next.sh $(date -u +%FT%TZ) из $OLD_UI/.env.prod"
      echo "DEPLOY_STRATEGY=${DEPLOY_STRATEGY:-build}"
      echo "GH_TOKEN=${GH_TOKEN:-}"
      echo "GH_USERNAME=${GH_USERNAME:-}"
      echo "GH_OWNER=${GH_OWNER:-}"
      echo "GH_REPO=server-shop-sp-next"
      echo "GITHUB_REPOSITORY_OWNER=${GITHUB_REPOSITORY_OWNER:-${GH_OWNER:-}}"
      echo "IMAGE_TAG=${IMAGE_TAG:-latest}"
      echo
      echo "# Baked into the client bundle at build time"
      echo "NEXT_PUBLIC_API_BASE_URL=$OLD_API"
      echo "NEXT_PUBLIC_MEDIA_BASE_URL=$OLD_MEDIA"
      echo "API_BASE_URL=$OLD_API"
      echo "APP_URL=$OLD_APP_URL"
      echo
      echo "# Migration switch"
      echo "STOREFRONT_ALIAS=$OLD_ALIAS"
      echo "SHOP_NETWORK=$OLD_NETWORK"
      echo "STOREFRONT_CONTAINER_NAME=server-shop-sp-next-web"
      echo "COMPOSE_PROJECT_NAME=server-shop-sp-next"
      echo "CONTAINER_PORT=80"
      echo "UI_PUBLISH=3100"
    } >"$ROOT/.env.prod"
    chmod 600 "$ROOT/.env.prod"
    echo "    OK: $ROOT/.env.prod"
  fi
else
  echo "==> .env.prod уже существует — использую его (проверьте STOREFRONT_ALIAS)."
fi
# Перезагружаем env новой витрины (если существовал до запуска)
load_prod_env "$ROOT"
NEW_ALIAS_PROD="${STOREFRONT_ALIAS:-$OLD_ALIAS}"
[ -n "$NEW_ALIAS_PROD" ] || { echo "✗ STOREFRONT_ALIAS пуст — Caddy не знает, куда вести." >&2; exit 1; }
NEW_ALIAS_CANARY="sp-next-canary"

COMPOSE_PROD=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

# ── 3. Canary-деплой (прод-алиас ещё занят старым контейнером) ─────────────
echo "==> [1/4] Canary-деплой Next-контейнера (алиас: $NEW_ALIAS_CANARY)…"
run env STOREFRONT_ALIAS="$NEW_ALIAS_CANARY" "${COMPOSE_PROD[@]}" up -d --build

if [ "$DRY_RUN" -eq 0 ]; then
  echo "    Smoke canary…"
  if ! "${COMPOSE_PROD[@]}" exec -T web wget -qO- http://127.0.0.1:80/api/healthz >/dev/null \
     || ! "${COMPOSE_PROD[@]}" exec -T web wget -qO- http://127.0.0.1:80/ | grep -qi "<title"; then
    echo "✗ Canary не прошёл smoke — сайт НЕ тронут (работает старый контейнер)." >&2
    "${COMPOSE_PROD[@]}" logs web --tail 50 >&2 || true
    exit 1
  fi
  echo "    Canary OK."
fi

# ── 4. Переключение: стоп старый → Next с прод-алиасом ─────────────────────
echo "==> [2/4] Переключение: остановка старой витрины ($OLD_PROJECT)…"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  [dry-run] cd $OLD_UI && docker compose -f docker-compose.prod.yml --env-file .env.prod down"
else
  if ! (cd "$OLD_UI" && docker compose -f docker-compose.prod.yml --env-file .env.prod down); then
    echo "  ! Не удалось остановить старую витрину штатно — пробую по имени проекта…"
    docker rm -f "${STOREFRONT_CONTAINER_NAME:-$OLD_PROJECT-web}" 2>/dev/null || true
  fi
fi

echo "==> [3/4] Запуск Next-контейнера с прод-алиасом $NEW_ALIAS_PROD…"
run env STOREFRONT_ALIAS="$NEW_ALIAS_PROD" "${COMPOSE_PROD[@]}" up -d --no-build

# ── 5. Внешний smoke + автовой ──────────────────────────────────────────────
if [ "$DRY_RUN" -eq 0 ]; then
  echo "==> [4/4] Внешний smoke ${APP_URL:-}…"
  _ext_ok=0
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 20 -o /dev/null "${APP_URL:-http://localhost}" && _ext_ok=1
  else
    wget -qO- "${APP_URL:-http://localhost}" >/dev/null 2>&1 && _ext_ok=1
  fi
  # Внутренний тоже перепроверяем на новом алиасе
  _int_ok=0
  "${COMPOSE_PROD[@]}" exec -T web wget -qO- http://127.0.0.1:80/api/healthz >/dev/null 2>&1 && _int_ok=1

  if [ "$_int_ok" -eq 1 ] && [ "$_ext_ok" -eq 1 ]; then
    echo "✓ МИГРАЦИЯ ЗАВЕРШЕНА: ${APP_URL:-} обслуживает Next.js (${NEW_ALIAS_PROD})."
  elif [ "$_int_ok" -eq 1 ]; then
    echo "! Контейнер Next работает (внутренний smoke OK), но внешний URL не отвечает."
    echo "  Проверьте Caddy/DNS. Отката НЕ делаю (новый контейнер жив)."
    echo "  Логи: ${COMPOSE_PROD[*]} logs web"
  else
    echo "✗ Новый контейнер не прошёл smoke — АВТООТКАТ на старую витрину…" >&2
    "${COMPOSE_PROD[@]}" down || true
    (cd "$OLD_UI" && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-build) \
      || (cd "$OLD_UI" && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build)
    echo "  Старая витрина поднята обратно. Диагностика: ${COMPOSE_PROD[*]} logs web" >&2
    exit 1
  fi
else
  echo "==> [dry-run] Здесь был бы внешний smoke ${APP_URL:-} + автовой при провале."
fi

# ── 6. Очистка старых контейнеров/образов ───────────────────────────────────
echo "==> Очистка старой витрины (контейнеры уже сняты на шаге 2)…"
if [ "$KEEP_IMAGES" -eq 1 ]; then
  echo "  --keep-images: образы старой витрины оставлены (для отката)."
else
  echo "  ./scripts/cleanup-old-ui.sh --old-ui '$OLD_UI' --images"
  run "$ROOT/scripts/cleanup-old-ui.sh" --old-ui "$OLD_UI" --images
fi

echo
echo "Готово. Откат (если понадобится):"
echo "  cd $OLD_UI && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
echo "  cd $ROOT   && docker compose -f docker-compose.prod.yml --env-file .env.prod down"
echo "После 7 дней стабильной работы — архивируйте репозиторий старой витрины (Ф8 плана)."
