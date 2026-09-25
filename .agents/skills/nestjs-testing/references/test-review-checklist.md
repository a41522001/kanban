# Test Review Checklist

Use this checklist when reviewing, repairing, or extending a NestJS test suite. Report findings by impact and point to the exact test or missing behavior.

## Scope and Level

- Does each test use the smallest level that can prove its claim?
- Are framework, authentication, database, Redis, or concurrency claims incorrectly based only on mocks?
- Is controller coverage duplicating service tests instead of testing HTTP behavior?
- Are high-risk branches absent despite high line coverage?

## AAA and Readability

- Is Arrange clearly separated from the primary Act and Assert?
- Does one `it` describe one observable behavior?
- Are setup helpers typed, focused, and visible enough to understand the scenario?
- Do test names describe conditions and expected outcomes rather than method names alone?
- Are assertions strong enough to fail for the intended regression?

## Isolation and Determinism

- Can each `it` run alone and in any order?
- Does a test rely on mutable module-level IDs, users, cookies, rows, or mocks created by a previous test?
- Are generated values unique where shared infrastructure persists?
- Is ordering backed by explicit sort keys and deterministic tie-breakers?
- Are arbitrary sleeps hiding a race?

## NestJS Public Boundary

- Do E2E tests use relevant production bootstrap behavior?
- Are guards, pipes, filters, interceptors, serialization, and sessions real when they are in scope?
- Are status codes, response envelopes, and stable error codes asserted?
- Are both unauthenticated and unauthorized cases covered where they differ?

## Persistence and Side Effects

- Is rollback tested with a real database when claimed?
- Are no-partial-write guarantees asserted after failure?
- Are external side effects verified to occur after commit and not on rollback?
- Are unique constraints and concurrent writes tested against the real engine when risky?
- Is Redis atomicity or TTL behavior tested with real Redis when claimed?

## Types and Fixtures

- Are `any`, `@ts-ignore`, broad lint disables, and pervasive non-null assertions absent?
- Do fixtures satisfy current DTO validation and database constraints?
- Are mocks typed narrowly enough to catch contract changes?
- Do assertions avoid unstable implementation metadata?
- Do asymmetric matchers or untyped HTTP response bodies leak `any` into typed object literals under the project's type-aware ESLint rules?

## Runner Compatibility

- Does the test use the repository's actual Jest or Vitest version and imports, without mixing `jest.*` with `vi.*`?
- For Vitest, does the test transform preserve Nest decorator metadata, and do runtime aliases resolve?
- Are `vi.mock` hoisting, module loading, mock reset semantics, fake timers, and test-file parallelism handled where relevant?
- Are unit, E2E, coverage, and type-check commands verified separately when the runner configuration differs?

## Lifecycle and Verification

- Are Nest applications, database clients, Redis clients, sockets, workers, and timers closed?
- Does cleanup target only a verified test environment?
- Was the narrow test run before the containing suite?
- Were relevant type-check and lint commands run?
- Are failures reported as application, infrastructure, or tooling failures rather than hidden by weaker assertions?

## Coverage Judgment

Do not impose a universal coverage percentage. Prefer risk-based coverage of:

- Authorization boundaries.
- Money, quotas, ordering, and state transitions.
- Transactions and post-commit side effects.
- Duplicate or concurrent writes.
- Archived, deleted, or missing resources.
- Validation and stable error contracts.

Treat coverage reports as a map for investigation, not proof of correctness.
