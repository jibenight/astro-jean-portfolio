import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildContactEmail,
  contactSchema,
  verifyTurnstile,
} from './src/lib/contact.js';

export const app = express();
app.disable('x-powered-by');

const isPassenger = typeof globalThis.PhusionPassenger !== 'undefined';
if (isPassenger) {
  globalThis.PhusionPassenger.configure({ autoInstall: false });
}

const PORT = process.env.PORT || process.env.API_PORT || 3001;
const ALLOWED_ORIGINS = new Set(
  (process.env.CLIENT_ORIGIN || 'http://localhost:4321,http://127.0.0.1:4321')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

if (process.env.TRUST_PROXY) {
  const trustProxy = Number(process.env.TRUST_PROXY);
  app.set(
    'trust proxy',
    Number.isInteger(trustProxy)
      ? trustProxy
      : process.env.TRUST_PROXY === 'true',
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

// Configuration SMTP (valeurs par défaut pour iCloud si non définies dans le .env)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;
const TO_EMAIL = process.env.TO_EMAIL;

const smtpSecure = process.env.SMTP_SECURE;
const transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS && FROM_EMAIL && TO_EMAIL
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: smtpSecure === 'ssl' || smtpSecure === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        ...(smtpSecure === 'starttls' && { requireTLS: true }),
      })
    : null;

app.use(express.json({ limit: '16kb', type: 'application/json' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  const origin = req.headers.origin;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const requestProtocol =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]
      : req.protocol;
  const sameOrigin = origin === `${requestProtocol}://${req.headers.host}`;

  if (origin && !sameOrigin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Origine non autorisée.' });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Servir le build Astro (dossier dist) pour la mise en production
app.use(express.static(DIST_DIR));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requêtes par IP par fenêtre
  message: { error: 'Trop de messages envoyés. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Les informations saisies sont invalides.' });
  }

  const { website, turnstileToken } = parsed.data;
  if (website) {
    return res.json({ status: 'ok' });
  }

  if (process.env.TURNSTILE_SECRET_KEY) {
    const verification = await verifyTurnstile({
      secret: process.env.TURNSTILE_SECRET_KEY,
      token: turnstileToken,
      remoteIp: req.ip,
      expectedHostname: req.hostname,
      expectedAction: 'contact',
    });
    if (!verification.success) {
      return res.status(403).json({
        error: 'La vérification anti-spam a échoué. Réessayez.',
      });
    }
  }

  if (!transporter) {
    return res.status(500).json({
      error: 'Service de contact temporairement indisponible.',
    });
  }

  try {
    const contactEmail = buildContactEmail(parsed.data);
    const mailOptions = {
      from: FROM_EMAIL,
      to: TO_EMAIL,
      ...contactEmail,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Email envoyé avec succès:', info.messageId);
    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Erreur envoi mail:', err);
    return res.status(500).json({
      error: "Erreur lors de l'envoi du message.",
    });
  }
});

// Fallback : renvoyer l'index Astro pour les routes non API
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(DIST_DIR, 'index.html'));
});

const startServer = () => {
  if (isPassenger) {
    app.listen('passenger');
    console.log(
      'Serveur lancé avec Phusion Passenger — build statique /dist et API /api/contact',
    );
  } else {
    app.listen(PORT, () => {
      console.log(
        `Serveur en ligne : build statique servi depuis /dist et API contact sur http://localhost:${PORT}/api/contact`,
      );
    });
  }
};

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isPassenger || isMainModule) {
  startServer();
}
