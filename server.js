import express from 'express';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.API_PORT || 3001;
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:4321';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const TO_EMAIL = process.env.TO_EMAIL || 'message@jean-nguyen.dev';
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'no-reply@localhost';

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.post('/api/contact', (req, res) => {
  const { name, email, projectType, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Nom, email et message sont requis.' });
  }

  console.log('--- Nouveau message de contact ---');
  console.log(`Nom: ${name}`);
  console.log(`Email: ${email}`);
  console.log(`Type de projet: ${projectType || 'N/A'}`);
  console.log(`Message: ${message}`);
  console.log('-----------------------------------');

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res
      .status(500)
      .json({ error: 'SMTP non configuré (variables SMTP_HOST, SMTP_USER, SMTP_PASS requises).' });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const mailOptions = {
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: `Contact portfolio — ${name}`,
    replyTo: email,
    text: [
      `Nom: ${name}`,
      `Email: ${email}`,
      `Type de projet: ${projectType || 'N/A'}`,
      '',
      'Message :',
      message,
    ].join('\n'),
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Erreur envoi mail:', err);
      return res.status(500).json({ error: 'Erreur lors de lenvoi du message.' });
    }

    console.log('Email envoyé:', info.messageId || info.response);
    return res.json({ status: 'ok' });
  });

});

app.listen(PORT, () => {
  console.log(`API contact disponible sur http://localhost:${PORT}/api/contact`);
});
