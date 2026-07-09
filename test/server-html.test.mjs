import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';

test('root page shows only the calendar image in a Kindle-friendly viewport', async () => {
  const port = String(3200 + Math.floor(Math.random() * 1000));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: port,
      REFRESH_SECONDS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server, port);

    const response = await fetch(`http://127.0.0.1:${port}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<meta http-equiv="refresh" content="10800">/);
    assert.match(html, /html,body\{[^}]*height:100%[^}]*overflow:hidden/);
    assert.match(html, /img\{[^}]*width:100vw[^}]*height:100vh[^}]*object-fit:contain/);
  } finally {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
  }
});

async function waitForServer(server, port) {
  const deadline = Date.now() + 5000;
  let lastError;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`server exited early with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch (err) {
      lastError = err;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError ?? new Error('server did not start');
}
