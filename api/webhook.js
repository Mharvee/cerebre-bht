import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.error('Invalid Paystack webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'charge.success') {
    const { reference, amount, customer, metadata } = data;
    const company = metadata?.custom_fields?.[0]?.value || 'Unknown';

    console.log(`✅ Payment confirmed: ₦${amount/100} | ${customer.email} | ${company} | Ref: ${reference}`);
    await db.insert({ reference, email: customer.email, company, amount, paid_at: new Date() });
  }

  return res.status(200).json({ ok: true });
}