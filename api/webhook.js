// api/webhook.js
// Handles Paystack payment confirmations
// Called by Paystack when a payment succeeds

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify the webhook is genuinely from Paystack
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.error('Invalid Paystack signature — possible spoofing attempt');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { reference, amount, customer, metadata } = event.data;

    console.log(`Payment confirmed:
      Reference: ${reference}
      Amount: ₦${amount / 100}
      Customer: ${customer.email}
      Company: ${metadata?.custom_fields?.[0]?.value || 'Unknown'}
    `);

    // ── OPTIONAL: Send confirmation email ──
    // Uncomment and configure if you want email delivery via Resend
    // npm install resend  →  add RESEND_API_KEY to Vercel env vars
    /*
    await sendConfirmationEmail({
      to: customer.email,
      company: metadata?.custom_fields?.[0]?.value,
      reference: reference
    });
    */

    // ── OPTIONAL: Log to database ──
    // e.g. Supabase free tier — recommended for tracking paid reports
    // await db.payments.create({ reference, email: customer.email, amount });

    return res.status(200).json({ status: 'ok' });
  }

  return res.status(200).json({ status: 'ignored' });
}

// ── OPTIONAL: Email sending with Resend ──
/*
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendConfirmationEmail({ to, company, reference }) {
  await resend.emails.send({
    from: 'Cerebré Media Africa <reports@cerebre.africa>',
    to: to,
    subject: `Your Full Brand Health Report — ${company}`,
    html: `
      <h2>Your full report is ready</h2>
      <p>Your payment was confirmed (ref: ${reference}).</p>
      <p>Return to the app — your full ${company} Digital Brand Health Report is now unlocked.</p>
      <p>If you have any issues, reply to this email.</p>
    `
  });
}
*/
