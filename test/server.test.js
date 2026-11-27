const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');

async function start(t) {
  const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-')), 'tasks.json');
  const server = createServer(dataFile);
  await new Promise((r) => server.listen(0, r));
  t.after(() => server.close());
  return { base: `http://127.0.0.1:${server.address().port}` };
}

test('GET /health answers ok', async (t) => {
  const { base } = await start(t);
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: 'ok' });
});

test('POST /api/tasks adds a task and GET /api/tasks lists it', async (t) => {
  const { base } = await start(t);
  assert.deepStrictEqual(await (await fetch(`${base}/api/tasks`)).json(), []);
  const res = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Buy milk' }),
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual((await res.json()).title, 'Buy milk');
  const list = await (await fetch(`${base}/api/tasks`)).json();
  assert.deepStrictEqual(list.map((t) => t.title), ['Buy milk']);
});

test('POST /api/tasks rejects an empty title', async (t) => {
  const { base } = await start(t);
  const res = await fetch(`${base}/api/tasks`, { method: 'POST', body: JSON.stringify({ title: '  ' }) });
  assert.strictEqual(res.status, 400);
});

test('GET / serves the HTML page', async (t) => {
  const { base } = await start(t);
  const res = await fetch(`${base}/`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /<h1>Tasks<\/h1>/);
});

async function addTask(base, title) {
  return (await fetch(`${base}/api/tasks`, { method: 'POST', body: JSON.stringify({ title }) })).json();
}

test('GET /api/tasks/<id> shares a task with its title', async (t) => {
  const { base } = await start(t);
  const task = await addTask(base, 'Buy milk');
  const res = await fetch(`${base}/api/tasks/${task.id}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { id: task.id, title: 'Buy milk' });
});

test('GET /api/tasks/<id> answers 404 for an unknown id', async (t) => {
  const { base } = await start(t);
  const res = await fetch(`${base}/api/tasks/99`);
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(await res.json(), { error: 'not found' });
});

test('GET /api/tasks/<id> answers 404 for a non-numeric id', async (t) => {
  const { base } = await start(t);
  assert.strictEqual((await fetch(`${base}/api/tasks/abc`)).status, 404);
});

test('DELETE /api/tasks/<id> answers 404 and keeps the task', async (t) => {
  const { base } = await start(t);
  const task = await addTask(base, 'Keep me');
  const res = await fetch(`${base}/api/tasks/${task.id}`, { method: 'DELETE' });
  assert.strictEqual(res.status, 404);
  const list = await (await fetch(`${base}/api/tasks`)).json();
  assert.deepStrictEqual(list, [task]);
});
