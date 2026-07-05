#!/usr/bin/env bash
set -euo pipefail

cd /workspace

mise_bin="/root/.local/bin"
mise_shims="${MISE_DATA_DIR:-/root/.local/share/mise}/shims"
stable_node_version="${PI_STABLE_NODE_VERSION:-26.4.0}"
stable_node_root="$(mise where "node@$stable_node_version")"
stable_path="$stable_node_root/bin:$mise_bin:$mise_shims:$PATH"
project_env_file="/tmp/pi-project-env.sh"
project_paths=("$mise_bin" "$mise_shims")

export MISE_DATA_DIR="${MISE_DATA_DIR:-/root/.local/share/mise}"
export MISE_CACHE_DIR="${MISE_CACHE_DIR:-/root/.cache/mise}"
export MISE_YES=1
export PATH="$stable_path"

write_project_env() {
  local joined_path
  joined_path="$(IFS=:; printf '%s' "${project_paths[*]}")"

  {
    printf 'export MISE_DATA_DIR=%q\n' "$MISE_DATA_DIR"
    printf 'export MISE_CACHE_DIR=%q\n' "$MISE_CACHE_DIR"
    printf 'export MISE_YES=1\n'
    printf 'export PATH='
    printf '%q' "$joined_path"
    printf ':$PATH\n'
  } > "$project_env_file"
}

prepend_project_path() {
  local path_to_add="$1"

  if [ -n "$path_to_add" ] && [ -d "$path_to_add" ]; then
    project_paths=("$path_to_add" "${project_paths[@]}")
    write_project_env
    # shellcheck source=/tmp/pi-project-env.sh
    source "$project_env_file"
  fi
}

normalize_version_spec() {
  sed -e 's/#.*$//' -e 's/^\s*//' -e 's/\s*$//' -e 's/^v//' -e 's#^lts/\*#lts#'
}

first_existing_version_file() {
  local file

  for file in .node-version .nvmrc; do
    if [ -f "$file" ]; then
      normalize_version_spec < "$file" | head -n 1
      return
    fi
  done
}

node_spec_from_tool_versions() {
  if [ ! -f .tool-versions ]; then
    return
  fi

  awk '$1 == "node" || $1 == "nodejs" { print $2; exit }' .tool-versions | normalize_version_spec
}

node_spec_from_package_json() {
  if [ ! -f package.json ]; then
    return
  fi

  node <<'NODE'
const fs = require("fs");
try {
  const value = JSON.parse(fs.readFileSync("package.json", "utf8")).engines?.node;
  const match = typeof value === "string" ? value.match(/(?:^|[<>=~^\s])v?(\d+(?:\.\d+){0,2})/) : undefined;
  if (match) process.stdout.write(match[1]);
} catch {}
NODE
}

package_manager_spec_from_package_json() {
  if [ ! -f package.json ]; then
    return
  fi

  node <<'NODE'
const fs = require("fs");
try {
  const value = JSON.parse(fs.readFileSync("package.json", "utf8")).packageManager;
  if (typeof value === "string" && value.trim()) process.stdout.write(value.trim());
} catch {}
NODE
}

package_manager_from_spec() {
  local spec="$1"
  printf '%s\n' "${spec%@*}"
}

package_manager_version_from_spec() {
  local spec="$1"

  if [[ "$spec" == *@* ]]; then
    local version="${spec##*@}"
    printf '%s\n' "${version%%+*}"
  fi
}

detect_node_spec() {
  local spec

  spec="$(node_spec_from_tool_versions)"
  if [ -n "$spec" ]; then
    printf '%s\n' "$spec"
    return
  fi

  spec="$(first_existing_version_file)"
  if [ -n "$spec" ]; then
    printf '%s\n' "$spec"
    return
  fi

  spec="$(node_spec_from_package_json)"
  if [ -n "$spec" ]; then
    printf '%s\n' "$spec"
  fi
}

trust_mise_config() {
  [ -f mise.toml ] && mise trust mise.toml >/dev/null 2>&1 || true
  [ -f .mise.toml ] && mise trust .mise.toml >/dev/null 2>&1 || true
}

configured_mise_node_root() {
  trust_mise_config
  mise install >/dev/null 2>&1 || true
  mise where node 2>/dev/null || true
}

install_node_runtime() {
  local node_spec="$1"
  local node_root=""

  node_root="$(configured_mise_node_root)"
  if [ -z "$node_root" ] && [ -n "$node_spec" ]; then
    if mise install "node@$node_spec"; then
      node_root="$(mise where "node@$node_spec")"
    else
      echo "Could not install Node '$node_spec'; falling back to Pi's stable Node $stable_node_version." >&2
    fi
  fi

  if [ -n "$node_root" ]; then
    prepend_project_path "$node_root/bin"
  else
    prepend_project_path "$stable_node_root/bin"
  fi
}

install_bun_runtime() {
  local bun_version="$1"
  local bun_tool="bun@${bun_version:-latest}"
  local bun_root

  if command -v bun >/dev/null 2>&1; then
    return
  fi

  if mise install "$bun_tool"; then
    bun_root="$(mise where "$bun_tool")"
    prepend_project_path "$bun_root/bin"
  else
    echo "bun is required for this workspace but could not be installed by mise." >&2
    exit 1
  fi
}

