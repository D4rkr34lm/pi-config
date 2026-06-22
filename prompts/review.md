Review the current branch like a senior engineer in a production codebase.

Base the review strictly on the diff between the current branch and the branch it is based on.

Before reviewing, determine the appropriate base branch or merge-base. Compare only the changes introduced by this branch, not unrelated existing code. Use surrounding code only to understand context, invariants, ownership, and side effects.

Do not review unchanged code unless it is directly affected by the diff. If unchanged code has a pre-existing issue, mention it only if this branch makes that issue worse or relies on it unsafely.

Focus especially on:

* whether the changed code preserves existing invariants
* edge cases introduced by the diff
* async, state, lifecycle, or concurrency bugs
* unsafe defaults
* changed authorization, validation, or permission behavior
* unnecessary coupling introduced by the branch
* duplicated logic added by the branch that suggests a missing abstraction
* whether tests assert outputs and externally observable behavior
* whether the diff accidentally changes behavior outside its intended scope

For every issue, include:

* severity: blocker, major, minor, or suggestion
* location
* problem
* why it matters
* minimal suggested fix, if useful

Avoid style-only comments unless they affect correctness, maintainability, readability, or future change safety.

Output:

1. What this branch appears to change
2. Whether the general approach is sound
3. Issues found, ordered by severity
4. Missing or weak test coverage
5. Any notable risks or assumptions

If you find no substantive issues, say so clearly. Do not invent issues to fill the review.

Do not modify code. Produce the review only. If you suggest changes, keep them as minimal patches or examples. Wait for confirmation before applying them.
