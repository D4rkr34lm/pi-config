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

# Detect package roots whose node_modules directories must be sandbox-local.
# The host workspace is still bind-mounted, but every detected node_modules path
# is masked by a Docker volume so host dependencies are never copied into or
# mutated by the sandbox.
detect_node_module_roots() {
  if command -v node >/dev/null 2>&1; then
    node <<'NODE'
const fs = require("fs");
const path = require("path");

const cwd = process.cwd();

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function normalizeRel(value) {
  var normalized = path.normalize(value || ".");
  return normalized === "." ? "." : toPosix(normalized).replace(/^\.\//, "").replace(/\/$/, "");
}

function hasPackageJson(rel) {
  return fs.existsSync(path.join(cwd, rel, "package.json"));
}

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, rel), "utf8"));
  } catch (_) {
    return undefined;
  }
}

function splitBraceOptions(value) {
  var parts = [""];
  var depth = 0;
  for (var index = 0; index < value.length; index += 1) {
    var char = value[index];
    if (char === "," && depth === 0) {
      parts.push("");
    } else {
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      parts[parts.length - 1] += char;
    }
  }
  return parts;
}

function findClosingBrace(pattern, start) {
  var depth = 0;
  for (var index = start + 1; index < pattern.length; index += 1) {
    var char = pattern[index];
    if (char === "{") depth += 1;
    if (char === "}" && depth > 0) depth -= 1;
    else if (char === "}" && depth === 0) return index;
  }
  return -1;
}

function expandBraces(pattern) {
  var start = pattern.indexOf("{");
  if (start < 0) return [pattern];
  var close = findClosingBrace(pattern, start);
  if (close < 0) return [pattern];
  var before = pattern.slice(0, start);
  var after = pattern.slice(close + 1);
  var options = splitBraceOptions(pattern.slice(start + 1, close));
  return options.reduce(function (expanded, part) {
    return expanded.concat(expandBraces(before + part + after));
  }, []);
}

