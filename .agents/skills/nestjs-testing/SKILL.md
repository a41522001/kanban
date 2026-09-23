---
name: nestjs-testing
description: Write, review, repair, and extend NestJS unit, integration-style, and HTTP E2E tests using the project's Jest or Vitest conventions; guide explicitly requested Jest-to-Vitest test migrations. Use for NestJS providers, controllers, guards, pipes, filters, Supertest flows, Prisma/PostgreSQL/Redis integration, transactions, authorization, concurrency, or test strategy. Do not use for frontend tests or generic non-NestJS testing.
---

# NestJS Testing

Create tests that prove observable behavior, fail for meaningful regressions, and remain easy to understand. Preserve the repository's established style unless it conflicts with correctness or this skill's mandatory rules.

## Inspect Before Writing

Read the following before changing tests:

1. Applicable `AGENTS.md` files and package scripts.
2. Test runner, installed version, and configuration (`jest`, `vitest`, SWC, ts-jest, aliases, setup files, coverage, and test scripts).
3. Application bootstrap and test bootstrap, especially global pipes, filters, interceptors, middleware, cookies, sessions, and validation.
4. The production code, DTOs, response contracts, error types, and adjacent tests.
5. Existing infrastructure runners such as Docker Compose, migrations, database reset scripts, and Redis setup.

Detect Jest versus Vitest from the repository. Do not replace the runner, ORM, assertion style, or unrelated test configuration merely to fit an example.
Treat a Jest-to-Vitest migration as a separate requested change, not a side effect of writing tests. For Vitest, confirm Nest's decorator metadata is emitted by the actual test transform; `tsconfig` flags alone do not prove this.

## Choose the Smallest Correct Test Level

| Test level | Use it to prove |
| --- | --- |
| Unit | Provider or controller branches, mappings, returned values, thrown errors, and dependency interactions |
| Integration-style | Nest module wiring, DTO validation, pipes, filters, interceptors, or framework behavior that isolated mocks would hide |
| HTTP E2E | Routes, authentication, cookies or sessions, guards, serialization, authorization, and persisted state through the real application |
| Real infrastructure | Database constraints and rollback, concurrent writes, Redis Lua or atomicity, WebSocket behavior, or engine-specific semantics |

Do not claim that a mocked transaction proves database rollback or that an overridden guard proves authorization.

## Enforce AAA

AAA is mandatory for every non-trivial test:

```ts
it('describes one observable behavior', async () => {
  // Arrange
  // Prepare data, fixtures, mocks, and prerequisites.

  // Act
  // Execute the single primary production behavior.

  // Assert
  // Verify the result, error, state transition, and required side effects.
});
```

Apply these rules:

- Keep Arrange, Act, and Assert in that order. Do not mix primary execution into setup or assertions.
- Prefer one behavior per `it`. Add several assertions only when they jointly describe that behavior.
- Short obvious tests may omit the comments, but must retain the three logical phases.
- In E2E tests, prerequisite requests may use `.expect(...)` during Arrange to confirm setup succeeded. Keep assertions about the behavior under test in Assert.
- Never make one `it` depend on data or state created by a previous `it`.
- Represent a genuinely sequential business journey as one complete `it`, or give each scenario independent setup helpers.

## Preserve Strong Test Boundaries

- Recreate mutable unit-test fixtures and mocks in `beforeEach` unless immutability is intentional.
- Mock external boundaries, not the behavior being tested. Avoid mocking every internal collaborator into implementation-detail assertions.
- Keep real guards, authentication, validation, and persistence in E2E tests by default. Override them only when that boundary is explicitly out of scope and state the reason.
- Use the same database engine as production when testing engine-dependent behavior. PostgreSQL behavior is not proven by SQLite.
- Use strict types. Do not add `any`, `@ts-ignore`, or broad ESLint disables to make a test compile.
- Test public behavior. Do not reach into private methods unless the production design itself should be changed.
- Assert important negative effects, such as no notification before commit, no partial rows after failure, or no repository write on authorization failure.
- Close applications, clients, sockets, timers, and infrastructure handles created by the test.

## Read the Relevant Guidance

- For providers, controllers, mocks, errors, and transaction callbacks, read [references/unit-testing.md](references/unit-testing.md).
- For Supertest, authentication, application bootstrap, and scenario isolation, read [references/e2e-testing.md](references/e2e-testing.md).
- For any NestJS tests using Vitest, or a requested Jest-to-Vitest migration, read [references/vitest.md](references/vitest.md) in addition to the relevant test-level reference.
- For Prisma, PostgreSQL, Redis, migrations, concurrency, rollback, or test containers, read [references/prisma-postgres-redis.md](references/prisma-postgres-redis.md).
- When reviewing or repairing a test suite, read [references/test-review-checklist.md](references/test-review-checklist.md).

Read only the references required for the current task.

## Verify and Report

Run the narrowest relevant test first, then the containing suite. Run type-checking, linting, or broader tests when the change or repository workflow warrants it. Do not silently weaken assertions to obtain a green run.

In the final report, state:

- What behavior is now covered or corrected.
- Which commands passed.
- Any command that failed, was skipped, or was blocked by missing infrastructure.
- Any remaining risk that the chosen test level cannot prove.
