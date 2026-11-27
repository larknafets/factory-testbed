const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function createServer(dataFile) {
  function readTasks() {
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return []; }
  }

  function handleHealth(req, res) {
    send(res, 200, { status: 'ok' });
  }

  function handleListTasks(req, res) {
    send(res, 200, readTasks());
  }

  function handleAddTask(req, res) {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let title;
      try {
        const parsed = JSON.parse(raw);
        title = parsed && typeof parsed.title === 'string' ? parsed.title.trim() : '';
      } catch { title = ''; }
      if (!title) return send(res, 400, { error: 'title required' });
      const tasks = readTasks();
      const task = { id: tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1, title };
      tasks.push(task);
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(tasks, null, 2));
      send(res, 201, task);
    });
  }

  function handleIndex(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }

  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') return handleHealth(req, res);
    if (req.method === 'GET' && req.url === '/api/tasks') return handleListTasks(req, res);
    if (req.method === 'POST' && req.url === '/api/tasks') return handleAddTask(req, res);
    if (req.method === 'GET' && req.url === '/') return handleIndex(req, res);
    send(res, 404, { error: 'not found' });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer(path.join(__dirname, 'data', 'tasks.json')).listen(port, '0.0.0.0', () =>
    console.log(`listening on ${port}`));
}
