# Unit Testing

Use unit tests for isolated provider and controller behavior. Preserve the repository's runner: use `jest` in Jest projects and `vi` in Vitest projects. The example below is Jest-specific; when using Vitest, read [vitest.md](vitest.md) and use its typed Vitest example rather than mechanically replacing identifiers.

## Build the Test Module

- Use `Test.createTestingModule` when Nest dependency injection or provider tokens are part of the behavior.
- Supply collaborators with `useValue`, `useFactory`, or the same mechanism used by adjacent tests.
- Type the system under test, dependency mocks, DTOs, and fixtures explicitly.
- Rebuild mutable modules and fixtures in `beforeEach` unless suite-level reuse is demonstrably immutable.
- Choose mock cleanup deliberately: `clearAllMocks` clears calls, `resetAllMocks` also removes implementations, and `restoreAllMocks` restores spies. Do not use one blindly.

```ts
describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepository: jest.Mocked<ProjectRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: ProjectRepository,
          useValue: {
            findMemberProject: jest.fn(),
            updatePinnedAt: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ProjectService);
    projectRepository = moduleRef.get(ProjectRepository);
  });

  it('pins an active project for an existing member', async () => {
    // Arrange
    projectRepository.findMemberProject.mockResolvedValue(memberProject);
    projectRepository.updatePinnedAt.mockResolvedValue(pinnedProject);

    // Act
    const result = await service.pinProject(projectId, userId);

    // Assert
    expect(result).toEqual(pinnedProject);
    expect(projectRepository.updatePinnedAt).toHaveBeenCalledWith(
      projectId,
      userId,
      expect.any(Date),
    );
  });
});
```

Adapt names and assertions to the real code. Do not paste the example as a substitute for reading contracts.

## Test Behavior, Not Implementation Noise

For each relevant branch, consider:

- Success result and output mapping.
- Missing resource or membership.
- Unauthorized or forbidden access.
- Conflict, duplicate, archived, or invalid state.
- Dependency failure propagation or translation.
- Required calls and important call arguments.
- Forbidden calls and absent side effects on failure.

Avoid asserting every internal call when the observable result already proves the behavior. Interaction assertions are valuable when ordering, atomicity, authorization, or a side effect is part of the contract.

## Controllers

Controller unit tests should prove thin HTTP-layer responsibilities such as:

- Passing authenticated identity, params, query values, and DTOs to the service.
- Returning the expected response envelope or serialization input.
- Delegating framework-independent errors without duplicating service tests.

Do not reproduce service branch coverage in the controller suite. Use HTTP E2E tests for pipes, guards, decorators, validation, cookies, and filters.

## Transactions

A unit test may mock a transaction callback to prove orchestration:

- The transaction is opened.
- All transaction-scoped repository calls receive the same transaction client.
- Post-commit side effects occur only after the transaction resolves.
- Failure prevents later writes or side effects.

Use a typed fake compatible with the narrow transaction-client surface. A cast through `unknown` is acceptable only when the framework type cannot be constructed and the fake still exposes every member used by production code.

A mocked callback cannot prove actual rollback, isolation, unique constraints, or deadlock behavior. Add real-database coverage for those claims.

## Strict TypeScript

- Prefer DTO, entity, Prisma payload, and API response types already exported by the project.
- Create small fixture builders when full records are noisy, while keeping required fields accurate.
- Do not use `any`, `@ts-ignore`, non-null assertions everywhere, or broad lint suppression.
- Treat matcher return types as potentially unsafe under type-aware ESLint. Avoid embedding `expect.any(...)`, `expect.stringMatching(...)`, or similar asymmetric matchers in a typed object assignment; instead extract the value as `unknown`, narrow it, and assert on the resulting typed value. Check the actual runner version's types before choosing a workaround.
- Assert typed error properties with `toMatchObject` when the complete framework error object contains unstable metadata.
- Keep test data aligned with current validation rules so fixtures do not silently describe an impossible request.
