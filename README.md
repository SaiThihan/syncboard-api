# SyncBoard API

The server for SyncBoard, a real-time collaborative whiteboard. NestJS, TypeScript and Socket.IO. Everything lives in memory: no database, no accounts. A board with nobody on it is deleted after 30 minutes.

The browser app is a separate repository, `syncboard-web`.

## Run it

```bash
npm install
npm run start:dev      # http://localhost:3000, restarts on changes
```

| Variable      | Default                 | Meaning                                     |
| ------------- | ----------------------- | ------------------------------------------- |
| `PORT`        | `3000`                  | Port to listen on                           |
| `CORS_ORIGIN` | `http://localhost:5173` | The one web address allowed to call the API |

The API has no `.env` loader. Set the variables in front of the command, or copy `.env.example` to `.env` and run `node --env-file=.env dist/main.js` after `npm run build`.

## Scripts

| Command              | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `npm run build`      | Compile to `dist/`                                     |
| `npm run start:prod` | Run the compiled build                                 |
| `npm test`           | Unit tests (Jest)                                      |
| `npm run test:e2e`   | HTTP and WebSocket tests (Supertest, Socket.IO client) |
| `npm run test:cov`   | Unit tests with a coverage report                      |
| `npm run lint`       | ESLint                                                 |

## REST

| Request               | Reply                            |
| --------------------- | -------------------------------- |
| `POST /api/boards`    | `201 { id }`: a new board        |
| `GET /api/boards/:id` | `200 { id, createdAt }` or `404` |
| `GET /api/health`     | `200`                            |

Every error has the same shape: `{ statusCode, code, message }`.

## Socket.IO

A client joins one board with `board:join`, then sends changes. Every message with a reply gets `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

| Client sends                      | Server sends to the others              |
| --------------------------------- | --------------------------------------- |
| `board:join { boardId, user }`    | `presence:joined { user }`              |
| `object:add { object }`           | `object:added { object }`               |
| `object:update { id, patch }`     | `object:updated { id, patch, version }` |
| `object:delete { id }`            | `object:deleted { id }`                 |
| `cursor:move { x, y }` (no reply) | `cursor:moved { userId, x, y }`         |
| (connection closes)               | `presence:left { userId }`              |

The server decides the author and the version of every shape, and takes the board and user from what it recorded at join, never from a message. A shape's `version` goes up by one on each change, so a client can ignore anything older than what it has.

Error codes: `VALIDATION_FAILED`, `NOT_JOINED`, `ALREADY_JOINED`, `BOARD_NOT_FOUND`, `OBJECT_NOT_FOUND`, `DUPLICATE_OBJECT`, `BOARD_FULL`, `BOARD_LIMIT`, `NOT_FOUND`, `INTERNAL`.

## Limits

Defined in `src/common/limits/limits.ts`: 5,000 shapes per board, 100,000 pen points per board, 1,000 boards, 1 MB per message, names up to 30 characters, text up to 1,000 characters.

## Layout

```
src/
  boards/     controller (REST), gateway (Socket.IO), service (the rules), dto, events, types
  presence/   who is on which board
  common/     errors, acknowledgements, limits, WebSocket error filter
test/         end-to-end tests (unit tests are in test/unit)
```
