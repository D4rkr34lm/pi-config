# Agent Tooling Roadmap

This roadmap prioritizes tools identified from the repository's session history. The goal is to reduce context usage and shell-command failures while improving correctness, workspace safety, and UI verification.

## Guiding principles

- Return compact, structured results rather than raw command output.
- Preserve access controls instead of providing alternate ways around them.
- Detect and reuse project configuration before introducing new conventions.
- Truncate large output and keep the complete result outside model context when needed.
- Support cancellation, timeouts, and useful progress reporting.
- Prefer stable feature boundaries that work across repositories.

## Phase 1 — Core correctness and efficiency

### 1. Compact diagnostics

**Priority:** Critical

Implement a diagnostics tool that runs configured project checks and reports normalized findings.

Initial support:

- TypeScript
- ESLint
- Prettier
- Vitest

Expected result shape:

```ts
interface Diagnostic {
  checker: "typescript" | "eslint" | "prettier" | "tests";
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning";
  message: string;
}
```

Required behavior:

- Detect the package manager from the repository lockfile.
- Prefer project-defined scripts and local binaries.
- Allow checks to be scoped to files or packages.
- Deduplicate repeated diagnostics.
- Distinguish source diagnostics from environment and tool-startup failures.
- Return a compact summary plus normalized findings.
- Store full output outside the model context when truncation is required.
- Support cancellation and timeouts.

Acceptance criteria:

- A normal TypeScript or lint run does not dump the complete compiler output into context.
- Findings preserve file, location, severity, and checker identity.
- An unavailable executable is reported as an environment failure, not a source error.
- The tool can run checks against only the files changed during a task.

### 2. Structured repository search

**Priority:** Critical

Provide sandbox-aware equivalents of Pi's `grep`, `find`, and `ls` tools instead of routing routine discovery through Bash.

Required behavior:

- `grep`: search text with path, glob, file-type, and context controls.
- `find`: discover files by path and glob without reading contents.
- `ls`: inspect a directory with bounded depth and useful metadata.
- Exclude dependencies, generated output, coverage, and build artifacts by default.
- Enforce workspace access rules consistently.
- Return predictable, truncated, structured output.

Acceptance criteria:

- Common repository discovery does not require shell quoting or platform-specific commands.
- Searches can be constrained before execution to avoid excessive output.
- Forbidden paths fail once with a clear access error.

### 3. Git workspace awareness

**Priority:** High

Add a read-oriented Git tool that helps the agent protect existing work and understand branch scope.

Initial operations:

- Working-tree status and changed-file summary.
- Diff for selected files or ranges.
- Base-branch and merge-base discovery.
- Branch-only changed-file listing.
- Recent commit summary when relevant.
- Separation of staged, unstaged, and untracked changes.

Required behavior:

- Default to non-mutating operations.
- Keep diffs bounded by file, hunk count, and output size.
- Identify changes that existed before the current task when session state permits.
- Require explicit user authorization for destructive operations, if mutation is supported at all.

Acceptance criteria:

- The agent can inspect relevant user changes before editing without assembling several Git commands.
- Branch reviews can reliably restrict themselves to the merge-base diff.
- Large generated or dependency diffs are summarized rather than injected into context.

## Phase 2 — UI and runtime workflows

### 4. Browser and UI inspection

**Priority:** High

Provide browser automation for visual and behavioral verification of frontend work.

Initial operations:

- Open a URL or application route.
- Capture screenshots at configurable viewport sizes.
- Inspect DOM and accessibility structure.
- Read browser console errors and failed network requests.
- Click, type, select, and submit.
- Wait for elements, navigation, or network idle.

Required behavior:

- Integrate with the managed process tool for development servers.
- Return screenshots as images rather than encoded text.
- Keep DOM snapshots focused on requested selectors or accessible regions.
- Support desktop and mobile viewport presets.
- Clearly distinguish visual observations from inferred behavior.

Acceptance criteria:

- UI changes can be checked for overflow, spacing, responsive width, and runtime errors.
- A frontend task can be verified without asking the user to describe every visual regression.
- Browser state and development-server processes are cleaned up after verification.

### 5. Managed processes

**Priority:** High

Add lifecycle management for development servers, watchers, and other long-running commands.

