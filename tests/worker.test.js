import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { handleContactRequest } from '../worker/index.js';

const validPayload = {
  name: 'Jean',
  email: 'jean@example.com',
  projectType: 'Autre',
  message: 'Ceci est un message de test suffisamment long.',
  website: '',
  turnstileToken: '',
};

const makeRequest = (body = validPayload, options = {}) =>
  new Request('https://jean-nguyen.dev/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://jean-nguyen.dev',
      'CF-Connecting-IP': '203.0.113.10',
      ...options.headers,
    },
    body: JSON.stringify(body),
  });

const makeEnv = (overrides = {}) => {
  const sent = [];
  const fetchImpl = async (url, options) => {
    sent.push({
      url,
      headers: new Headers(options.headers),
      body: JSON.parse(options.body),
    });
    return Response.json({ id: 'email-test-id' });
  };

  return {
    env: {
      CLIENT_ORIGIN: 'https://jean-nguyen.dev',
      FROM_EMAIL: 'contact@send.jean-nguyen.dev',
      TO_EMAIL: 'contact@jean-nguyen.dev',
      RESEND_API_KEY: 're_test_key',
      TURNSTILE_REQUIRED: 'false',
      CONTACT_RATE_LIMITER: {
        limit: async () => ({ success: true }),
      },
      ASSETS: {
        fetch: async () => new Response('asset'),
      },
      ...overrides,
    },
    sent,
    fetchImpl,
  };
};

test('délègue les routes statiques au binding ASSETS', async () => {
  const { env } = makeEnv();
  const response = await worker.fetch(
    new Request('https://jean-nguyen.dev/'),
    env,
  );
  assert.equal(await response.text(), 'asset');
});

test('redirige www vers le domaine canonique en conservant l’URL', async () => {
  const { env } = makeEnv();
  const response = await worker.fetch(
    new Request(
      'https://www.jean-nguyen.dev/projets/get-password/?source=test',
    ),
    env,
  );
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('Location'),
    'https://jean-nguyen.dev/projets/get-password/?source=test',
  );
});

test('refuse les origines inconnues', async () => {
  const { env } = makeEnv();
  const response = await handleContactRequest(
    makeRequest(validPayload, {
      headers: { Origin: 'https://evil.example' },
    }),
    env,
  );
  assert.equal(response.status, 403);
});

test('neutralise le honeypot sans envoyer d’email', async () => {
  const { env, sent } = makeEnv();
  const response = await handleContactRequest(
    makeRequest({ ...validPayload, website: 'robot' }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(sent.length, 0);
});

test('applique le rate limiting Cloudflare', async () => {
  const { env, sent } = makeEnv({
    CONTACT_RATE_LIMITER: {
      limit: async () => ({ success: false }),
    },
  });
  const response = await handleContactRequest(makeRequest(), env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(sent.length, 0);
});

test('envoie un message avec l’API Resend', async () => {
  const { env, sent, fetchImpl } = makeEnv();
  const response = await handleContactRequest(makeRequest(), env, {
    fetchImpl,
  });
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://api.resend.com/emails');
  assert.equal(sent[0].body.reply_to, 'jean@example.com');
  assert.equal(
    sent[0].body.from,
    'Portfolio Jean Nguyen <contact@send.jean-nguyen.dev>',
  );
  assert.deepEqual(sent[0].body.to, ['contact@jean-nguyen.dev']);
  assert.equal(sent[0].headers.get('Authorization'), 'Bearer re_test_key');
  assert.match(
    sent[0].headers.get('Idempotency-Key'),
    /^contact-[a-f0-9]{64}$/,
  );
});

test('renvoie une erreur générique lorsque Resend refuse le message', async () => {
  const { env } = makeEnv();
  const response = await handleContactRequest(makeRequest(), env, {
    fetchImpl: async () =>
      Response.json({ name: 'validation_error' }, { status: 422 }),
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "Erreur lors de l'envoi du message.",
  });
});

test('échoue sans clé Resend', async () => {
  const { env } = makeEnv({ RESEND_API_KEY: '' });
  const response = await handleContactRequest(makeRequest(), env);
  assert.equal(response.status, 500);
});

test('échoue sans secret lorsque Turnstile est obligatoire', async () => {
  const { env, sent } = makeEnv({ TURNSTILE_REQUIRED: 'true' });
  const response = await handleContactRequest(makeRequest(), env);
  assert.equal(response.status, 500);
  assert.equal(sent.length, 0);
});
