import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

console.log('[generate] API key present:', !!process.env.ANTHROPIC_API_KEY);
console.log('[generate] API key prefix:', process.env.ANTHROPIC_API_KEY?.slice(0, 10));

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ── Sanitise ──────────────────────────────────────────────────────────────────
function sanitize(str, maxLen = 300) {
  if (!str) return '';
  return String(str).replace(/[<>]/g, '').slice(0, maxLen).trim();
}

// ── FULL REPORT SYSTEM PROMPT ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Cerebré Intelligence Engine — a world-class digital brand strategist for African markets.

Respond with ONLY valid JSON — no markdown, no fences, no preamble. Pure JSON only.

Output this schema fully populated with realistic, specific data:

{
  "company_name": "string",
  "report_date": "string",
  "prepared_by": "Cerebré Media Africa",
  "overall_score": number,
  "maturity_stage": "string",

  "executive_summary": {
    "overview": "string (3 sentences)",
    "strengths": ["x4"],
    "critical_gaps": ["x4"],
    "headline_numbers": {
      "revenue_visibility_loss": "string e.g. ₦1.2B+",
      "organic_traffic_missed": "string e.g. ~90,000/mo",
      "biggest_follower_gap": "string"
    }
  },

  "website_audit": {
    "score": number,
    "url": "string",
    "top_issues": ["x4"]
  },

  "seo_audit": {
    "score": number,
    "domain_authority_estimate": "string",
    "monthly_organic_traffic_estimate": "string",
    "missed_keyword_clusters": [
      { "keyword": "string", "monthly_searches": "string", "revenue_relevance": "High|Medium|Low" }
    ]
  },

  "social_media_audit": {
    "overall_score": number,
    "platforms": {
      "linkedin":  { "followers": number, "score": number, "status": "ok|gap|critical|opportunity", "top_issue": "string" },
      "instagram": { "followers": number, "score": number, "status": "ok|gap|critical|opportunity", "top_issue": "string" },
      "twitter_x": { "followers": number, "score": number, "status": "ok|gap|critical|opportunity", "top_issue": "string" },
      "facebook":  { "followers": number, "score": number, "status": "ok|gap|critical|opportunity", "top_issue": "string" },
      "youtube":   { "subscribers": number, "score": number, "status": "ok|gap|critical|opportunity", "top_issue": "string" },
      "tiktok":    { "followers": number, "score": number, "status": "ok|gap|critical|opportunity", "top_issue": "string" }
    },
    "competitor_benchmarks": [
      { "name": "string", "linkedin": number, "instagram": number, "twitter": number }
    ]
  },

  "content_marketing": {
    "score": number,
    "content_assets": [
      { "asset": "string", "status": "present|partial|absent" }
    ]
  },

  "share_of_voice": {
    "score": number,
    "company_sov_percent": number,
    "breakdown": { "search": "string", "social": "string" },
    "brand_perception_risks": ["x3"]
  },

  "paid_media": {
    "score": number,
    "active_campaigns": boolean,
    "channel_status": [
      { "channel": "string", "status": "string", "opportunity": "string" }
    ]
  },

  "maturity_index": {
    "overall_score": number,
    "stage": "string",
    "stage_description": "string",
    "dimensions": [
      { "name": "string", "score": number, "observation": "string" }
    ]
  },

  "top_strategic_gaps": [
    { "rank": number, "title": "string", "description": "string", "business_risk": "string" }
  ],

  "thirty_day_action_plan": {
    "intro": "string",
    "weeks": [
      { "week": number, "theme": "string", "actions": ["x3"], "cerebré_deliverable": "string", "expected_outcome": "string" }
    ]
  },

  "twelve_month_roadmap": {
    "phase1": { "title": "string", "actions": [{ "timeline": "string", "action": "string", "outcome": "string" }] },
    "phase2": { "title": "string", "actions": [{ "timeline": "string", "action": "string", "outcome": "string" }] },
    "phase3": { "title": "string", "actions": [{ "timeline": "string", "action": "string", "outcome": "string" }] },
    "forecast": "string"
  },

  "cerebré_services_recommended": [
    { "service": "string", "why_needed": "string", "expected_roi": "string", "timeline": "string" }
  ]
}

