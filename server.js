import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const isPassenger = typeof globalThis.PhusionPassenger !== 'undefined';
if (isPassenger) {
  globalThis.PhusionPassenger.configure({ autoInstall: false });
}

const PORT = process.env.PORT || process.env.API_PORT || 3001;
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

// Configuration SMTP (valeurs par défaut pour iCloud si non définies dans le .env)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const TO_EMAIL = process.env.TO_EMAIL;

app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin || ALLOWED_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', origin);
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

  if (!SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({
      error:
        'SMTP non configuré (variables SMTP_USER et SMTP_PASS requises dans le .env).',
    });
  }

  try {
    const smtpSecure = process.env.SMTP_SECURE;
    const isSecure = smtpSecure === 'ssl' || smtpSecure === 'true';

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: isSecure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      ...(smtpSecure === 'starttls' && { requireTLS: true }),
    });

    const mailOptions = {
      from: SMTP_USER,
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

    await transporter.verify();
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
