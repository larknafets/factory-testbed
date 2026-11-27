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

const post = (base, body) =>
  fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

test('POST /api/tasks answers 201 with id and title', async (t) => {
  const { base } = await start(t);
  const res = await post(base, JSON.stringify({ title: 'Buy milk' }));
  assert.strictEqual(res.status, 201);
  assert.deepStrictEqual(await res.json(), { id: 1, title: 'Buy milk' });
});

test('POST /api/tasks rejects a missing title', async (t) => {
  const { base } = await start(t);
  assert.strictEqual((await post(base, '{}')).status, 400);
});

test('POST /api/tasks rejects invalid JSON', async (t) => {
  const { base } = await start(t);
  assert.strictEqual((await post(base, 'not json')).status, 400);
});

test('GET /api/tasks lists tasks in insertion order', async (t) => {
  const { base } = await start(t);
  for (const title of ['b', 'a', 'c']) await post(base, JSON.stringify({ title }));
  const res = await fetch(`${base}/api/tasks`);
  assert.strictEqual(res.status, 200);
  const list = await res.json();
  assert.deepStrictEqual(list.map((x) => x.title), ['b', 'a', 'c']);
  assert.deepStrictEqual(list.map((x) => x.id), [1, 2, 3]);
});

test('GET / page has the task list and an add form wired to the API', async (t) => {
  const { base } = await start(t);
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<ul id="list">/);
  assert.match(html, /<form id="form">/);
  assert.match(html, /fetch\('\/api\/tasks'/);
  assert.match(html, /method: 'POST'/);
});

test('POST /api/tasks rejects a non-string title', async (t) => {
  const { base } = await start(t);
  assert.strictEqual((await post(base, JSON.stringify({ title: 123 }))).status, 400);
  assert.strictEqual((await post(base, JSON.stringify({ title: ['a'] }))).status, 400);
  assert.strictEqual((await post(base, 'null')).status, 400);
});
