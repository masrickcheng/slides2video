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

## Project Knowledge

- Treat `README.md` as the authority for product intent, user-facing behavior, CLI usage, project directory shape, prerequisites, environment keys, pipeline phases, resume behavior, and voice catalog.
- Treat `generate-video.mjs` as the implementation authority for runtime behavior; when it disagrees with documentation, preserve the conflict and update the stale authority instead of guessing.
- Treat `package.json`, `package-lock.json`, `eslint.config.js`, and `.prettierrc.json` as the authority for Node.js package, dependency, lint, and format tooling facts.
- Treat `.harness.yaml` as the Harness component-state index only; it does not store verification evidence or maturity facts beyond declarations.
- Current project state is not tracked in a durable plan file yet. Use the git working tree for active uncommitted work and `.harness.yaml` for Harness state; do not report planned, blocked, or unverified chat context as completed repository work.
- Record durable decisions, constraints, and repeated failure patterns near the owning documentation or code comments when evidence exists. Do not invent decision history or failure patterns just to fill a category.
- When project facts change, update the authoritative source in the same change when it is in scope; otherwise call out the stale or conflicting source in the final report.

## Planning Guidance

- Handle simple, local, low-risk tasks directly. Use a durable plan when work spans multiple modules or phases, has unclear requirements, changes architecture or user-visible behavior, may take multiple sessions, or has high verification risk.
- When a durable plan is needed, make its authority explicit in the task context or a repository artifact before relying on it. This repository has no permanent active-plan file yet; do not manufacture one for routine work.
- A complex-work plan must record the goal, current context, scope and non-goals, milestones or steps, acceptance criteria, and verification approach. Link to the Project Knowledge authorities instead of copying stable facts into the plan.
- Keep plan state current as work proceeds. Distinguish completed, active, pending, blocked, and unverified items, and record new discoveries or deviations when they affect execution.
- Mark milestones and plans complete only after observing the implementation and verification evidence. Intentions, stale check output, or unchecked code do not count as completion.
- Preserve enough handoff detail for another session to continue: current state, decisions made, unresolved questions, next actions, and any verification still needed.
- Close, archive, or clearly label completed plans as historical. Abandoned or superseded work must remain explicitly unresolved rather than being presented as current project state.

## Review Guidance

- Begin semantic review only after the relevant H2 checks have passed. If lint or format is failing, report that first and do not describe the change as clean.
- Review the actual diff and task intent, including relevant untracked files. Inspect surrounding implementation only as needed to judge behavior, risk, and compatibility.
- Use the Code Quality and Node.js and TypeScript Code Quality sections as the review criteria. Apply Project Knowledge and Planning Guidance when facts, scope, or plan state matter.
- Look for correctness issues, edge cases, unintended behavior changes, weak or missing validation, hidden side effects, compatibility risks, and relevant security concerns.
- Make findings actionable: identify the concrete location or affected behavior, explain the impact and evidence, and assign a useful priority. Do not report style preferences without material impact as defects.
- When the task includes fixing review findings, keep fixes scoped, rerun the relevant H2 checks, and review the resulting diff again.
- Final review reports must distinguish findings, fixes made, verification run, unresolved risks, and areas not reviewed. Claim a clean review only for the scope actually inspected with current H2 evidence.

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
