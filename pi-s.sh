#!/usr/bin/env bash
set -euo pipefail

workspace_posix="$PWD"
workspace_mount="$workspace_posix"
config_dir="$HOME/.pi/agent"

if [[ "$workspace_posix" == "$HOME" ]]; then
  workspace_pretty="~"
elif [[ "$workspace_posix" == "$HOME/"* ]]; then
  workspace_pretty="~/${workspace_posix#$HOME/}"
else
  workspace_pretty="$workspace_posix"
fi

workspace_hash="$(printf '%s' "$workspace_pretty" | sha256sum | cut -c1-16)"
node_modules_volume="pi_npm_node_modules_${workspace_hash}"

# Git Bash/MSYS rewrites container paths like /workspace unless disabled.
# Use Windows-style source paths there so Docker receives the bind mounts cleanly.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    export MSYS_NO_PATHCONV=1
    workspace_mount="$(pwd -W)"
    config_dir="$(cygpath -w "$config_dir")"
    ;;
esac

docker run --rm -it \
  -v "$workspace_mount:/workspace" \
  -v "$config_dir:/root/.pi/agent" \
  --mount "type=volume,source=$node_modules_volume,target=/workspace/node_modules,volume-nocopy" \
  -e "PI_WORKSPACE_ID=$workspace_pretty" \
  -e "PI_WORKSPACE_NODE_MODULES_VOLUME=$node_modules_volume" \
  pi-sandbox "$@"
