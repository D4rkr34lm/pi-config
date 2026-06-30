#!/usr/bin/env bash
set -euo pipefail

cd /workspace

compute_npm_state() {
  {
    node --version
    npm --version
    find . -path './node_modules' -prune -o -name package.json -type f -print0 \
      | sort -z \
      | xargs -0 sha256sum
    sha256sum package-lock.json 2>/dev/null || true
  } | sha256sum | cut -d' ' -f1
}

if [ -f package.json ]; then
  mkdir -p /workspace/node_modules
  state_file="/workspace/node_modules/.pi-npm-state"
  current_state="$(compute_npm_state)"

  if [ ! -f "$state_file" ] || [ "$(cat "$state_file")" != "$current_state" ]; then
    echo "Preparing npm dependencies for ${PI_WORKSPACE_ID:-/workspace}..."

    if [ -f package-lock.json ]; then
      npm ci
    else
      npm install
    fi

    compute_npm_state > "$state_file"
  fi
fi

exec pi "$@"
