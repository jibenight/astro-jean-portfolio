import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.CLIENT_ORIGIN = 'http://localhost:4321';

const { app } = await import('../server.js');

let server;
let baseUrl;

before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const postContact = (body, origin = 'http://localhost:4321') =>
  fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify(body),
  });

test('refuse une origine inconnue', async () => {
  const response = await postContact({}, 'https://evil.example');
  assert.equal(response.status, 403);
});

test('refuse une saisie invalide sans exposer les détails', async () => {
  const response = await postContact({});
  assert.equal(response.status, 400);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:4321',
  );
  assert.deepEqual(await response.json(), {
    error: 'Les informations saisies sont invalides.',
  });
});

test('neutralise silencieusement le spam détecté par le honeypot', async () => {
  const response = await postContact({
    name: 'Test',
    email: 'test@example.com',
    projectType: 'Autre',
    message: 'Ceci est un message de test suffisamment long.',
    website: 'robot',
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
