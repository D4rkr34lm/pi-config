#!/usr/bin/env bash
set -euo pipefail

workspace="$PWD"
config_dir="$HOME/.pi/agent"

# Git Bash/MSYS rewrites container paths like /workspace unless disabled.
# Use Windows-style source paths there so Docker receives the bind mounts cleanly.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    export MSYS_NO_PATHCONV=1
    workspace="$(pwd -W)"
    config_dir="$(cygpath -w "$config_dir")"
    ;;
esac

docker run --rm -it \
  -v "$workspace:/workspace" \
  -v "$config_dir:/root/.pi/agent" \
  pi-sandbox "$@"