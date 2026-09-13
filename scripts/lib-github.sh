# shellcheck shell=bash
# Этап 1: безопасная загрузка без исполнения .env как shell-код
_dotenv_load_safe() {
  _f="$1"
  [ -f "$_f" ] || return 1
  chmod 600 "$_f" 2>/dev/null || true
  while IFS= read -r _line || [ -n "$_line" ]; do
    _t="$(printf '%s' "$_line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    case "$_t" in ''|'#'*) continue ;; esac
    case "$_t" in export\ *|export\	*) _t="$(printf '%s' "$_t" | sed -e 's/^export[[:space:]][[:space:]]*//')" ;; esac
    _k="$(printf '%s' "$_t" | sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)[[:space:]]*=.*/\1/p')"
    [ -n "$_k" ] || continue
    _raw="$(printf '%s' "$_t" | sed -e "s/^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*//")"
    case "$_raw" in
      \"*\") _val="$(printf '%s' "$_raw" | sed -e 's/^"//' -e 's/"[[:space:]]*\(#.*\)\?$//' -e 's/"$//')" ;;
      \'*\') _val="$(printf '%s' "$_raw" | sed -e "s/^'//" -e "s/'[[:space:]]*\(#.*\)\?\$//" -e "s/'\$//")" ;;
      *) _val="$(printf '%s' "$_raw" | sed -e 's/[[:space:]][[:space:]]*#[^$]*$//' -e 's/[[:space:]]*$//')" ;;
    esac
    printf -v "$_k" '%s' "$_val"
    export "$_k"
  done <"$_f"
}
load_prod_env() {
  local root="${1:-.}"
  if [ -f "$root/.env.prod" ]; then
    _dotenv_load_safe "$root/.env.prod"
  fi
}

require_gh_token() {
  if [ -z "${GH_TOKEN:-}" ]; then
    echo "Set GH_TOKEN in .env.prod (or export it)." >&2
    return 1
  fi
}

github_docker_login() {
  require_gh_token || return 1
  local user="${GH_USERNAME:-${GH_OWNER:-}}"
  [ -n "$user" ] || { echo "Set GH_USERNAME"; return 1; }
  echo "$GH_TOKEN" | docker login ghcr.io -u "$user" --password-stdin >/dev/null
}

# Fast-forward. Stash tracked local edits (do not reapply — update = GitHub).
# Ignored files (.env, .env.prod) stay on disk.
github_git_fetch_and_pull() {
  local dir="${1:-.}"
  local branch
  branch="$(git -C "$dir" rev-parse --abbrev-ref HEAD)"
  if [ "$branch" = HEAD ]; then
    echo "  Detached HEAD в $dir — не могу pull." >&2
    return 1
  fi
  require_gh_token || return 1
  local auth_args=(-c "http.extraHeader=Authorization: Basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')")
  git -C "$dir" "${auth_args[@]}" fetch origin "$branch"
  if ! git -C "$dir" diff --quiet || ! git -C "$dir" diff --cached --quiet; then
    echo "  Локальные правки tracked-файлов мешают pull:"
    git -C "$dir" status --short --untracked-files=no
    git -C "$dir" stash push -m "update.sh $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "  Убрано в stash. Код берём с GitHub. .env / .env.prod не трогаем."
  fi
  git -C "$dir" "${auth_args[@]}" merge --ff-only "origin/${branch}"
}

github_git_pull() {
  github_git_fetch_and_pull "."
}

# Тег-деплой: checkout точного тега (update.sh --ref-type tag).
# HEAD остаётся detached — ветку восстанавливает update.sh при следующем branch-деплое.
github_checkout_tag() {
  local tag="${1:-}"
  [ -n "$tag" ] || { echo "  Не указан тег" >&2; return 1; }
  require_gh_token || return 1
  local auth_args=(-c "http.extraHeader=Authorization: Basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')")
  git "${auth_args[@]}" fetch --no-tags origin "refs/tags/${tag}:refs/tags/${tag}"
  git checkout -f "${tag}"
}
