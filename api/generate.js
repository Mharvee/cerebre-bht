import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

console.log('[generate] API key present:', !!process.env.ANTHROPIC_API_KEY);
console.log('[generate] API key prefix:', process.env.ANTHROPIC_API_KEY?.slice(0, 10));

const router = Router();
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Sanitise ──────────────────────────────────────────────────────────────────
function sanitize(str, maxLen = 300) {
  if (!str) return '';
  return String(str).replace(/[<>]/g, '').slice(0, maxLen).trim();
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Cerebre Intelligence Engine — a world-class digital brand strategist with deep expertise in African markets, particularly Nigeria and West Africa.

RESEARCH PROTOCOL (MANDATORY — DO NOT SKIP):
Before generating any data, you MUST research the company using available tools:
1. Search the company's official website and product pages
2. Search their LinkedIn, Instagram, X (Twitter), YouTube, TikTok, Facebook profiles
3. Search recent news coverage (last 12–18 months)
4. Search competitor digital presence and social followings
5. Search SEO signals: domain authority, keyword rankings, organic traffic estimates
6. Search brand authority signals: Wikipedia, Crunchbase, industry press, ad libraries

ESTIMATION RULES:
- If a data point is verified from search → use it as-is
- If a data point is estimated → prefix with "est." (e.g., "est. 12,000")
- NEVER fabricate precise figures — use ranges when uncertain (e.g., "est. 8,000–15,000")
- If a platform presence cannot be confirmed → set followers/subscribers to 0 and status to "unconfirmed"

You MUST respond with ONLY valid JSON — no markdown, no code fences, no preamble, no explanation. Pure JSON only.

Output this EXACT schema, fully populated with realistic, specific, research-quality data for the given company. Be brutally honest — most Nigerian companies score 2–5/10 across digital dimensions.

{
  "company_name": "string",
  "report_date": "string — use EXACTLY the Report Date provided in the user message",
  "prepared_by": "Cerebre Media Africa",
  "data_confidence": "High|Medium|Low — overall confidence based on data found",
  "overall_score": "number (1 decimal, out of 10)",
  "maturity_stage": "string",

  "executive_summary": {
    "brand_position": "string (1–2 sentences — where this company sits in its market right now)",
    "overview": "string (3–4 sentences, sharp executive summary)",
    "key_risks": ["string x3"],
    "key_opportunities": ["string x3"],
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
      { "feature": "string", "company": "string", "competitor2": "string", "competitor3": "string" }
    ],
    "ux_score_verdict": "string",
    "ux_opportunity": "string"
  },

  "seo_audit": {
    "score": "number",
    "domain_authority_estimate": "string — prefix with est. if not verified",
    "competitor_da_benchmark": "string",
    "monthly_organic_traffic_estimate": "string — prefix with est. if not verified",
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
      "linkedin":  { "followers": "number or 0 if unconfirmed", "followers_label": "string — e.g. est. 1,200 or unconfirmed", "score": "number", "status": "ok|gap|critical|opportunity|unconfirmed", "posting_frequency": "string", "engagement_quality": "string", "issues": ["string x3"] },
      "instagram": { "followers": "number or 0 if unconfirmed", "followers_label": "string", "score": "number", "status": "ok|gap|critical|opportunity|unconfirmed", "posting_frequency": "string", "engagement_quality": "string", "issues": ["string x3"] },
      "twitter_x": { "followers": "number or 0 if unconfirmed", "followers_label": "string", "score": "number", "status": "ok|gap|critical|opportunity|unconfirmed", "posting_frequency": "string", "engagement_quality": "string", "issues": ["string x3"] },
      "facebook":  { "followers": "number or 0 if unconfirmed", "followers_label": "string", "score": "number", "status": "ok|gap|critical|opportunity|unconfirmed", "posting_frequency": "string", "engagement_quality": "string", "issues": ["string x3"] },
      "youtube":   { "subscribers": "number or 0 if unconfirmed", "subscribers_label": "string", "score": "number", "status": "ok|gap|critical|opportunity|unconfirmed", "posting_frequency": "string", "engagement_quality": "string", "issues": ["string x3"] },
      "tiktok":    { "followers": "number or 0 if unconfirmed", "followers_label": "string", "score": "number", "status": "ok|gap|critical|opportunity|unconfirmed", "posting_frequency": "string", "engagement_quality": "string", "issues": ["string x3"] }
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
    "weak_storytelling_areas": ["string x4"],
    "missing_content_pillars": ["string x4"],
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
    "pr_presence": "string (assessment of news coverage and media mentions in last 12–18 months)",
    "industry_credibility": "string (rankings, awards, industry body memberships)",
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

  "thirty_day_action_plan": {
    "overview": "string (1–2 sentences on immediate priority)",
    "weeks": [
      {
        "week": "Week 1",
        "theme": "Fixes",
        "actions": [
          { "action": "string", "deliverable": "string", "outcome": "string", "timeline": "string" }
        ]
      },
      {
        "week": "Week 2",
        "theme": "Growth",
        "actions": [
          { "action": "string", "deliverable": "string", "outcome": "string", "timeline": "string" }
        ]
      },
      {
        "week": "Week 3",
        "theme": "Visibility",
        "actions": [
          { "action": "string", "deliverable": "string", "outcome": "string", "timeline": "string" }
        ]
      },
      {
        "week": "Week 4",
        "theme": "Conversion",
        "actions": [
          { "action": "string", "deliverable": "string", "outcome": "string", "timeline": "string" }
        ]
      }
    ]
  },

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
  },

  "recommended_services": [
    {
      "service": "string (e.g. SEO & Content Strategy)",
      "description": "string (what Cerebre will do)",
      "roi_reasoning": "string (specific business case for this company)",
      "priority": "Immediate|Short-term|Medium-term"
    }
  ],

  "final_verdict": {
    "score_summary": "string (one sharp sentence on the overall score)",
    "brutal_assessment": "string (3–5 sentences — honest, board-level, no sugarcoating)",
    "biggest_single_risk": "string (the one thing that could hurt them most if ignored)",
    "biggest_single_opportunity": "string (the one move that would deliver the most ROI)",
    "closing_statement": "string (1–2 sentences — what needs to happen now)"
  }
}

