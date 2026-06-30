# Implementation Rules

Before writing code that interacts with existing code, first check:

* Whether existing code can be reused
* Whether existing code should be changed or generalized to support both the existing use case and the new one
* Whether introducing a new abstraction is actually justified, or whether it would add unnecessary coupling or indirection
* Which existing invariants, contracts, and conventions must be preserved

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
