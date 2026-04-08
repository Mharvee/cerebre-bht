import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// ── POST /api/webhook ──
// Note: express.raw() is applied in server.js BEFORE express.json(),
// so req.body here is a Buffer — we must call JSON.parse on it ourselves.
router.post('/', async (req, res) => {
  try {
    // req.body is a Buffer because of express.raw() in server.js
    const rawBody = req.body;

    const sig  = req.headers['x-paystack-signature'];
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(rawBody)
      .digest('hex');

    if (!sig || hash !== sig) {
      console.error('[webhook] Invalid Paystack signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const { event, data } = payload;

    if (event === 'charge.success') {
      const { reference, amount, customer, metadata } = data;
      const company = metadata?.custom_fields?.find(f => f.variable_name === 'company')?.value
                    || metadata?.custom_fields?.[0]?.value
                    || 'Unknown';

      const record = {
        reference,
        email:    customer.email,
        company,
        amount:   amount / 100,   // kobo → Naira
        currency: 'NGN',
        paid_at:  new Date().toISOString(),
      };

      console.log(`✅ Payment confirmed: ₦${record.amount} | ${record.email} | ${record.company} | Ref: ${reference}`);

      // ── Persist to Upstash Redis (optional) ──────────────
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        try {
          const { Redis } = await import('@upstash/redis');
          const redis = new Redis({
            url:   process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
          await redis.set(`payment:${reference}`, JSON.stringify(record), { ex: 90 * 86400 });
          await redis.sadd('paid_emails', customer.email.toLowerCase());
          console.log(`[webhook] Stored payment:${reference} in Redis`);
        } catch (redisErr) {
          console.error('[webhook] Redis write failed (non-fatal):', redisErr.message);
        }
      }

      // ── Notify business owner via Resend (optional) ──────
      if (process.env.RESEND_API_KEY && process.env.BUSINESS_EMAIL) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from:    process.env.FROM_EMAIL || 'Cerebré <reports@cerebre.africa>',
            to:      process.env.BUSINESS_EMAIL,
            subject: `💰 New Payment — ₦${record.amount.toLocaleString()} | ${record.company}`,
            html: `
              <h2 style="font-family:Georgia,serif;color:#0D1B2A">New Full Report Payment</h2>
              <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
                <tr><td style="padding:8px 20px 8px 0;color:#666">Reference</td><td style="padding:8px 0;font-weight:600">${reference}</td></tr>
                <tr><td style="padding:8px 20px 8px 0;color:#666">Amount</td><td style="padding:8px 0;font-weight:600;color:#276749">₦${record.amount.toLocaleString()}</td></tr>
                <tr><td style="padding:8px 20px 8px 0;color:#666">Client</td><td style="padding:8px 0">${record.email}</td></tr>
                <tr><td style="padding:8px 20px 8px 0;color:#666">Company</td><td style="padding:8px 0;font-weight:600">${record.company}</td></tr>
                <tr><td style="padding:8px 20px 8px 0;color:#666">Paid At</td><td style="padding:8px 0">${record.paid_at}</td></tr>
              </table>`,
          });
        } catch (emailErr) {
          console.error('[webhook] Owner notification failed (non-fatal):', emailErr.message);
        }
      }
    }

    // Always return 200 quickly — Paystack retries on non-2xx
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[webhook] error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
