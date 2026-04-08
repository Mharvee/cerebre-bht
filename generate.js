import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// ═══════════════════════════════════════════════════════════════
//  runAgentLoop — drives the full Anthropic tool-use loop.
//
//  Web search flow:
//    Turn 1 → Claude returns stop_reason="tool_use" + tool_use blocks
//    Turn 2 → We feed back empty tool_result blocks
//    Turn N → Claude returns stop_reason="end_turn" + final JSON text
// ═══════════════════════════════════════════════════════════════
async function runAgentLoop(claudeBody, maxTurns = 12) {
  const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta':    'web-search-2025-03-05',
  };

  let messages  = [...(claudeBody.messages || [])];
  let lastText  = '';
  let lastData  = null;

  for (let turn = 0; turn < maxTurns; turn++) {
    const body = {
      model:      claudeBody.model      || 'claude-sonnet-4-20250514',
      max_tokens: claudeBody.max_tokens || 5000,
      system:     claudeBody.system,
      tools:      claudeBody.tools      || [],
      messages,
    };

    console.log(`[generate] turn=${turn + 1} messages=${messages.length}`);

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body),
    });

    const data = await anthropicRes.json();
    lastData = data;

    if (!anthropicRes.ok) {
      console.error('[generate] Anthropic error:', anthropicRes.status, JSON.stringify(data));
      const err = new Error(data.error?.message || `Anthropic ${anthropicRes.status}`);
      err.status  = anthropicRes.status;
      err.apiData = data;
      throw err;
    }

    const { stop_reason, content = [] } = data;

    // Collect text blocks from this turn
    const textBlocks = content.filter(b => b.type === 'text');
    if (textBlocks.length) lastText = textBlocks.map(b => b.text).join('');

    // ── Claude is done — return final response ──
    if (stop_reason === 'end_turn' || stop_reason === 'max_tokens') {
      console.log(`[generate] done turn=${turn + 1} stop=${stop_reason} textLen=${lastText.length}`);
      return {
        id:          data.id,
        type:        'message',
        role:        'assistant',
        content:     [{ type: 'text', text: lastText }],
        stop_reason: data.stop_reason,
        model:       data.model,
        usage:       data.usage,
      };
    }

    // ── Tool calls — build continuation ──
    if (stop_reason === 'tool_use') {
      const toolUseBlocks = content.filter(b => b.type === 'tool_use');
      if (!toolUseBlocks.length) {
        console.warn('[generate] tool_use stop but no tool_use blocks found');
        break;
      }

      // Append Claude's assistant turn
      messages = [...messages, { role: 'assistant', content }];

      // Acknowledge each tool call — Anthropic executes web_search server-side
      messages = [...messages, {
        role:    'user',
        content: toolUseBlocks.map(b => ({
          type:        'tool_result',
          tool_use_id: b.id,
          content:     '',
        })),
      }];

      continue;
    }

    console.warn(`[generate] unexpected stop_reason: ${stop_reason}`);
    break;
  }

  // Loop limit — return whatever text was collected
  console.warn('[generate] agent loop limit reached');
  return {
    content:     [{ type: 'text', text: lastText }],
    stop_reason: 'loop_limit',
    model:       lastData?.model,
    usage:       lastData?.usage,
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

    const result = await runAgentLoop(claudeBody);
    return res.status(200).json(result);

  } catch (err) {
    console.error('[generate] handler error:', err);
    if (err.apiData) return res.status(err.status || 500).json(err.apiData);
    return res.status(500).json({ error: { message: 'Internal error: ' + err.message } });
  }
});

export default router;
