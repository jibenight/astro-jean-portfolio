import {
  buildContactEmail,
  contactSchema,
  verifyTurnstile,
} from '../src/lib/contact.js';

const MAX_BODY_BYTES = 16 * 1024;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'SAMEORIGIN',
};

const jsonResponse = (body, status = 200, headers = {}) =>
  Response.json(body, {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS, ...headers },
  });

const allowedOrigins = (value = '') =>
  new Set(
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return {};

  const requestOrigin = new URL(request.url).origin;
  if (
    origin !== requestOrigin &&
    !allowedOrigins(env.CLIENT_ORIGIN).has(origin)
  ) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

async function parseJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_BODY_BYTES) return null;

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

async function rateLimitKey(request, email) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const source = new TextEncoder().encode(`${email.toLowerCase()}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', source);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function contactIdempotencyKey(data) {
  const source = new TextEncoder().encode(
    [data.name, data.email, data.projectType, data.message].join('\n'),
  );
  const digest = await crypto.subtle.digest('SHA-256', source);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `contact-${hash}`;
}

export async function sendContactWithResend({ env, data, fetchImpl = fetch }) {
  const message = buildContactEmail(data);
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': await contactIdempotencyKey(data),
    },
    body: JSON.stringify({
      from: `Portfolio Jean Nguyen <${env.FROM_EMAIL}>`,
      to: [env.TO_EMAIL],
      reply_to: message.replyTo,
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!response.ok) {
    let errorName = 'unknown_error';
    let errorMessage = '';
    try {
      const body = await response.json();
      if (typeof body?.name === 'string') errorName = body.name;
      if (typeof body?.message === 'string') {
        errorMessage = body.message.replace(/\s+/g, ' ').slice(0, 300);
      }
    } catch {
      // La réponse Resend peut être vide lors d'une panne en amont.
    }
    throw new Error(
      `Resend ${response.status}: ${errorName}${errorMessage ? ` — ${errorMessage}` : ''}`,
    );
  }
}

export async function handleContactRequest(
  request,
  env,
  { fetchImpl = fetch } = {},
) {
  const cors = corsHeaders(request, env);
  if (cors === null) {
    return jsonResponse({ error: 'Origine non autorisée.' }, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...SECURITY_HEADERS, ...cors },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405, {
      ...cors,
      Allow: 'POST, OPTIONS',
    });
  }

  if (!request.headers.get('Content-Type')?.includes('application/json')) {
    return jsonResponse(
      { error: 'Le corps de la requête doit être au format JSON.' },
      415,
      cors,
    );
  }

  const body = await parseJsonBody(request);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Les informations saisies sont invalides.' },
      400,
      cors,
    );
  }

  if (parsed.data.website) {
    return jsonResponse({ status: 'ok' }, 200, cors);
  }

  if (!env.CONTACT_RATE_LIMITER) {
    console.error('Binding CONTACT_RATE_LIMITER manquant.');
    return jsonResponse(
      { error: 'Service de contact temporairement indisponible.' },
      500,
      cors,
    );
  }

  const key = await rateLimitKey(request, parsed.data.email);
  const { success: withinLimit } = await env.CONTACT_RATE_LIMITER.limit({
    key,
  });
  if (!withinLimit) {
    return jsonResponse(
      { error: 'Trop de messages envoyés. Réessayez dans une minute.' },
      429,
      { ...cors, 'Retry-After': '60' },
    );
  }

  if (env.TURNSTILE_REQUIRED === 'true') {
    if (!env.TURNSTILE_SECRET_KEY) {
      console.error('Secret TURNSTILE_SECRET_KEY manquant.');
      return jsonResponse(
        { error: 'Service de contact temporairement indisponible.' },
        500,
        cors,
      );
    }

    const verification = await verifyTurnstile({
      secret: env.TURNSTILE_SECRET_KEY,
      token: parsed.data.turnstileToken,
      remoteIp: request.headers.get('CF-Connecting-IP'),
      expectedHostname: new URL(request.url).hostname,
      expectedAction: 'contact',
      fetchImpl,
    });
    if (!verification.success) {
      return jsonResponse(
        { error: 'La vérification anti-spam a échoué. Réessayez.' },
        403,
        cors,
      );
    }
  }

  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.TO_EMAIL) {
    console.error('Configuration Resend incomplète.');
    return jsonResponse(
      { error: 'Service de contact temporairement indisponible.' },
      500,
      cors,
    );
  }

  try {
    await sendContactWithResend({
      env,
      data: parsed.data,
      fetchImpl,
    });
    return jsonResponse({ status: 'ok' }, 200, cors);
  } catch (error) {
    console.error(
      'Échec Resend:',
      error instanceof Error ? error.message : 'Erreur inconnue',
    );
    return jsonResponse(
      { error: "Erreur lors de l'envoi du message." },
      500,
      cors,
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.hostname === 'www.jean-nguyen.dev' &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      url.hostname = 'jean-nguyen.dev';
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === '/api/contact') {
      return handleContactRequest(request, env);
    }

    if (!env.ASSETS) return new Response('Not Found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
