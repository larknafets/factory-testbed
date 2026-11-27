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

test('GET /api/tasks/<id> shows a shared task read-only', async (t) => {
  const { base } = await start(t);
  await fetch(`${base}/api/tasks`, { method: 'POST', body: JSON.stringify({ title: 'Buy milk' }) });
  const res = await fetch(`${base}/api/tasks/1`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { id: 1, title: 'Buy milk' });
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    assert.strictEqual((await fetch(`${base}/api/tasks/1`, { method })).status, 404);
  }
});

test('GET /api/tasks/<id> answers 404 for unknown and non-numeric ids', async (t) => {
  const { base } = await start(t);
  assert.strictEqual((await fetch(`${base}/api/tasks/99`)).status, 404);
  assert.strictEqual((await fetch(`${base}/api/tasks/abc`)).status, 404);
});
