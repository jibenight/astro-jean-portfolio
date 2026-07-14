import { z } from 'zod';

export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().max(254).pipe(z.email()),
    projectType: z
      .enum([
        'Site vitrine',
        'E-commerce',
        'Refonte',
        'Application web',
        'Autre',
      ])
      .optional()
      .or(z.literal('')),
    message: z.string().trim().min(10).max(5000),
    website: z.string().max(200).optional(),
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

export const buildContactEmail = ({ name, email, projectType, message }) => ({
  subject: `Contact portfolio — ${name}`,
  replyTo: email,
  text: [
    `Nom: ${name}`,
    `Email: ${email}`,
    `Type de projet: ${projectType || 'Non spécifié'}`,
    '',
    'Message :',
    message,
  ].join('\n'),
});

export async function verifyTurnstile({
  secret,
  token,
  remoteIp,
  expectedHostname,
  expectedAction,
  fetchImpl = fetch,
}) {
  if (!secret || !token) return { success: false };

  try {
    const response = await fetchImpl(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          response: token,
          ...(remoteIp && { remoteip: remoteIp }),
        }),
      },
    );
    if (!response.ok) return { success: false };

    const result = await response.json();
    if (
      !result.success ||
      (expectedHostname && result.hostname !== expectedHostname) ||
      (expectedAction && result.action !== expectedAction)
    ) {
      return { success: false };
    }

    return { success: true };
  } catch {
    return { success: false };
  }
}
