# NestJS Testing with Vitest

Read this reference for NestJS tests already running on Vitest or for an explicitly requested runner migration. It supplements the unit, HTTP E2E, and infrastructure references; AAA, test boundaries, and strict typing still apply. Verify behavior against the installed Vitest and Nest versions rather than assuming the latest documentation matches the repository.

## First Confirm the Runner and Transform

- `@nestjs/testing` (`Test.createTestingModule`, `compile`, `get`, `resolve`, `createNestApplication`, provider overrides) remains Nest's API. The runner changes test functions, mocks, configuration, and execution semantics, not the meaning of those Nest APIs.
- Keep `backend` on Jest if that is what its scripts and adjacent tests use. A frontend package's Vitest dependency does not make the backend a Vitest project. Do not migrate merely to satisfy an example.
- For Nest tests, use the Node test environment. Scope test discovery so unit specs and HTTP E2E specs run with the intended configuration and do not accidentally duplicate one another.
- Verify that the *test transform* emits legacy decorator metadata for constructor injection and decorated DTOs. Vite's TypeScript transform plus `experimentalDecorators`/`emitDecoratorMetadata` in `tsconfig` is not sufficient evidence. Nest documents `unplugin-swc`/SWC for Vitest; configure its legacy decorators and decorator metadata consistently with the project, import `reflect-metadata` before decorated modules if needed, and run a small DI/DTO-validation smoke test. Do not work around missing metadata by adding `@Inject()` to production code solely for tests.
- Match `resolve.alias` (or the repository's existing Vite path-resolution approach) to runtime imports; TypeScript `paths` alone do not establish that Vitest can load an alias. Check ESM/CJS boundaries, package exports, and `supertest` import interop when migrating.
- Vitest globals default to off. Prefer explicit `import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'`. If the repository deliberately enables `globals: true`, ensure test TypeScript types include `vitest/globals` and do not mix Jest global types into the Vitest test tsconfig.

Start from the repository's configuration and Nest's [Vitest/SWC recipe](https://docs.nestjs.com/recipes/swc#vitest); do not paste a universal config that overwrites aliases, plugins, environment setup, or package-specific test discovery.

## Typed Unit-Test Pattern

Use Nest provider overrides or `useValue` for injected collaborators. This is usually clearer than `vi.mock` for providers and avoids module-mock hoisting. Keep the mock object's interface narrow and typed to the methods actually used.

```ts
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';

describe('ProjectService', () => {
  let moduleRef: TestingModule | undefined;
  let service: ProjectService;
  let repository: {
    findMemberProject: Mock<ProjectRepository['findMemberProject']>;
    updatePinnedAt: Mock<ProjectRepository['updatePinnedAt']>;
  };

  beforeEach(async () => {
    repository = {
      findMemberProject: vi.fn<ProjectRepository['findMemberProject']>(),
      updatePinnedAt: vi.fn<ProjectRepository['updatePinnedAt']>(),
    };
    moduleRef = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ProjectService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('pins a member project', async () => {
    // Arrange
    repository.findMemberProject.mockResolvedValue(memberProject);
    repository.updatePinnedAt.mockResolvedValue(pinnedProject);

    // Act
    const result = await service.pinProject(projectId, userId);

    // Assert
    expect(result).toEqual(pinnedProject);
    expect(repository.updatePinnedAt).toHaveBeenCalledOnce();
  });
});
```

Adapt names, signatures, lifecycle, and assertions to the real code. A freshly created mock per test normally needs no global reset. For request/transient-scoped providers use Nest's `resolve()` as appropriate, not `get()` by habit.

## Mocking, State, and Timers

- Use `vi.fn`, `vi.spyOn`, `vi.mocked`, and Vitest's `Mock`/`Mocked` types where appropriate. `vi.mocked(value)` helps TypeScript treat an *existing mock* as mocked; it does not create the mock. Do not leave `jest.fn`, `jest.Mocked`, `jest.spyOn`, or `jest.mock` in Vitest tests.
- Prefer provider injection to whole-module mocking. `vi.mock` is hoisted before imports; a factory cannot casually close over later-initialized variables. Use `vi.hoisted` for hoisted state, or `vi.doMock` plus a subsequent dynamic import for per-test module mocking. Partial mocks must preserve required exports; `vi.mock` does not mock `require()` imports.
- `vi.clearAllMocks()` clears call history without removing implementations. `vi.resetAllMocks()` resets mock implementations too. `vi.restoreAllMocks()` restores manually spied methods; its precise reset behavior differs by Vitest version. Choose per-test reconstruction or explicit cleanup rather than a blanket reset that erases Arrange-time behavior.
- Use `vi.useFakeTimers()` only around the code whose timers matter, then `vi.useRealTimers()` in cleanup. `vi.setSystemTime()` also needs restoration. Avoid faking timers across Nest bootstrap, HTTP requests, database/Redis clients, or polling infrastructure unless proven safe. Advance or run timers deliberately and await asynchronous work.
- Restore `vi.stubGlobal`/`vi.stubEnv` with `vi.unstubAllGlobals()`/`vi.unstubAllEnvs()` or the repository's configured automatic unstubbing. Do not let environment or module mocks leak between tests.

## Strict TypeScript and Assertions

- Vitest transforms TypeScript but does not type-check ordinary test execution. Run the repository's TypeScript check and type-aware ESLint separately; a green `vitest run` is not a typing or lint result.
- Some asymmetric matcher typings return `any`. With `@typescript-eslint/no-unsafe-assignment`, embedding `expect.any(...)` or `expect.stringMatching(...)` in a typed object literal can fail even when the runtime assertion is valid. Prefer a typed value assertion: `expect(typeof result.pinnedAt).toBe('string')`, `expect(result.pinnedAt).toMatch(...)` after narrowing, or test `result.pinnedAt instanceof Date` as appropriate. Do not cast through `any`, suppress the rule, or weaken the behavior under test.
- Supertest's `response.body` can be untyped. Treat it as an untrusted boundary: assign to `unknown`, validate/narrow it (or use a project's response-schema parser), then assert typed fields. A bare `as ResponseDto` only hides a possible response-shape bug.
- Keep AAA: construct mock results and fixtures in Arrange; make one primary service call or HTTP request in Act; assert result and required interactions in Assert. Await promises, including `rejects` assertions and async cleanup.

## HTTP E2E, Concurrency, and Coverage

- Preserve the real Nest root module and production-relevant bootstrap, guards, pipes, filters, sessions, and persistence. With Supertest, use the actual `app.getHttpServer()`, type/parse response bodies, and `await app.close()` in `afterAll`.
- Vitest runs test files in parallel by default; tests inside a file are sequential unless marked concurrent. Separate test data by file/test. If a shared database reset or fixed port truly cannot overlap, configure E2E-specific `fileParallelism: false` (or isolate infrastructure) rather than serializing every unit test. Do not use `test.concurrent` for shared mutable fixtures.
- Use the package's scripted `vitest run`/`--config` commands for non-watch verification. Execute the narrow spec, then its suite, then E2E as appropriate. Check type-check and lint separately. For coverage, use the configured V8 or Istanbul provider and matching `@vitest/coverage-*` package; coverage is a discovery aid, not proof of the contract.
- During an explicit Jest-to-Vitest migration, update unit/E2E scripts and config, setup files, globals/imports, mocks, fake timers, path aliases, SWC/decorator metadata, coverage provider, and CI commands together. Compare representative unit, DI, DTO-validation, and HTTP/session tests before removing Jest dependencies.

## Primary References

- [NestJS SWC and Vitest recipe](https://docs.nestjs.com/recipes/swc#vitest)
- [NestJS testing fundamentals](https://docs.nestjs.com/fundamentals/testing)
- [Vitest mocking guide](https://vitest.dev/guide/mocking.html) and [module mocking](https://vitest.dev/guide/mocking/modules)
- [Vitest parallelism](https://vitest.dev/guide/parallelism), [coverage](https://vitest.dev/guide/coverage), and [Jest migration](https://vitest.dev/guide/migration.html)
- [Vitest writing tests and TypeScript checks](https://vitest.dev/guide/learn/writing-tests) and [TypeScript ESLint no-unsafe-assignment](https://typescript-eslint.io/rules/no-unsafe-assignment/)
