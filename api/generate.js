import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// ═══════════════════════════════════════════════════════════════
//  HOW THE WEB SEARCH BETA ACTUALLY WORKS (web-search-2025-03-05)
//
//  This is a SERVER-SIDE tool. Anthropic runs ALL searches internally
//  during a SINGLE API call. You do NOT need an agentic loop at all.
//
//  One call → Claude searches → Claude writes → stop_reason="end_turn"
//
//  The old multi-turn loop was wrong: it accumulated encrypted search
//  results (each ~30k tokens) across 12 turns = 360k+ wasted tokens,
//  which left almost no room for Claude to write the actual JSON output.
// ═══════════════════════════════════════════════════════════════

async function callClaude(claudeBody) {
  const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta':    'web-search-2025-03-05',
  };

  const body = {
    model:      claudeBody.model      || 'claude-sonnet-4-20250514',
    max_tokens: claudeBody.max_tokens || 5000,
    system:     claudeBody.system,
    tools:      claudeBody.tools      || [],
    messages:   claudeBody.messages   || [],
  };

  console.log(`[generate] Calling Anthropic API — model=${body.model} max_tokens=${body.max_tokens}`);

  const anthropicRes = await fetch(ANTHROPIC_URL, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });

  const data = await anthropicRes.json();

  if (!anthropicRes.ok) {
    console.error('[generate] Anthropic error:', anthropicRes.status, JSON.stringify(data));
    const err = new Error(data.error?.message || `Anthropic ${anthropicRes.status}`);
    err.status  = anthropicRes.status;
    err.apiData = data;
    throw err;
  }

  const { stop_reason, content = [] } = data;

  console.log(`[generate] stop_reason=${stop_reason} blocks=${content.length} output_tokens=${data.usage?.output_tokens}`);

  // Extract all text blocks — web search results are handled internally by Anthropic
  const textBlocks = content.filter(b => b.type === 'text');
  const fullText   = textBlocks.map(b => b.text).join('');

  console.log(`[generate] textLen=${fullText.length} preview=${fullText.slice(0, 200)}`);

  return {
    id:          data.id,
    type:        'message',
    role:        'assistant',
    content:     [{ type: 'text', text: fullText }],
    stop_reason: data.stop_reason,
    model:       data.model,
    usage:       data.usage,
  };
}

// ── Rate limiting via Upstash Redis (optional — fails open if absent) ──
async function checkRateLimit(ip, email, isFullReport) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return false;
  }
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const WINDOW    = 3600;
    const IP_CAP    = 5;
    const EMAIL_CAP = isFullReport ? 5 : 2;

    const [ipCount, emailCount] = await Promise.all([
      redis.incr(`cbr:ip:${ip}`),
      email ? redis.incr(`cbr:email:${email}`) : Promise.resolve(0),
    ]);

    if (ipCount    === 1) await redis.expire(`cbr:ip:${ip}`,       WINDOW);
    if (emailCount === 1 && email) await redis.expire(`cbr:email:${email}`, WINDOW);

    return ipCount > IP_CAP || (email && emailCount > EMAIL_CAP);
  } catch (err) {
    console.warn('[generate] Redis unavailable — skipping rate limit:', err.message);
    return false;
  }
}

// ── POST /api/generate ──
router.post('/', async (req, res) => {
  try {
    const { _meta = {}, ...claudeBody } = req.body || {};

    if (!claudeBody.messages || !claudeBody.model) {
      return res.status(400).json({ error: { message: 'Missing required fields: messages, model' } });
    }

    const ip           = ((req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]).trim();
    const email        = (_meta.email || '').toLowerCase().trim();
    const fingerprint  = _meta.fingerprint || 'unknown';
    const isFullReport = (claudeBody.max_tokens || 0) >= 7000;

    const blocked = await checkRateLimit(ip, email, isFullReport);
    if (blocked) {
      return res.status(429).json({
        error: {
          type:    'rate_limit_error',
          message: 'Too many requests from this device. Please wait before trying again.',
        },
      });
    }

    console.log(JSON.stringify({
      t:          new Date().toISOString(),
      ip, email, fingerprint,
      type:       isFullReport ? 'FULL' : 'FREE',
      tokens:     claudeBody.max_tokens,
      company:    (claudeBody.messages?.[0]?.content || '').slice(0, 80),
    }));

    const result = await callClaude(claudeBody);
    return res.status(200).json(result);

  } catch (err) {
    console.error('[generate] handler error:', err);
    if (err.apiData) return res.status(err.status || 500).json(err.apiData);
    return res.status(500).json({ error: { message: 'Internal error: ' + err.message } });
  }
});

export default router;
