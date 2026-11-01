## Search and Inspection Rules

When exploring a codebase:

- Search progressively, moving from repository structure and file discovery to matching files, relevant ranges, and broader context as needed.
- Prefer `rg --files` for file discovery and `rg -l` for locating files containing a pattern. Use `rg -n` when matching lines are needed directly.
- Scope searches to relevant directories, file types, and patterns. Exclude dependencies, build artifacts, coverage, and generated files by default unless relevant to the task.
- Keep exploratory output below approximately 120 lines or 10 KB. If a search would exceed this budget, narrow its scope rather than truncating broad results.
- Inspect relevant ranges around matches before reading entire files. Read broader context when necessary to understand behavior, dependencies, contracts, or invariants.
- Avoid repeating searches or rereading unchanged content unless doing so resolves a specific uncertainty.
- Expand the search scope only when existing evidence is insufficient. Each expansion should address a specific unresolved question.
- Stop exploring once sufficient evidence exists to make the change confidently. Resume exploration when implementation or verification reveals new uncertainties.

Before modifying existing code:

- Identify the relevant entry points, call sites, and dependencies needed to understand the affected behavior.
- Establish which existing contracts, invariants, and conventions the change must preserve.
- Prefer targeted inspection over exhaustive repository exploration, but do not sacrifice correctness to minimize tool calls or output.d

# Implementation Rules

When writing code:

* Prefer declarative, expression-oriented code that can be read top to bottom as a transformation
* Prefer pure functions, immutable data, and composable transformations
* Keep mutation localized to explicit boundary code, such as IO, framework APIs, state stores, database clients, caches, or test setup
* Do not use local mutation for accumulation or transformation logic
* Do not use mutable arrays, objects, counters, or `for` loops to implement map/filter/reduce/group-by/partition/find-style logic
* Prefer `map`, `filter`, `reduce`, `flatMap`, `some`, `every`, `find`, `entries`, `fromEntries`, and similar declarative transformations
* If a loop or local mutation is necessary for correctness, framework interop, or performance, isolate it behind a small, named boundary
* Do not introduce trivial constants or helpers
* Only extract a constant or function when it names a meaningful domain concept, removes real duplication, isolates boundary logic, improves testability, or makes the code easier to reason about

When writing tests:

* Tests must assert externally observable behavior: returned values, rendered output, state changes, emitted events, API responses, persisted data, or user-visible effects
* Test through the stable public API or feature boundary
* Do not test private implementation details, internal call order, incidental structure, or temporary helper functions
* Do not expose private code only to make it testable
* Do not write trivial tests
* Only add tests that protect meaningful behavior, cover edge cases, reproduce a bug, verify a contract, or prevent likely regressions
