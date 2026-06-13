import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.set('trust proxy', 1);

const isPassenger = typeof globalThis.PhusionPassenger !== 'undefined';
if (isPassenger) {
  globalThis.PhusionPassenger.configure({ autoInstall: false });
}

const PORT = process.env.PORT || process.env.API_PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

// Configuration SMTP (valeurs par défaut pour iCloud si non définies dans le .env)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const TO_EMAIL = process.env.TO_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;
const smtpSecure = process.env.SMTP_SECURE;
const isSecure = smtpSecure === 'ssl' || smtpSecure === 'true';

const transporter = (SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: isSecure,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
      ...(smtpSecure === 'starttls' && { requireTLS: true }),
    })
  : null;

// Vérification SMTP au démarrage (best-effort log)
if (transporter) {
  transporter.verify().then(
    () => console.log('SMTP prêt'),
    (err) => console.warn('SMTP verify a échoué:', err?.message || err)
  );
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-inline' nécessaire : scripts Astro is:inline pour partage de state via window
        scriptSrc: ["'self'", "'unsafe-inline'"],
        // 'unsafe-inline' nécessaire : styles inline d'Astro
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: '20kb' }));

const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Servir le build Astro (dossier dist) pour la mise en production
app.use(express.static(DIST_DIR, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requêtes par IP par fenêtre
  message: { error: 'Trop de messages envoyés. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, projectType, message } = req.body || {};

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: 'Nom, email et message sont requis.' });
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  if (name.length > 100 || email.length > 254 || message.length > 5000 || (projectType && projectType.length > 100)) {
    return res.status(400).json({ error: 'Un ou plusieurs champs dépassent la longueur maximale autorisée.' });
  }

  // Protection CRLF : empêche l'injection d'en-têtes
  if (/[\r\n]/.test(name) || /[\r\n]/.test(email) || /[\r\n]/.test(projectType || '')) {
    return res.status(400).json({ error: 'Caractères invalides.' });
  }

  // Liste blanche des types de projet
  const ALLOWED_PROJECT_TYPES = ['', 'Site vitrine', 'E-commerce', 'Refonte', 'Application web'];
  if (projectType && !ALLOWED_PROJECT_TYPES.includes(projectType)) {
    return res.status(400).json({ error: 'Type de projet invalide.' });
  }

  // Honeypot: bots remplissent ce champ, humains non
  if (req.body.website) {
    return res.json({ status: 'ok' });  // silent accept
  }

  if (!transporter) {
    return res.status(500).json({
      error:
        'SMTP non configuré (variables SMTP_USER et SMTP_PASS requises dans le .env).',
    });
  }

  try {
    const mailOptions = {
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email,
      subject: `Contact portfolio — ${name}`,
      text: [
        `Nom: ${name}`,
        `Email: ${email}`,
        `Type de projet: ${projectType || 'Non spécifié'}`,
        '',
        'Message :',
        message,
      ].join('\n'),
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

// Fallback : renvoyer l'index Astro pour les routes non API (et hors assets)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (/\.[a-z0-9]+$/i.test(req.path) && !req.path.endsWith('.html')) return next();
  return res.sendFile(path.join(DIST_DIR, 'index.html'));
});

const startServer = () => {
  if (isPassenger) {
    app.listen('passenger');
    console.log(
      'Serveur lancé avec Phusion Passenger — build statique /dist et API /api/contact'
    );
  } else {
    app.listen(PORT, () => {
      console.log(
        `Serveur en ligne : build statique servi depuis /dist et API contact sur http://localhost:${PORT}/api/contact`
      );
    });
  }
};

startServer();
