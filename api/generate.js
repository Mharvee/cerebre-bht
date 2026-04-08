export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { _meta = {}, ...claudeBody } = body;

    // ── RATE LIMITING ──────────────────────────────────────────
    // We track by IP + email combo. Using Upstash Redis (free tier).
    // If you don't have Redis, the simpler in-memory fallback fires.
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const email = (_meta.email || '').toLowerCase().trim();
    const fingerprint = _meta.fingerprint || 'unknown';

    const rateLimitKey = `cbr:${ip}:${email || fingerprint}`;

    let blocked = false;
    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        // Upstash Redis rate limiting (recommended for production)
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        const WINDOW_SECONDS = 3600;      // 1-hour rolling window
        const MAX_FREE_REQUESTS = 2;       // per IP+email per hour
        const MAX_TOTAL_REQUESTS = 5;      // absolute cap per hour per IP

        const [ipCount, emailCount] = await Promise.all([
          redis.incr(`cbr:ip:${ip}`),
          email ? redis.incr(`cbr:email:${email}`) : Promise.resolve(0),
        ]);

        // Set TTL on first call
        if (ipCount === 1) await redis.expire(`cbr:ip:${ip}`, WINDOW_SECONDS);
        if (emailCount === 1 && email) await redis.expire(`cbr:email:${email}`, WINDOW_SECONDS);

        // Allow paid calls (full reports) through — but cap free abuse
        const isFullReport = claudeBody.max_tokens >= 7000;
        const freeLimit = isFullReport ? MAX_TOTAL_REQUESTS : MAX_FREE_REQUESTS;

        if (ipCount > MAX_TOTAL_REQUESTS || (email && emailCount > freeLimit)) {
          console.log(`Rate limit hit: ip=${ip}, email=${email}, ipCount=${ipCount}, emailCount=${emailCount}`);
          blocked = true;
        }
      }
    } catch (redisErr) {
      // Redis unavailable — log but don't block (fail open for now)
      console.warn('Redis unavailable, skipping rate limit:', redisErr.message);
    }

    if (blocked) {
      return res.status(429).json({
        error: {
          type: 'rate_limit_error',
          message: 'Too many requests from this device. Please wait before trying again, or unlock the full report.'
        }
      });
    }

    // ── LOG REQUEST ────────────────────────────────────────────
    console.log(JSON.stringify({
      t: new Date().toISOString(),
      ip, email, fingerprint,
      company: (claudeBody.messages?.[0]?.content || '').slice(0, 80),
      tokens: claudeBody.max_tokens,
      type: claudeBody.max_tokens >= 7000 ? 'FULL' : 'FREE',
    }));

    // ── FORWARD TO ANTHROPIC ───────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: claudeBody.model || 'claude-sonnet-4-20250514',
        max_tokens: claudeBody.max_tokens || 5000,
        system: claudeBody.system,
        tools: claudeBody.tools || [],
        messages: claudeBody.messages,
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      console.error('Anthropic error:', anthropicRes.status, data);
      return res.status(anthropicRes.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: { message: 'Internal error: ' + err.message } });
  }
}
