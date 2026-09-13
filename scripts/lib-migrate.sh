# shellcheck shell=bash
# ─────────────────────────────────────────────────────────────────────────────
# Миграция Vite-витрины (server-shop-sp-ui) → Next.js (server-shop-sp-next).
# Вызывается из scripts/update.sh:
#   ./scripts/update.sh --migrate [...]          # явная миграция
#   ./scripts/update.sh                          # авто: нет .env.prod + рядом
#                                                # старая витрина → миграция
# Глобальные входы (заполняет парсер update.sh):
#   OLD_UI       — путь к старой витрине (пусто = авто-поиск рядом)
#   DRY_RUN      — 1 = показать план без действий
#   KEEP_IMAGES  — 1 = не удалять образы старой витрины
# Требования: ROOT задан, lib-github.sh загружен, VM lock уже взят update.sh.
# ─────────────────────────────────────────────────────────────────────────────

# Поиск старой витрины: явно указанный путь (с .env.prod) или соседние каталоги.
detect_old_ui() {
  if [ -n "${OLD_UI:-}" ]; then
    [ -f "$OLD_UI/.env.prod" ] && { printf '%s\n' "$OLD_UI"; return 0; }
    return 1
  fi
  local _cand
  for _cand in "$ROOT/../server-shop-sp-ui" "$ROOT/../sp-ui" "$ROOT/../server-shop-sale-ui"; do
    [ -f "$_cand/.env.prod" ] && { printf '%s\n' "$_cand"; return 0; }
  done
  return 1
}

_mig_run() { # dry-run-безопасный exec
  if [ "${DRY_RUN:-0}" -eq 1 ]; then echo "  [dry-run] $*"; else "$@"; fi
}