Initial operations:

- Start a process and return a stable process ID.
- Read incremental stdout and stderr.
- Poll readiness through output, port, or HTTP checks.
- Report process status.
- Stop the complete process tree.

Required behavior:

- Bound retained logs and expose incremental ranges.
- Propagate cancellation.
- Apply configurable startup and shutdown timeouts.
- Kill child processes rather than only the parent shell.
- Clean up processes at session shutdown.

Acceptance criteria:

- Starting a development server does not occupy a Bash tool call indefinitely.
- Timed-out processes do not leave children holding output streams or ports.
- Browser verification can wait for a server without arbitrary sleeps.

### 6. Approved Pi documentation access

**Priority:** High

Resolve the conflict between required Pi documentation and sandbox access controls with an allowlisted documentation tool.

Suggested operations:

```text
pi_docs.search
pi_docs.read
```

Required behavior:

- Access only the installed Pi README, documentation, and examples roots.
- Resolve `docs/...` and `examples/...` against their configured installation paths.
- Search headings and content before loading full documents.
- Return source paths and relevant line ranges.
- Follow Markdown references without granting generic access outside the workspace.

Acceptance criteria:

- Pi documentation tasks do not require Bash or attempts to bypass workspace restrictions.
- The tool cannot read arbitrary files adjacent to the allowlisted documentation roots.
- Referenced documents can be resolved consistently across host and sandbox environments.

## Phase 3 — Context and research support

### 7. Session query and analytics

**Priority:** Medium

Provide structured queries over Pi JSONL sessions without loading raw transcripts into context.

Initial operations:

- List sessions by project and date.
- Search user requests and assistant outcomes.
- Aggregate tool calls, failures, retries, and output sizes.
- Extract correction or follow-up patterns.
- Inspect a bounded turn range.

Required behavior:

- Exclude hidden reasoning and sensitive content from broad summaries by default.
- Return aggregates before detailed records.
- Allow project, date, role, tool, and error filters.
- Avoid treating normal failing tests as tool infrastructure failures.

Acceptance criteria:

- Questions about historical usage can be answered without ad hoc Python scripts.
- Large session collections produce bounded output.
- Metrics distinguish tool invocation errors, command failures, and expected diagnostic findings.

### 8. Web and external documentation research

**Priority:** Medium

Add controlled web search and document retrieval for external APIs, packages, and architectural research.

Required behavior:

- Search the web and return source metadata.
- Fetch readable document content with size limits.
- Prefer primary documentation and repository sources.
- Include URLs and retrieval timestamps in results.
- Respect network policy, redirects, and content-type limits.

Acceptance criteria:

- External technical claims can be tied to inspectable sources.
- Research does not depend on unstructured `curl` output.
- Large pages are searched or sectioned before being added to context.

### 9. Package and dependency information

**Priority:** Low

Provide structured information about installed dependencies and available project scripts.

Initial operations:

- Resolve installed package versions and locations.
- List package scripts and workspace packages.
- Inspect package metadata and exported entry points.
- Report lockfile/package-manager consistency.

Acceptance criteria:

- The agent can determine whether a dependency or script already exists without scanning lockfiles manually.
- No package is installed or updated through this read-only tool.

## Cross-tool infrastructure

All tools should share:

- A common workspace path resolver.
- Consistent sandbox access checks.
- Output truncation and temporary full-output storage.
- Cancellation and timeout handling.
- Machine-readable error categories.
- Source metadata suitable for custom rendering.
- File-mutation serialization where mutation is supported.
- Compact default rendering with expandable details.

Suggested error categories:

```ts
type ToolErrorCategory =
  | "invalid_input"
  | "access_denied"
  | "not_found"
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "environment"
  | "execution";
```

## Recommended implementation order

1. Compact diagnostics.
2. Structured `grep`, `find`, and `ls`.
3. Git workspace awareness.
4. Managed processes.
5. Browser and UI inspection.
6. Approved Pi documentation access.
7. Session query and analytics.
8. Web research.
9. Package information.

The first six tools address the dominant issues seen in the sessions: verbose diagnostics, shell-heavy discovery, accidental interference with user changes, inability to verify UI work, unreliable long-running commands, and contradictory documentation access rules.
