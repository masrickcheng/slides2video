# AGENTS.md

## Working Principles

- Understand the existing implementation before modifying it.
- Search the repository before creating new implementations.
- Make the smallest change that fully solves the task.
- Keep changes within the requested scope.
- Preserve existing behavior unless the task requires changing it.
- Prefer repository evidence over assumptions.
- Do not modify unrelated user work.
- Validate changes before declaring completion.
- Report the validation evidence with the final result.

## Code Quality

- Prefer simple, direct implementations; add abstraction or indirection only for a concrete current need.
- Keep responsibilities cohesive and place behavior with the code that owns it.
- Reuse the authoritative implementation of a business rule; avoid parallel implementations that can diverge.
- Keep failures observable: handle errors intentionally, preserve diagnostic context, and fail clearly when safe continuation is impossible.
- Favor intent-revealing names, explicit behavior, and readable code over clever compression; remove code made obsolete by the current change.
- Keep interfaces small and intentional, with clear inputs, outputs, failure behavior, and compatibility expectations.
- Prefer self-explanatory code; comments should explain non-obvious reasons, constraints, workarounds, and assumptions, and should stay accurate.
- Prefer Chinese for new or updated code comments, unless English is clearer for external APIs, protocol terms, error text, or quoted upstream concepts.

## Node.js and TypeScript Code Quality

- Give every Promise an intentional disposition: await, return, combine, or deliberately detach it with observable rejection handling.
- Choose sequential or concurrent execution deliberately; preserve required ordering and bound fan-out when input or resource use can grow.
- Prefer platform APIs and existing suitable dependencies; add a package only for a concrete need that justifies its maintenance and compatibility cost.
- Parse and validate configuration at a clear boundary; keep raw environment access localized and never expose secrets in diagnostics.
- Keep exported and cross-module contracts explicit. In TypeScript, prefer useful types and `unknown` with narrowing over unnecessary `any` or unsafe assertions; in JavaScript, validate dynamic boundaries and follow established JSDoc conventions when present.
