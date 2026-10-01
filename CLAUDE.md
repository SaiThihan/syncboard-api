# SyncBoard API — Claude Code Instructions

## 1. Project Overview

SyncBoard API is the backend service for SyncBoard, a real-time collaborative board application.

This repository is completely independent from `syncboard-web`.

The API and web repositories must remain separate repositories.

Do NOT:

- create a monorepo
- create workspace configuration
- create shared packages between the repositories
- move files between repositories
- couple the repositories through a shared local package

The backend should be clean, modular, strongly typed, and easy to extend incrementally.

---

# 2. Tech Stack

Use the following stack:

- Node.js
- NestJS
- TypeScript
- Socket.IO
- class-validator
- class-transformer
- Jest
- Supertest
- ESLint
- Prettier

## Currently NOT Allowed

Do not introduce any of the following unless explicitly requested:

- PostgreSQL
- Prisma
- Redis
- BullMQ
- authentication
- JWT
- OAuth
- external databases
- message queues
- external persistence systems

Do not add infrastructure just because it may be useful in the future.

---

# 3. Architecture

Use NestJS modular architecture with clear domain boundaries.

The backend currently has three major areas:

```text
src/
├── main.ts
├── app.module.ts
├── common/
├── boards/
└── presence/
```

Keep responsibilities separated.

---

# 4. Required Folder Structure

The preferred backend structure is:

```text
src/
├── main.ts
├── app.module.ts
│
├── common/
│   ├── acknowledgements/
│   ├── errors/
│   ├── limits/
│   └── websocket/
│
├── boards/
│   ├── boards.module.ts
│   ├── boards.controller.ts
│   ├── boards.service.ts
│   ├── boards.gateway.ts
│   ├── dto/
│   ├── events/
│   └── types/
│
└── presence/
    ├── presence.module.ts
    └── presence.service.ts
```

This structure is the architectural baseline.

Do not reorganize it without a clear reason.

---

# 5. Folder Structure Rules

Keep the folder structure clean and domain-oriented.

## Domain Ownership

- Board-related code belongs in `src/boards/`.
- Presence-related code belongs in `src/presence/`.
- Cross-cutting reusable infrastructure belongs in `src/common/`.
- Application bootstrap code belongs in `main.ts` and `app.module.ts`.

## Avoid Folder Sprawl

Do NOT create random top-level folders such as:

```text
src/utils/
src/helpers/
src/misc/
src/shared/
src/services/
src/websocket/
src/constants/
```

unless there is a clear architectural reason.

Prefer existing directories.

For example:

- shared error definitions → `common/errors/`
- shared limits → `common/limits/`
- WebSocket infrastructure → `common/websocket/`
- board events → `boards/events/`
- board DTOs → `boards/dto/`
- board types → `boards/types/`

## Before Creating a New Folder

Ask:

1. Which domain owns this code?
2. Is it board-specific?
3. Is it presence-specific?
4. Is it genuinely shared?
5. Can it fit into an existing directory?
6. Does creating a new folder make the architecture clearer?

Create a new folder only when it improves separation of responsibilities.

## Before Creating a New File

Ask:

1. Does this file have a clear responsibility?
2. Does an existing file already own this responsibility?
3. Is the file located inside the correct domain?
4. Is the file name descriptive?

Avoid files that become unrelated collections of functions, constants, or types.

---

# 6. `common/`

`src/common/` contains genuinely shared backend infrastructure.

Current planned areas:

```text
common/
├── acknowledgements/
├── errors/
├── limits/
└── websocket/
```

## `common/acknowledgements/`

Contains shared acknowledgement response types/contracts used by the API or WebSocket layer.

Keep these generic.

## `common/errors/`

Contains shared error codes and error-related definitions.

Do not put board-specific errors here unless they are genuinely shared.

## `common/limits/`

Contains shared application limits and constraints.

Do not scatter magic numbers throughout the codebase.

## `common/websocket/`