function globToRegExp(pattern) {
  var source = "";
  for (var index = 0; index < pattern.length; index += 1) {
    var char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*" && pattern[index + 2] === "/") {
      source += "(?:.*/)?";
      index += 2;
    } else if (char === "*" && pattern[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else if ("\^$+?.()|[]{}".indexOf(char) >= 0) {
      source += "\\" + char;
    } else {
      source += char;
    }
  }
  return new RegExp("^" + source + "$");
}

function workspacePatternsFromPnpm() {
  var file = path.join(cwd, "pnpm-workspace.yaml");
  if (!fs.existsSync(file)) return [];

  var patterns = [];
  var inPackages = false;
  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(function (rawLine) {
    var line = rawLine.replace(/\s+#.*$/, "");
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      return;
    }
    if (inPackages && /^\S/.test(line) && !/^packages\s*:/.test(line)) {
      inPackages = false;
      return;
    }
    var match = inPackages ? line.match(/^\s*-\s*["']?([^"'#]+)["']?\s*$/) : undefined;
    if (match) patterns.push(match[1].trim());
  });
  return patterns;
}

function listDirectories() {
  var results = [];
  function walk(absoluteDir, rel) {
    results.push(rel);
    var children;
    try {
      children = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    children
      .filter(function (entry) { return entry.isDirectory(); })
      .filter(function (entry) { return entry.name !== ".git" && entry.name !== "node_modules"; })
      .forEach(function (entry) {
        var childRel = rel === "." ? entry.name : path.posix.join(rel, entry.name);
        walk(path.join(absoluteDir, entry.name), childRel);
      });
  }
  walk(cwd, ".");
  return results;
}

function existingNodeModuleParents() {
  var results = [];
  function walk(absoluteDir, rel) {
    var children;
    try {
      children = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    children.forEach(function (entry) {
      if (!entry.isDirectory() || entry.name === ".git") return;
      var childRel = rel === "." ? entry.name : path.posix.join(rel, entry.name);
      if (entry.name === "node_modules") {
        results.push(rel);
      } else {
        walk(path.join(absoluteDir, entry.name), childRel);
      }
    });
  }
  walk(cwd, ".");
  return results;
}

var packageJson = readJson("package.json") || {};
var lernaJson = readJson("lerna.json") || {};
var workspacePatterns = [];
if (Array.isArray(packageJson.workspaces)) workspacePatterns = workspacePatterns.concat(packageJson.workspaces);
if (packageJson.workspaces && Array.isArray(packageJson.workspaces.packages)) {
  workspacePatterns = workspacePatterns.concat(packageJson.workspaces.packages);
}
workspacePatterns = workspacePatterns.concat(workspacePatternsFromPnpm());
if (Array.isArray(lernaJson.packages)) workspacePatterns = workspacePatterns.concat(lernaJson.packages);
workspacePatterns = workspacePatterns.filter(function (pattern) {
  return typeof pattern === "string" && pattern.trim() && pattern.trim()[0] !== "!";
});

var directories = listDirectories();
var workspaceRoots = workspacePatterns.reduce(function (roots, pattern) {
  var expandedPatterns = expandBraces(normalizeRel(pattern));
  return roots.concat(expandedPatterns.reduce(function (matches, expandedPattern) {
    var regex = globToRegExp(expandedPattern);
    return matches.concat(directories.filter(function (rel) {
      return regex.test(rel) && hasPackageJson(rel);
    }));
  }, []));
}, []);

var rootSet = Object.create(null);
function addRoot(root) {
  rootSet[root] = true;
}
if (hasPackageJson(".")) addRoot(".");
workspaceRoots.forEach(addRoot);
existingNodeModuleParents().forEach(addRoot);

var roots = Object.keys(rootSet).sort(function (left, right) {
  if (left === ".") return -1;
  if (right === ".") return 1;
  return left.localeCompare(right);
});

process.stdout.write(roots.join("\n") + (roots.length ? "\n" : ""));
NODE
  else
    if [[ -f package.json ]]; then
      printf '.\n'
    fi
    find . -type d -name node_modules -prune -print 2>/dev/null \
      | sed -e 's#/node_modules$##' -e 's#^\./$#.#' -e 's#^\./##'
  fi
}

node_modules_volume_for_root() {
  local root="$1"
  if [[ "$root" == "." ]]; then
    printf 'pi_npm_node_modules_%s' "$workspace_hash"
  else
    local root_hash
    root_hash="$(printf '%s' "$workspace_pretty:$root" | sha256sum | cut -c1-16)"
    printf 'pi_npm_node_modules_%s_%s' "$workspace_hash" "$root_hash"
  fi
}

node_modules_target_for_root() {
  local root="$1"
  if [[ "$root" == "." ]]; then
    printf '/workspace/node_modules'
  else
    printf '/workspace/%s/node_modules' "$root"
  fi
}

mapfile -t node_module_roots < <(detect_node_module_roots | awk 'NF' | sort -u)

# Git Bash/MSYS rewrites container paths like /workspace unless disabled.
# Use Windows-style source paths there so Docker receives the bind mounts cleanly.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    export MSYS_NO_PATHCONV=1
    workspace_mount="$(pwd -W)"
    config_dir="$(cygpath -w "$config_dir")"
    ;;
esac

docker_args=(
  -v "$workspace_mount:/workspace"
  -v "$config_dir:/root/.pi/agent"
)

mount_summary=()
for root in "${node_module_roots[@]}"; do
  volume="$(node_modules_volume_for_root "$root")"
  target="$(node_modules_target_for_root "$root")"
  docker_args+=(--mount "type=volume,source=$volume,target=$target,volume-nocopy")
  mount_summary+=("$root=$volume")
done

root_node_modules_volume="$(node_modules_volume_for_root .)"

docker run --rm -it \
  "${docker_args[@]}" \
  -e "PI_WORKSPACE_ID=$workspace_pretty" \
  -e "PI_WORKSPACE_NODE_MODULES_VOLUME=$root_node_modules_volume" \
  -e "PI_WORKSPACE_NODE_MODULES_MOUNTS=${mount_summary[*]}" \
  pi-sandbox "$@"
