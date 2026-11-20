# factory-testbed

## Project

A tiny task list: a dependency-free Node server (`node:http`) with a JSON data file and one HTML page. It is the test target of the Software Factory and has no other users.

## Commands and layout

- Run: `PORT=3000 node server.js`, health check at `GET /health`
- Check: `npm test` (`node:test`, no install step, no build step)
- `server.js`: the server and its route handlers
- `index.html`: the single page
- `test/`: tests, one HTTP call per behavior
- `data/tasks.json`: task data, created on first write, not committed

## Rules that always apply

- Every route handler is a function named `handle` plus the action in PascalCase, for example `handleAddTask`. Never `getTasks`, `addTask` or `onPost`.
- No dependencies and no build step.

## Read when needed

| When | File |
|---|---|
| Commit rules of this repo | `docs/agents/git-workflow.md` |
