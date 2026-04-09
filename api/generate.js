import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router  = Router();
const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ── Sanitise ──────────────────────────────────────────────────────────────────
function sanitize(str, maxLen = 300) {
  if (!str) return '';
  return String(str).replace(/[<>]/g, '').slice(0, maxLen).trim();
}

// ── SYSTEM PROMPT (cached by Anthropic — billed once per hour) ────────────────
// The detailed JSON schema lives here, not in the user message, so it is only
// counted once in the cache read rather than re-sent on every call.
const SYSTEM_PROMPT = `You are Cerebré Intelligence Engine — a world-class digital brand strategist with deep expertise in African markets, particularly Nigeria and West Africa.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no preamble, no explanation. Pure JSON only.

Output this EXACT schema, fully populated with realistic, specific, research-quality data for the given company. Use your training knowledge to produce accurate estimates — be specific and brutally honest about gaps. Most Nigerian companies score 2–5/10 across digital dimensions.

{
  "company_name": "string",
  "report_date": "string — use EXACTLY the Report Date provided in the user message",
  "prepared_by": "Cerebré Media Africa",
  "overall_score": "number (1 decimal, out of 10)",
  "maturity_stage": "string",

  "executive_summary": {
    "overview": "string (3–4 sentences, sharp executive summary)",
    "strengths": ["string x5"],
    "critical_gaps": ["string x5"],
    "headline_numbers": {
      "revenue_visibility_loss": "string e.g. ₦2.4B+",
      "organic_traffic_missed": "string e.g. ~180,000/mo",
      "biggest_follower_gap": "string e.g. 2.1M vs 340K on LinkedIn"
    },
    "maturity_verdict": "string (2–3 sentences)"
  },

  "website_ux_audit": {
    "score": "number",
    "url": "string",
    "overview": "string",
    "architecture_issues": ["string x4"],
    "performance_issues": ["string x4"],
    "conversion_issues": ["string x4"],
    "competitor2_name": "string",
    "competitor3_name": "string",
    "competitor_comparison": [
      { "feature": "string", "company": "string", "dangote": "string", "competitor2": "string", "competitor3": "string" }
    ],
    "ux_score_verdict": "string",
    "ux_opportunity": "string"
  },

  "seo_audit": {
    "score": "number",
    "domain_authority_estimate": "string",
    "competitor_da_benchmark": "string",
    "monthly_organic_traffic_estimate": "string",
    "competitor_traffic_benchmark": "string",
    "indexed_pages_estimate": "string",
    "ranking_keywords_estimate": "string",
    "missed_keyword_clusters": [
      { "keyword": "string", "monthly_searches": "string", "current_ranking": "string", "revenue_relevance": "High|Medium|Low" }
    ],
    "content_backlink_gaps": ["string x5"],
    "seo_score_verdict": "string",
    "missed_opportunity_statement": "string"
  },

  "social_media_audit": {
    "overall_score": "number",
    "overview": "string",
    "platforms": {
      "linkedin":  { "followers": "number", "score": "number", "status": "ok|gap|critical|opportunity", "posting_frequency": "string", "issues": ["string x3"] },
      "instagram": { "followers": "number", "score": "number", "status": "ok|gap|critical|opportunity", "posting_frequency": "string", "issues": ["string x3"] },
      "twitter_x": { "followers": "number", "score": "number", "status": "ok|gap|critical|opportunity", "posting_frequency": "string", "issues": ["string x3"] },
      "facebook":  { "followers": "number", "score": "number", "status": "ok|gap|critical|opportunity", "posting_frequency": "string", "issues": ["string x3"] },
      "youtube":   { "subscribers": "number", "score": "number", "status": "ok|gap|critical|opportunity", "posting_frequency": "string", "issues": ["string x3"] },
      "tiktok":    { "followers": "number", "score": "number", "status": "ok|gap|critical|opportunity", "posting_frequency": "string", "issues": ["string x3"] }
    },
    "competitor_benchmarks": [
      { "platform": "string", "company": "number", "competitor1": "number", "competitor2": "number", "competitor3": "number", "c1_name": "string", "c2_name": "string", "c3_name": "string" }
    ],
    "social_maturity_verdict": "string"
  },

  "content_marketing": {
    "score": "number",
    "overview": "string",
    "content_assets": [
      { "asset": "string", "status": "present|partial|absent", "detail": "string" }
    ],
    "untapped_storytelling_assets": ["string x5"],
    "content_maturity_verdict": "string"
  },

  "digital_share_of_voice": {
    "overview": "string",
    "sov_table": [
      { "category": "string", "company_pct": "string", "competitor1_pct": "string", "competitor2_pct": "string", "competitor3_pct": "string", "c1": "string", "c2": "string", "c3": "string" }
    ],
    "sov_verdict": "string",
    "brand_perception_risks": ["string x4"]
  },

  "digital_authority_trust": {
    "score": "number",
    "backlink_profile": "string",
    "primary_backlink_sources": ["string x4"],
    "missing_authority_sources": ["string x4"],
    "wikipedia_status": "string",
    "business_intelligence_profiles": "string",
    "esg_transparency": {
      "overview": "string",
      "esg_assets_present": ["string x3"],
      "esg_gaps": ["string x3"]
    },
    "authority_verdict": "string"
  },

  "paid_media": {
    "score": "number",
    "active_campaigns": "boolean",
    "overview": "string",
    "channel_status": [
      { "channel": "string", "company_status": "string", "top_competitor_status": "string", "opportunity": "string" }
    ],
    "estimated_traffic_loss": ["string x3"],
    "paid_media_verdict": "string"
  },

  "maturity_index": {
    "overall_score": "number",
    "stage": "string",
    "stage_description": "string",
    "dimensions": [
      { "name": "string", "score": "number", "comment": "string" }
    ],
    "maturity_stages": [
      { "stage": "Stage 1", "label": "Digital Absent",   "description": "string" },
      { "stage": "Stage 2", "label": "Foundational",     "description": "string" },
      { "stage": "Stage 3", "label": "Developing",       "description": "string" },
      { "stage": "Stage 4", "label": "Competitive",      "description": "string" },
      { "stage": "Stage 5", "label": "Digital Leader",   "description": "string" }
    ]
  },

  "top_strategic_gaps": [
    { "rank": "number", "title": "string", "description": "string (2–3 sentences)", "business_risk": "string" }
  ],

  "twelve_month_roadmap": {
    "phase1": {
      "title": "Phase 1 — Foundation & Quick Wins (Months 1–3)",
      "priority": "string",
      "actions": [
        { "timeline": "Month 1", "action": "string", "outcome": "string" }
      ]
    },
    "phase2": {
      "title": "Phase 2 — Acceleration (Months 4–8)",
      "priority": "string",
      "actions": [
        { "timeline": "Month 4–5", "action": "string", "outcome": "string" }
      ]
    },
    "phase3": {
      "title": "Phase 3 — Authority & Leadership (Months 9–12)",
      "priority": "string",
      "actions": [
        { "timeline": "Month 9–10", "action": "string", "outcome": "string" }
      ]
    },
    "forecast": "string (projected outcomes after 12 months)"
  }
}

Rules:
- Scores are 1–10 (one decimal)
- Populate EVERY field — nothing null or empty
- Include 10 strategic gaps (rank 1–10) and 4–5 roadmap actions per phase
- Use ₦ currency and Nigerian market context throughout
- Return ONLY the JSON object — nothing else`;

