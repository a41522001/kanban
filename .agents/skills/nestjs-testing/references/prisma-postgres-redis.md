# Prisma, PostgreSQL, and Redis

Use real disposable infrastructure when behavior depends on database or Redis semantics. Mocks remain useful for unit-level orchestration but are not evidence of engine behavior.

## PostgreSQL and Prisma

- Run E2E tests against PostgreSQL when production uses PostgreSQL. Do not substitute SQLite for JSON behavior, collations, locks, constraints, isolation, native types, or SQL-specific queries.
- Start from a disposable database, container, or schema and apply the same migrations used by deployment.
- Include at least one clean-database migration run when schema deployability is part of the risk.
- Use Prisma types and error codes only where they are part of the application's intentional translation logic.
- Assert external behavior and resulting rows, not generated SQL text.

## Transactions and Side Effects

For transaction-sensitive behavior, test all applicable guarantees:

1. Success commits every required write.
2. Failure rolls back every partial write.
3. Side effects such as email, events, or cache invalidation do not occur before commit.
4. A failed transaction does not leak a transaction client into later work.

A unit test with a fake `$transaction` callback proves callback orchestration only. A real rollback claim requires a real database and a failure after at least one write.

Do not wrap an HTTP E2E test in an external transaction unless the application request is guaranteed to use that exact transaction and connection. Usually it is not. Prefer a dedicated database plus explicit reset or unique test data.

## Constraints and Concurrency

- Prove unique constraints with the real database when duplicate writes can race.
- For race conditions, start concurrent operations intentionally and assert the allowed outcomes and final state.
- Avoid timing-only tests based on arbitrary sleeps. Coordinate with promises, barriers, locks, or observable state.
- Treat deadlocks and serialization failures according to the application's retry contract; do not assume they cannot happen.
- Assert ordering only when the query has a deterministic tie-breaker.

## Safe Database Isolation

Use one of these approaches, following existing project tooling:

- Dedicated container and database per run.
- Dedicated schema or database per worker.
- Explicit truncate/reset between scenarios.
- Unique identifiers plus teardown for only the rows created by the test.

Before truncating, dropping, resetting, or flushing anything, verify that the target is an explicit test environment. Never connect test cleanup to production credentials or a shared development database.

## Redis

- Use a dedicated Redis container, logical database, or key prefix for tests.
- Use the real Redis engine for Lua scripts, locks, TTLs, atomic counters, streams, pub/sub, and concurrency.
- Mock Redis only for provider branch tests that do not claim Redis semantics.
- Assert both return values and key state when state is part of the contract.
- Test expiration with controlled polling or fake time only when compatible with the Redis boundary; avoid fragile fixed sleeps.
- Flush Redis only after verifying it is a dedicated test instance.
- Close clients and subscriber connections to prevent open handles.

## Infrastructure Runner

A reliable runner should:

1. Start required services.
2. Wait for health, not merely process creation.
3. apply migrations to the clean test database.
4. Run the requested test command.
5. Preserve the test exit code.
6. Tear down services and volumes in a `finally`-equivalent path.

Reuse the repository's runner when it already provides this lifecycle. Do not introduce a second competing orchestration path without a concrete need.
