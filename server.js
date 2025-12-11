import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.API_PORT || 3001;
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || '*';

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

app.post('/api/contact', async (req, res) => {
  const { name, email, projectType, message } = req.body || {};

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: 'Nom, email et message sont requis.' });
  }

  if (!SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({
      error:
        'SMTP non configuré (variables SMTP_USER et SMTP_PASS requises dans le .env).',
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        // Empêche certaines erreurs de certificat en local
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      },
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
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `API contact disponible sur http://localhost:${PORT}/api/contact`
  );
});