do_migrate() {
  local _old
  if ! _old="$(detect_old_ui)"; then
    echo "✗ Не найден каталог старой витрины с .env.prod." >&2
    echo "  Укажите: ./scripts/update.sh --migrate --old-ui /path/to/server-shop-sp-ui" >&2
    return 1
  fi
  OLD_UI="$(cd "$_old" && pwd)"

  # ── 1. Чтение env старой витрины и конвертация ───────────────────────────
  load_prod_env "$OLD_UI"
  local OLD_API="${VITE_API_BASE_URL:-}"
  local OLD_APP_URL="${VITE_APP_URL:-}"
  local OLD_MEDIA="${VITE_MEDIA_BASE_URL:-}"
  local OLD_ALIAS="${STOREFRONT_ALIAS:-}"
  local OLD_PROJECT="${COMPOSE_PROJECT_NAME:-server-shop-sp-ui}"
  local OLD_NETWORK="${SHOP_NETWORK:-server-shop_shop}"
  local OLD_DEPLOY_STRATEGY="${DEPLOY_STRATEGY:-build}"

  if [ -z "$OLD_API" ] || [ -z "$OLD_APP_URL" ]; then
    echo "✗ В $OLD_UI/.env.prod нет VITE_API_BASE_URL / VITE_APP_URL — не из чего строить конфиг." >&2
    return 1
  fi
  # Прод-алиас: из старого .env.prod; fallback — дефолт compose старой витрины.
  [ -n "$OLD_ALIAS" ] || OLD_ALIAS="${OLD_PROJECT}-storefront"

  echo "==> Старая витрина:  $OLD_UI"
  echo "==> Новая (Next.js): $ROOT"
  echo "    API:      $OLD_API"
  echo "    APP_URL:  $OLD_APP_URL"
  echo "    MEDIA:    ${OLD_MEDIA:--}"
  echo "    Сеть:     $OLD_NETWORK"
  echo "    Прод-алиас Caddy upstream: $OLD_ALIAS:80"

  # ── 2. Генерация .env.prod новой витрины (если нет) ──────────────────────
  if [ ! -f "$ROOT/.env.prod" ]; then
    echo "==> [1/4] Создаю .env.prod из старого (VITE_* → NEXT_*)…"
    if [ "${DRY_RUN:-0}" -eq 1 ]; then
      echo "  [dry-run] cat > $ROOT/.env.prod (значения выше)"
    else
      {
        echo "# Сгенерировано scripts/update.sh --migrate $(date -u +%FT%TZ) из $OLD_UI/.env.prod"
        echo "DEPLOY_STRATEGY=$OLD_DEPLOY_STRATEGY"
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
    echo "==> [1/4] .env.prod уже существует — использую его (проверьте STOREFRONT_ALIAS)."
  fi
  # Перезагружаем env новой витрины (в т.ч. если он существовал до запуска)
  load_prod_env "$ROOT"
  local NEW_ALIAS_PROD="${STOREFRONT_ALIAS:-$OLD_ALIAS}"
  [ -n "$NEW_ALIAS_PROD" ] || { echo "✗ STOREFRONT_ALIAS пуст — Caddy не знает, куда вести." >&2; return 1; }
  local NEW_ALIAS_CANARY="sp-next-canary"

  local COMPOSE_PROD=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

  # ── 3. Canary-деплой (прод-алиас ещё занят старым контейнером) ───────────
  echo "==> [2/4] Canary-деплой Next-контейнера (алиас: $NEW_ALIAS_CANARY)…"
  _mig_run env STOREFRONT_ALIAS="$NEW_ALIAS_CANARY" "${COMPOSE_PROD[@]}" up -d --build

  if [ "${DRY_RUN:-0}" -eq 0 ]; then
    echo "    Smoke canary…"
    if ! "${COMPOSE_PROD[@]}" exec -T web wget -qO- http://127.0.0.1:80/api/healthz >/dev/null \
       || ! "${COMPOSE_PROD[@]}" exec -T web wget -qO- http://127.0.0.1:80/ | grep -qi "<title"; then
      echo "✗ Canary не прошёл smoke — сайт НЕ тронут (работает старый контейнер)." >&2
      "${COMPOSE_PROD[@]}" logs web --tail 50 >&2 || true
      return 1
    fi
    echo "    Canary OK."
  fi

  # ── 4. Переключение: стоп старый → Next с прод-алиасом ───────────────────
  echo "==> [3/4] Переключение: остановка старой витрины ($OLD_PROJECT)…"
  if [ "${DRY_RUN:-0}" -eq 1 ]; then
    echo "  [dry-run] cd $OLD_UI && docker compose -f docker-compose.prod.yml --env-file .env.prod down"
  else
    if ! (cd "$OLD_UI" && docker compose -f docker-compose.prod.yml --env-file .env.prod down); then
      echo "  ! Не удалось остановить старую витрину штатно — пробую по имени проекта…"
      docker rm -f "${STOREFRONT_CONTAINER_NAME:-$OLD_PROJECT-web}" 2>/dev/null || true
    fi
  fi

  echo "==> [4/4] Запуск Next-контейнера с прод-алиасом $NEW_ALIAS_PROD…"
  _mig_run env STOREFRONT_ALIAS="$NEW_ALIAS_PROD" "${COMPOSE_PROD[@]}" up -d --no-build

  # ── 5. Внешний smoke + автовой ────────────────────────────────────────────
  if [ "${DRY_RUN:-0}" -eq 0 ]; then
    echo "==> Внешний smoke ${APP_URL:-}…"
    local _ext_ok=0 _int_ok=0
    if command -v curl >/dev/null 2>&1; then
      curl -fsS -m 20 -o /dev/null "${APP_URL:-http://localhost}" && _ext_ok=1
    else
      wget -qO- "${APP_URL:-http://localhost}" >/dev/null 2>&1 && _ext_ok=1
    fi
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
      return 1
    fi

    # .deploy-state — цель будущих откатов обычного update.sh
    printf '%s\n%s\n%s\n%s %s\n' "${IMAGE_TAG:-latest}" \
      "$(git symbolic-ref --short HEAD 2>/dev/null || echo main)" \
      "$(git rev-parse HEAD 2>/dev/null || echo unknown)" \
      "$(date +%s)" "ok" >"$ROOT/.deploy-state"
    chmod 600 "$ROOT/.deploy-state" 2>/dev/null || true
  else
    echo "==> [dry-run] Здесь был бы внешний smoke ${APP_URL:-} + автовой при провале."
  fi

  # ── 6. Очистка старых контейнеров/образов ────────────────────────────────
  echo "==> Очистка старой витрины (контейнеры уже сняты на шаге 3)…"
  if [ "${KEEP_IMAGES:-0}" -eq 1 ]; then
    echo "  --keep-images: образы старой витрины оставлены (для отката)."
  else
    echo "  ./scripts/cleanup-old-ui.sh --old-ui '$OLD_UI' --images"
    _mig_run "$ROOT/scripts/cleanup-old-ui.sh" --old-ui "$OLD_UI" --images
  fi

  echo
  echo "Готово. Дальнейшие обновления — обычным способом (CI/теги или вручную):"
  echo "  ./scripts/update.sh                # сам обновит Next-витрину"
  echo "  ./scripts/update.sh --ref-type tag --ref v1.2.3"
  echo "Откат (если понадобится):"
  echo "  cd $OLD_UI && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
  echo "  cd $ROOT   && docker compose -f docker-compose.prod.yml --env-file .env.prod down"
  echo "После 7 дней стабильной работы — архивируйте репозиторий старой витрины (Ф8 плана)."
  return 0
}
