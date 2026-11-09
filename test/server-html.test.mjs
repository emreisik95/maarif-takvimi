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

test('landscape preview endpoints return each 800x600 grayscale design without changing the default image', async () => {
  const port = String(4200 + Math.floor(Math.random() * 1000));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, CALENDAR_ICS_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server, port);

    for (const variant of ['balanced', 'date-focus', 'agenda-focus']) {
      const response = await fetch(`http://127.0.0.1:${port}/image-landscape/${variant}.png`);
      const png = Buffer.from(await response.arrayBuffer());

      assert.equal(response.status, 200, variant);
      assert.match(response.headers.get('content-type') ?? '', /^image\/png/);
      assert.equal(png.readUInt32BE(16), 800, variant);
      assert.equal(png.readUInt32BE(20), 600, variant);
      assert.equal(png[24], 8, variant);
      assert.equal(png[25], 0, variant);
    }

    const invalid = await fetch(`http://127.0.0.1:${port}/image-landscape/unknown.png`);
    assert.equal(invalid.status, 404);

    const automatic = await fetch(`http://127.0.0.1:${port}/image-landscape/auto.png`);
    const automaticPng = Buffer.from(await automatic.arrayBuffer());
    assert.equal(automatic.status, 200);
    assert.equal(automatic.headers.get('x-maarif-layout'), 'agenda-focus');
    assert.equal(automaticPng.readUInt32BE(16), 800);
    assert.equal(automaticPng.readUInt32BE(20), 600);

    const defaultImage = await fetch(`http://127.0.0.1:${port}/image.png`);
    const portrait = Buffer.from(await defaultImage.arrayBuffer());
    assert.equal(portrait.readUInt32BE(16), 600);
    assert.equal(portrait.readUInt32BE(20), 800);
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