Contains shared WebSocket infrastructure such as exception handling.

Do not put board business logic here.

---

# 7. Boards Module

The board domain belongs under:

```text
src/boards/
```

Structure:

```text
boards/
├── boards.module.ts
├── boards.controller.ts
├── boards.service.ts
├── boards.gateway.ts
├── dto/
├── events/
└── types/
```

## Controller

`boards.controller.ts`

Responsibilities:

- REST/HTTP entry points
- request handling
- delegating work to services

Controllers should remain thin.

Do NOT put business logic inside controllers.

## Service

`boards.service.ts`

Responsibilities:

- board domain/business logic
- domain rules
- coordinating board operations

Business rules should live here rather than inside controllers or gateways.

## Gateway

`boards.gateway.ts`

Responsibilities:

- Socket.IO/WebSocket transport
- receiving WebSocket events
- validating/forwarding event data
- delegating domain work to services

Keep gateways focused on transport.

Do NOT put large amounts of business logic inside the gateway.

## DTO

`boards/dto/`

Responsibilities:

- request contracts
- input validation

Use:

- `class-validator`
- `class-transformer`

Do not put business logic inside DTOs.

## Events

`boards/events/`

Responsibilities:

- board-related WebSocket event definitions
- event names
- event payload contracts where appropriate

Avoid scattering important event-name strings throughout the codebase.

## Types

`boards/types/`

Responsibilities:

- board domain interfaces
- board-related TypeScript types
- domain contracts

Keep types strongly typed.

Avoid `any`.

---

# 8. Presence Module

Presence belongs under:

```text
src/presence/
```

Structure:

```text
presence/
├── presence.module.ts
└── presence.service.ts
```

Presence concerns must remain separate from board concerns.

Do not tightly couple presence state to board business logic unless explicitly required by the architecture.

Future presence functionality may include:

- connected users
- presence state
- cursor information

However, do not implement these behaviors unless explicitly requested.

---

# 9. REST API Configuration

The API must use:

```text
/api
```

as the global REST prefix.

Configure this in `main.ts`.

Example expected behavior:

```text
GET /api/...
```

Do not create inconsistent prefixes on individual controllers unless explicitly required.

---

# 10. Validation

Use NestJS `ValidationPipe` globally.

Use:

- `class-validator`
- `class-transformer`

Prefer DTO-based validation.

Do not duplicate validation logic manually when DTO decorators can express the constraint.

Do not weaken validation simply to make development easier.

---

# 11. CORS

Configure CORS explicitly.

CORS configuration should be easy to adjust for development and production.

Do not use an unrestricted configuration as a permanent solution.

Do not silently disable CORS.

---

# 12. WebSocket / Socket.IO

Use Socket.IO through NestJS gateways.

WebSocket transport code belongs in gateway-related code.

Important WebSocket contracts should use explicit TypeScript types.

Prefer centralized event definitions over scattered string literals.

WebSocket-related concerns include:

- event names
- event payloads
- acknowledgement payloads
- WebSocket errors

Do not create multiple unrelated Socket.IO server instances.

Do not implement reconnection behavior unless explicitly requested.

---

# 13. Error Handling

Use consistent error codes from the common error layer.

Do not expose:

- stack traces
- internal implementation details
- database details
- sensitive internal information

through normal API or WebSocket responses.

Use NestJS exception mechanisms.

For WebSocket errors, use NestJS WebSocket exception handling rather than ad-hoc error handling scattered across gateways.

---

# 14. TypeScript Rules

Use strict TypeScript.

Rules:

- Avoid `any`.
- Prefer explicit interfaces and types.
- Avoid unnecessary type assertions.
- Do not weaken `tsconfig` settings to bypass errors.
- Prefer readable types over clever abstractions.
- Keep domain contracts strongly typed.
- Avoid duplicated type definitions.
- Use meaningful names.

If a type is part of a module's public contract, export it appropriately.

---

# 15. Dependency Injection

Use NestJS dependency injection.

