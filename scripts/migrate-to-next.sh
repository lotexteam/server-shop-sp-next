#!/usr/bin/env bash
# Compat-обёртка: миграция интегрирована в scripts/update.sh.
#   ./scripts/update.sh --migrate [--old-ui <path>] [--dry-run] [--keep-images]
# Все параметры пробрасываются как есть.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/update.sh" --migrate "$@"
