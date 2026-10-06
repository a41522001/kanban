# HTTP E2E Testing

Use E2E tests to prove the behavior visible through the application's public boundary. Prefer the real root module, authentication flow, validation, filters, guards, persistence, and serialization.

## Bootstrap the Real Application

- Inspect the production bootstrap before creating the test application.
- Reproduce relevant setup not already registered through the module, including global pipes, filters, interceptors, middleware, cookie or session configuration, and shutdown hooks.
- Use Supertest or the repository's established HTTP client.
- Use `request.agent(...)` when cookies or sessions must persist between requests.
- Close the Nest application in `afterAll`, even when a test fails.
- With Vitest, keep the HTTP test environment on Node, import test APIs explicitly unless the project enables globals, and verify that the transform emits Nest decorator metadata. Read [vitest.md](vitest.md).

Do not override every guard as a convenience. When authentication or authorization is part of the route contract, obtain a real authenticated session or token and exercise the real guard.

## Keep Scenarios Independent

Test runners may reorder, retry, shard, or run files in parallel. Therefore:

- `beforeAll` may create the application and immutable infrastructure handles.
- One `it` must not consume an ID, user, cookie, or row created by another `it`.
- Use helpers such as `signupAndLogin`, `createWorkspace`, or `createProject` during each test's Arrange phase.
- Generate unique emails, slugs, and names when the database persists during the suite.
- If the behavior is inherently a journey, keep the whole journey in one `it` with one primary outcome.

Avoid this pattern:

```ts
let projectId: string;

it('creates a project', async () => {
  projectId = await createProject();
});

it('pins the created project', async () => {
  await pinProject(projectId);
});
```

Prefer independent setup:

```ts
it('returns a pinned project before unpinned projects', async () => {
  // Arrange
  const agent = request.agent(app.getHttpServer());
  await signupAndLogin(agent);
  const workspace = await createWorkspace(agent);
  const olderProject = await createProject(agent, workspace.id, 'Older');
  const pinnedProject = await createProject(agent, workspace.id, 'Pinned');
  await agent.patch(`/projects/${pinnedProject.id}/pin`).expect(200);

  // Act
  const response = await agent
    .get(`/workspaces/${workspace.id}/projects`)
    .expect(200);

  // Assert
  const body: unknown = response.body;
  const projects: ProjectResponse[] = parseProjectsResponse(body);
  expect(projects[0]?.id).toBe(pinnedProject.id);
  expect(typeof projects[0]?.pinnedAt).toBe('string');
  expect(
    projects.some(
      (project) => project.id === olderProject.id && project.pinnedAt === null,
    ),
  ).toBe(true);
});
```

Use route names, response envelopes, and typed parsing helpers from the actual application. If type-aware ESLint rejects an asymmetric matcher because it returns `any`, assert on a narrowed field directly instead of assigning the matcher into a typed object.

## Cover the Public Contract

Select cases based on risk:

- Happy path and final persisted state.
- Unauthenticated request.
- Authenticated but unauthorized identity.
- Invalid DTO, params, or query values.
- Missing, archived, duplicate, or conflicting resource.
- Session or cookie lifecycle where relevant.
- Response status, envelope, serialization, and stable error code.
- Absence of partial state or side effects after failure.

Prefer stable assertions. Match the contract, not incidental timestamps, stack traces, generated UUID values, or database ordering that the query does not guarantee.

## Helpers

Helpers should reduce setup noise without hiding the behavior:

- Give helpers typed inputs and outputs.
- Assert prerequisite requests inside helpers or immediately in Arrange.
- Return only data the scenario needs.
- Do not put the primary Act or Assert inside a generic helper.
- Use explicit parsing helpers for response envelopes instead of pervasive non-null assertions.

## Diagnose Failures

Separate application failures from infrastructure failures:

- Connection refused, missing migration, unhealthy container, port collision, or Redis startup is infrastructure.
- Wrong status, body, state transition, authorization, or side effect is application behavior.
- Open-handle warnings usually indicate an unclosed app, client, timer, worker, socket, or Redis connection.

Report which layer failed instead of editing assertions until the suite turns green.