// ── User prompt builder ───────────────────────────────────────────────────────
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
- Use your knowledge of this company and Nigerian market to produce realistic, specific data
- Populate EVERY field in the schema — do not leave anything null or empty
- Include 10 strategic gaps (rank 1–10) and 4–5 roadmap actions per phase
- Output ONLY valid JSON, nothing else`;
}

// ── Rate limiting (in-memory, optional Redis layer in checkRateLimit.js) ──────
const requestLog = new Map();
const RATE_LIMIT  = 10;
const WINDOW_MS   = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = requestLog.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) { entry.count = 1; entry.windowStart = now; }
  else entry.count++;
  requestLog.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

// ── POST /api/generate  (called after Paystack webhook confirms payment) ──────
router.post('/', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: { message: 'Too many requests. Please wait before trying again.' } });
  }

  // Accept both flat body (new approach) and nested claudeBody envelope (old approach)
  const body     = req.body || {};
  const company  = sanitize(body.company || body.company_name);
  const website  = sanitize(body.website, 500);
  const industry = sanitize(body.industry);
  const market   = sanitize(body.market);
  const competitors = sanitize(body.competitors, 500);
  const reference   = sanitize(body.reference || body.payment_reference, 100);
  const email       = sanitize(body.email, 200);

  if (!company) {
    return res.status(400).json({ error: { message: 'Company name is required.' } });
  }

  console.log(JSON.stringify({
    t: new Date().toISOString(),
    ip, email, company, reference,
    type: 'FULL_REPORT',
  }));

  // Extend response timeout to 5 min for long generation
  res.setTimeout(300_000);

  try {
    // ── Single API call — no web search, no agentic loop ──────────────────────
    // Cost breakdown at claude-sonnet-4-5 pricing ($3/M input, $15/M output):
    //   System prompt  ~1,800 tokens  ← cached after first call (~$0.003 cold, ~$0.0003 warm)
    //   User prompt    ~  200 tokens  → ~$0.0006
    //   Output JSON    ~3,000 tokens  → ~$0.045
    //   Total per call ≈ $0.05–0.10 depending on cache hit
    const message = await client.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 8000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: buildPrompt({ company, website, industry, market, competitors, reference }) }],
    });

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!rawText) throw new Error('Empty response from Anthropic API');

    // Extract JSON from response (strip any accidental fences)
    let cleaned = rawText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const fb = cleaned.indexOf('{');
    const lb = cleaned.lastIndexOf('}');
    if (fb === -1 || lb === -1) {
  console.error('[generate] No JSON braces found. Raw text was:', rawText.slice(0, 500));
  throw new Error('No valid JSON object in response');
}
cleaned = cleaned.slice(fb, lb + 1);

console.log('[generate] Attempting JSON parse, length:', cleaned.length);
const parsed = JSON.parse(cleaned);

    console.log(`[generate] ✓ Report for "${company}" | input=${message.usage?.input_tokens} output=${message.usage?.output_tokens}`);

    // Return in the same envelope the frontend expects
    return res.status(200).json({ report: JSON.stringify(parsed, null, 2) });

  } catch (err) {
    console.error('[generate] error:', {
      message: err.message,
      status:  err.status,
      type:    err.type,
      raw:     err.message,
    });
    console.error('[generate] full error:', err);

    let msg    = 'Service error — please try again.';
    let status = 500;

    if (err.status === 401 || !process.env.ANTHROPIC_API_KEY) {
      msg = 'Invalid or missing ANTHROPIC_API_KEY.'; status = 400;
    } else if (err.status === 402 || (err.message || '').toLowerCase().includes('quota')) {
      msg = 'Anthropic API quota exceeded.'; status = 402;
    } else if (err.status === 429) {
      msg = 'API rate limit hit — please retry in 60 seconds.'; status = 429;
    } else if (err.message?.includes('JSON')) {
      msg = 'Failed to parse AI response — please try again.';
    }

    return res.status(status).json({ error: { message: msg } });
  }
});

export default router;