Rules:
- Scores 1–10 (one decimal)
- 6 strategic gaps minimum (rank 1–6)
- 3 roadmap actions per phase
- 4 weeks in thirty_day_action_plan
- 5 cerebré_services_recommended
- ₦ currency throughout
- Return ONLY the JSON object`;

// ── TEASER SYSTEM PROMPT ──────────────────────────────────────────────────────
const TEASER_SYSTEM_PROMPT = `You are Cerebré Intelligence Engine. Respond with ONLY valid JSON — no markdown, no preamble, no explanation.`;

// ── User prompt builder (full report) ────────────────────────────────────────
function buildPrompt({ company, website, industry, market, competitors, reference }) {
  const competitorList = competitors
    ? competitors.split(',').map(c => c.trim()).filter(Boolean)
    : ['Dangote Group', 'Zenith Bank', 'GTBank'];

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `Generate a complete Digital Brand Health Tracker audit for:

Company:     ${company}
Website:     ${website || 'Unknown — infer from company name'}
Industry:    ${industry || 'Infer from company name'}
Market:      ${market || 'Nigeria / West Africa'}
Competitors: ${competitorList.join(', ')}
Report Date: ${today}
${reference ? `Payment Ref: ${reference}` : ''}

Instructions:
- Use your knowledge of this company and the Nigerian market to produce realistic, specific data
- Populate EVERY field — do not leave anything null or empty
- 6 strategic gaps, 3 roadmap actions per phase, 4 weeks in action plan, 5 services
- Output ONLY valid JSON, nothing else`;
}

// ── Teaser prompt builder ─────────────────────────────────────────────────────
function buildTeaserPrompt({ company, website, industry, market, competitors }) {
  const competitorList = competitors
    ? competitors.split(',').map(c => c.trim()).filter(Boolean)
    : ['top 3 Nigerian competitors in this sector'];

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `Generate a FREE TEASER brand audit for:
Company: ${company}
Website: ${website || 'infer from company name'}
Industry: ${industry || 'infer from company name'}
Market: ${market || 'Nigeria'}
Competitors: ${competitorList.join(', ')}
Date: ${today}