Prefer constructor injection.

Do not create services manually when NestJS dependency injection can manage them.

Do not introduce custom dependency injection patterns without a clear reason.

---

# 16. Testing

Use:

- Jest
- Supertest

## Unit Tests

Use Jest for isolated services and utilities.

## HTTP Tests

Use Supertest for REST endpoint behavior.

## WebSocket Tests

When WebSocket functionality is implemented, test externally observable behavior.

Do not test private implementation details unnecessarily.

## Test Principle

Do not modify production behavior only to make a test pass.

Tests should verify the intended behavior.

---

# 17. Code Quality

Keep code:

- readable
- modular
- maintainable
- strongly typed
- focused

Prefer:

- small functions
- clear names
- simple control flow
- explicit types
- focused modules
- NestJS conventions

Avoid:

- giant services
- giant gateways
- unnecessary abstractions
- premature design patterns
- duplicated logic
- deeply nested conditionals
- magic strings
- magic numbers

---

# 18. Dependency Rules

Before adding a dependency:

1. Check whether the current stack already provides the functionality.
2. Confirm that the dependency is necessary.
3. Prefer established and lightweight packages.
4. Consider whether the dependency introduces unnecessary complexity.

Do not add:

- databases
- caches
- queues
- authentication libraries
- infrastructure packages

without explicit instruction.

Keep the dependency tree intentionally small.

---

# 19. Business Logic Scope

Do not implement future functionality proactively.

The following are explicitly out of scope until requested:

- authentication
- database persistence
- PostgreSQL
- Prisma
- Redis
- BullMQ
- board CRUD
- board object creation
- board object updates
- board object deletion
- canvas behavior
- real-time collaboration behavior
- presence synchronization
- cursor synchronization
- optimistic updates
- reconnection logic

Creating types, interfaces, DTO placeholders, or module structure for future functionality is acceptable when required.

Do not implement the actual behavior before it is requested.

---

# 20. Incremental Development

SyncBoard will be implemented step by step.

Follow this development pattern:

```text
Architecture
    ↓
Types / Contracts
    ↓
Infrastructure
    ↓
Small Feature
    ↓
Tests
    ↓
Verification
    ↓
Next Feature
```

Do not implement several future features in one task unless explicitly requested.

If the user asks for one feature, implement that feature and stop.

---

# 21. Change Discipline

Before modifying code:

1. Inspect the relevant files.
2. Read the existing implementation.
3. Understand the current architecture.
4. Identify the smallest appropriate change.
5. Follow existing conventions.
6. Avoid unrelated refactoring.

Do not rewrite working code simply because you prefer a different style.

Do not modify unrelated files.

---

# 22. Git Safety

Before significant changes, check:

```bash
git status
```

Do not:

- force push
- reset user changes
- rewrite git history
- delete unrelated files
- overwrite user work
- remove configuration without understanding its purpose

Preserve existing work.

---

# 23. Verification

After implementation, run the relevant checks.

Expected commands:

```bash
npm run lint
npm run test
npm run build
```

If a command does not exist in `package.json`, inspect the available scripts before attempting alternatives.

Do not invent scripts unnecessarily.

For a feature involving HTTP behavior, also run the relevant Supertest tests.

For a feature involving WebSockets, run the relevant WebSocket tests when available.

---

# 24. Reporting

After completing a task, report:

1. What was changed.
2. Important files created or modified.
3. Dependencies added, if any.
4. Verification commands run.
5. Test/lint/build results.
6. Any warnings or unresolved issues.

Be honest about failures.

Do not claim something was verified if it was not actually verified.

---

# 25. Important Rule

## Implement Only What the User Requests

Do not jump ahead.

Do not proactively implement the next feature.

Do not add infrastructure because it may be useful later.

Do not make major architectural decisions silently.

If a requirement is ambiguous and could materially affect the architecture, ask before implementing.

The goal is:

> Clean foundation first. Features incrementally. No premature complexity.