Rules:
- ALWAYS search before generating — do not rely on training data alone
- Scores are 1–10 (one decimal)
- Populate EVERY field — nothing null or empty
- Include 10 strategic gaps (rank 1–10) and 4–5 roadmap actions per phase
- Include 5–8 recommended services with ROI reasoning
- Each week in the 30-day plan must have 3–4 specific actions
- Use ₦ currency and Nigerian market context throughout
- Label ALL unverified estimates with "est." prefix
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
Website:     ${website || 'Unknown — search for it using the company name'}
Industry:    ${industry || 'Unknown — infer from web search'}
Market:      ${market || 'Nigeria / West Africa'}
Competitors: ${competitorList.join(', ')}
Report Date: ${today}
${reference ? `Payment Ref: ${reference}` : ''}

Instructions:
- SEARCH the web first for this company before generating any data
- Search their website, all social media profiles, news coverage, and competitor benchmarks
- Label all unverified figures with "est." prefix
- If a social media profile cannot be found, set followers to 0 and status to "unconfirmed"
- Populate EVERY field in the schema — do not leave anything null or empty
- Include 10 strategic gaps (rank 1–10) and 4–5 roadmap actions per phase
- Output ONLY valid JSON, nothing else`;
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

  if (!company) {
    return res.status(400).json({ error: { message: 'Company name is required.' } });
  }

  console.log(JSON.stringify({
    t: new Date().toISOString(),
    ip, email, company, reference,
    type: 'FULL_REPORT',
  }));

  res.setTimeout(300_000);

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 16000,
      system:     SYSTEM_PROMPT,
      // FIX 4 — force Claude to search before generating
      tool_choice: { type: 'auto' },
      tools: [
        {
          type:     'web_search_20250305',
          name:     'web_search',
          max_uses: 10,
        },
      ],
      messages: [
        { role: 'user', content: buildPrompt({ company, website, industry, market, competitors, reference }) },
      ],
    });

    // FIX 1 + 2 + 3 — single, correct extraction flow
    const rawText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    if (!rawText) throw new Error('Empty response from Anthropic API');

    // Strip any accidental markdown fences
    let cleaned = rawText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const fb = cleaned.indexOf('{');
    const lb = cleaned.lastIndexOf('}');
    if (fb === -1 || lb === -1) {
      console.error('[generate] No JSON braces found. Raw:', rawText.slice(0, 500));
      throw new Error('No valid JSON object in response');
    }
    cleaned = cleaned.slice(fb, lb + 1);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[generate] JSON parse failed:', parseErr.message);
      throw new Error('Report was too large and got cut off. Please try again.');
    }

    console.log(`[generate] ✓ Report for "${company}" | input=${message.usage?.input_tokens} output=${message.usage?.output_tokens}`);

    return res.status(200).json({ report: JSON.stringify(parsed, null, 2) });

  } catch (err) {
    console.error('[generate] error:', {
      message: err.message,
      status:  err.status,
      type:    err.type,
    });

    let msg    = 'Service error — please try again.';
    let status = 500;

    if (err.status === 401 || !process.env.ANTHROPIC_API_KEY) {
      msg = 'Invalid or missing ANTHROPIC_API_KEY.'; status = 400;
    } else if (err.status === 402 || (err.message || '').toLowerCase().includes('quota')) {
      msg = 'Anthropic API quota exceeded.'; status = 402;
    } else if (err.status === 429) {
      msg = 'API rate limit hit — please retry in 60 seconds.'; status = 429;
    } else if (err.message?.includes('JSON') || err.message?.includes('cut off')) {
      msg = 'Failed to parse AI response — please try again.';
    }

    return res.status(status).json({ error: { message: msg } });
  }
});

export default router;