Return ONLY this exact JSON structure — no other text:
{
  "company_name": "string",
  "report_date": "string",
  "overall_score": number,
  "maturity_stage": "string",
  "executive_summary": {
    "overview": "string (2–3 sentences)",
    "strengths": ["s1", "s2", "s3"],
    "critical_gaps": ["g1", "g2", "g3"]
  },
  "website_audit": {
    "url": "string",
    "score": number,
    "top_issues": ["i1", "i2", "i3"]
  },
  "seo_audit": {
    "score": number,
    "domain_authority_estimate": "string",
    "monthly_organic_traffic_estimate": "string",
    "top_missed_keywords": [
      { "keyword": "string", "monthly_searches": "string", "revenue_relevance": "string" },
      { "keyword": "string", "monthly_searches": "string", "revenue_relevance": "string" },
      { "keyword": "string", "monthly_searches": "string", "revenue_relevance": "string" }
    ]
  },
  "social_media_audit": {
    "overall_score": number,
    "platforms": {
      "linkedin":  { "followers": number, "score": number, "status": "string" },
      "instagram": { "followers": number, "score": number, "status": "string" },
      "twitter_x": { "followers": number, "score": number, "status": "string" },
      "youtube":   { "subscribers": number, "score": number, "status": "string" },
      "tiktok":    { "followers": number, "score": number, "status": "string" }
    },
    "competitor_benchmarks": [
      { "name": "string", "linkedin": number, "instagram": number, "twitter": number },
      { "name": "string", "linkedin": number, "instagram": number, "twitter": number },
      { "name": "string", "linkedin": number, "instagram": number, "twitter": number }
    ]
  },
  "top_3_gaps": [
    { "rank": 1, "title": "string", "description": "string", "business_risk": "string" },
    { "rank": 2, "title": "string", "description": "string", "business_risk": "string" },
    { "rank": 3, "title": "string", "description": "string", "business_risk": "string" }
  ]
}`;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
const requestLog = new Map();
const RATE_LIMIT = 10;
const WINDOW_MS  = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = requestLog.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) { entry.count = 1; entry.windowStart = now; }
  else entry.count++;
  requestLog.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

// ── JSON extractor helper ─────────────────────────────────────────────────────
function extractJSON(text) {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  const fb = cleaned.indexOf('{');
  const lb = cleaned.lastIndexOf('}');
  if (fb === -1 || lb === -1) throw new Error('No JSON object found in response');
  return JSON.parse(cleaned.slice(fb, lb + 1));
}

// ── POST /api/generate ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: { message: 'Too many requests. Please wait before trying again.' } });
  }

  const body        = req.body || {};
  const company     = sanitize(body.company || body.company_name);
  const website     = sanitize(body.website, 500);
  const industry    = sanitize(body.industry);
  const market      = sanitize(body.market);
  const competitors = sanitize(body.competitors, 500);
  const reference   = sanitize(body.reference || body.payment_reference, 100);
  const email       = sanitize(body.email, 200);
  const type        = body.type || 'full';

  if (!company) {
    return res.status(400).json({ error: { message: 'Company name is required.' } });
  }

  // ── TEASER PATH (free audit — cheap, fast) ────────────────────────────────
  if (type === 'teaser') {
    console.log(JSON.stringify({ t: new Date().toISOString(), ip, email, company, type: 'TEASER' }));
    try {
      const msg = await client.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system:     TEASER_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: buildTeaserPrompt({ company, website, industry, market, competitors }) }],
      });

      const rawText = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      if (!rawText) throw new Error('Empty response from API');

      const parsed = extractJSON(rawText);
      console.log(`[teaser] ✓ "${company}" | ${msg.usage?.input_tokens}in ${msg.usage?.output_tokens}out | ~$${((msg.usage?.input_tokens * 3 + msg.usage?.output_tokens * 15) / 1_000_000).toFixed(4)}`);
      return res.status(200).json(parsed);

    } catch (err) {
      console.error('[teaser] error:', err.message);
      return res.status(500).json({ error: { message: 'Teaser generation failed — please try again.' } });
    }
  }

  // ── FULL REPORT PATH (paid) ───────────────────────────────────────────────
  console.log(JSON.stringify({ t: new Date().toISOString(), ip, email, company, reference, type: 'FULL_REPORT' }));
  res.setTimeout(300_000);

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: buildPrompt({ company, website, industry, market, competitors, reference }) }],
    });

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!rawText) throw new Error('Empty response from Anthropic API');

    let parsed;
    try {
      parsed = extractJSON(rawText);
    } catch (parseErr) {
      console.error('[generate] JSON parse failed:', parseErr.message);
      throw new Error('Report was too large and got cut off. Try again — it usually works on retry.');
    }

    console.log(`[generate] ✓ "${company}" | ${message.usage?.input_tokens}in ${message.usage?.output_tokens}out | ~$${((message.usage?.input_tokens * 3 + message.usage?.output_tokens * 15) / 1_000_000).toFixed(4)}`);
    return res.status(200).json({ report: JSON.stringify(parsed, null, 2) });

  } catch (err) {
    console.error('[generate] error:', err.message);

    let msg    = 'Service error — please try again.';
    let status = 500;

    if (err.status === 401 || !process.env.ANTHROPIC_API_KEY) {
      msg = 'Invalid or missing ANTHROPIC_API_KEY.'; status = 400;
    } else if (err.status === 402 || (err.message || '').toLowerCase().includes('quota')) {
      msg = 'Anthropic API quota exceeded.'; status = 402;
    } else if (err.status === 429) {
      msg = 'API rate limit hit — please retry in 60 seconds.'; status = 429;
    } else if (err.message?.includes('JSON') || err.message?.includes('cut off')) {
      msg = err.message;
    }

    return res.status(status).json({ error: { message: msg } });
  }
});

export default router;
