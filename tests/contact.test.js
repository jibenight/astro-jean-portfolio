import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildContactEmail,
  contactSchema,
  verifyTurnstile,
} from '../src/lib/contact.js';

test('normalise et valide les données du formulaire', () => {
  const result = contactSchema.parse({
    name: '  Jean  ',
    email: '  jean@example.com ',
    projectType: 'Site vitrine',
    message: '  Un message suffisamment long.  ',
    website: '',
    turnstileToken: 'token',
  });

  assert.equal(result.name, 'Jean');
  assert.equal(result.email, 'jean@example.com');
  assert.equal(result.message, 'Un message suffisamment long.');
});

test('construit un email texte avec une adresse de réponse', () => {
  const email = buildContactEmail({
    name: 'Jean',
    email: 'jean@example.com',
    projectType: 'Refonte',
    message: 'Bonjour depuis le formulaire.',
  });

  assert.equal(email.replyTo, 'jean@example.com');
  assert.match(email.subject, /Jean/);
  assert.match(email.text, /Type de projet: Refonte/);
});

test('valide le hostname et l’action Turnstile', async () => {
  const fetchImpl = async () =>
    Response.json({
      success: true,
      hostname: 'jean-nguyen.dev',
      action: 'contact',
    });

  const result = await verifyTurnstile({
    secret: 'secret',
    token: 'token',
    expectedHostname: 'jean-nguyen.dev',
    expectedAction: 'contact',
    fetchImpl,
  });
  assert.deepEqual(result, { success: true });

  const wrongAction = await verifyTurnstile({
    secret: 'secret',
    token: 'token',
    expectedHostname: 'jean-nguyen.dev',
    expectedAction: 'login',
    fetchImpl,
  });
  assert.deepEqual(wrongAction, { success: false });
});