detect_package_manager() {
  local declared declared_manager
  declared="$(package_manager_spec_from_package_json)"
  declared_manager="$(package_manager_from_spec "$declared")"

  case "$declared_manager" in
    npm|pnpm|yarn|bun)
      printf '%s\n' "$declared_manager"
      return
      ;;
  esac

  if [ -f pnpm-lock.yaml ]; then
    printf 'pnpm\n'
  elif [ -f yarn.lock ]; then
    printf 'yarn\n'
  elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    printf 'npm\n'
  elif [ -f bun.lock ] || [ -f bun.lockb ]; then
    printf 'bun\n'
  else
    printf 'npm\n'
  fi
}

ensure_package_manager() {
  local manager="$1"
  local declared version
  declared="$(package_manager_spec_from_package_json)"
  version="$(package_manager_version_from_spec "$declared")"

  case "$manager" in
    npm)
      command -v npm >/dev/null 2>&1 || {
        echo "npm is required in the project Node runtime but was not found." >&2
        exit 1
      }
      if [ -n "$version" ] && [ "$(npm --version 2>/dev/null || true)" != "$version" ]; then
        npm install -g "npm@$version"
      fi
      ;;
    pnpm|yarn)
      if ! command -v corepack >/dev/null 2>&1; then
        npm install -g corepack
      fi
      corepack enable
      if [ -n "$version" ]; then
        corepack prepare "$manager@$version" --activate
      elif ! command -v "$manager" >/dev/null 2>&1; then
        npm install -g "$manager"
      fi
      command -v "$manager" >/dev/null 2>&1 || {
        echo "$manager is required for this workspace but was not found after setup." >&2
        exit 1
      }
      ;;
    bun)
      install_bun_runtime "$version"
      command -v bun >/dev/null 2>&1 || {
        echo "bun is required for this workspace but was not found after setup." >&2
        exit 1
      }
      ;;
  esac
}

package_manager_version() {
  local manager="$1"
  "$manager" --version 2>/dev/null || true
}

compute_dependency_state() {
  local manager="$1"

  {
    node --version 2>/dev/null || true
    printf 'package-manager=%s\n' "$manager"
    printf 'package-manager-version=%s\n' "$(package_manager_version "$manager")"
    find . \
      -path './node_modules' -prune -o \
      -path '*/node_modules' -prune -o \
      -path './.git' -prune -o \
      \( \
        -name package.json -o \
        -name package-lock.json -o \
        -name npm-shrinkwrap.json -o \
        -name pnpm-lock.yaml -o \
        -name pnpm-workspace.yaml -o \
        -name yarn.lock -o \
        -name .yarnrc.yml -o \
        -name bun.lock -o \
        -name bun.lockb -o \
        -name lerna.json -o \
        -name .npmrc -o \
        -name .nvmrc -o \
        -name .node-version -o \
        -name .tool-versions -o \
        -name .mise.toml -o \
        -name mise.toml \
      \) -type f -print0 \
      | sort -z \
      | xargs -0 --no-run-if-empty sha256sum
  } | sha256sum | cut -d' ' -f1
}

clear_dependency_volumes() {
  local mount root dir

  if [ -z "${PI_WORKSPACE_NODE_MODULES_MOUNTS:-}" ]; then
    return
  fi

  for mount in ${PI_WORKSPACE_NODE_MODULES_MOUNTS}; do
    root="${mount%%=*}"
    if [ "$root" = "." ]; then
      dir="/workspace/node_modules"
    else
      dir="/workspace/$root/node_modules"
    fi

    if [ -d "$dir" ]; then
      find "$dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    fi
  done
}

install_dependencies() {
  local manager="$1"

  case "$manager" in
    npm)
      if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
        npm ci
      else
        npm install
      fi
      ;;
    pnpm)
      if [ -f pnpm-lock.yaml ]; then
        pnpm install --frozen-lockfile
      else
        pnpm install
      fi
      ;;
    yarn)
      if [ -f yarn.lock ] && [ -f .yarnrc.yml ]; then
        yarn install --immutable
      elif [ -f yarn.lock ]; then
        yarn install --frozen-lockfile
      else
        yarn install
      fi
      ;;
    bun)
      if [ -f bun.lock ] || [ -f bun.lockb ]; then
        bun install --frozen-lockfile
      else
        bun install
      fi
      ;;
  esac
}

write_project_env
install_node_runtime "$(detect_node_spec)"
# shellcheck source=/tmp/pi-project-env.sh
source "$project_env_file"

if [ -f package.json ]; then
  manager="$(detect_package_manager)"
  ensure_package_manager "$manager"

  mkdir -p /workspace/node_modules
  state_file="/workspace/node_modules/.pi-sandbox-deps-state"
  current_state="$(compute_dependency_state "$manager")"

  if [ ! -f "$state_file" ] || [ "$(cat "$state_file")" != "$current_state" ]; then
    echo "Preparing $manager dependencies for ${PI_WORKSPACE_ID:-/workspace} with Node $(node --version 2>/dev/null || echo unavailable)..."

    clear_dependency_volumes
    install_dependencies "$manager"

    compute_dependency_state "$manager" > "$state_file"
  fi
fi

export BASH_ENV="$project_env_file"
export PATH="$stable_path"
exec pi "$@"
