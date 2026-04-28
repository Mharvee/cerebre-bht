import { Router } from "express";
import nodemailer from "nodemailer";
import puppeteer from 'puppeteer';
import fs from "fs";
import path from "path";

const router = Router();


const FROM = () =>
  process.env.FROM_EMAIL ||
  "Cerebré Intelligence Engine <no-reply@cerebre.com>";

const APP_URL = () => process.env.APP_URL || "https://cerebre-bht.onrender.com";

const BIZ_EMAIL = () => process.env.BUSINESS_EMAIL || "cerebreplus@gmail.com";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function generatePdfWithPuppeteer(reportData, userEmail) {

  // Read your actual CSS file from disk
  const cssPath = path.resolve("./public/styles.css");
  const css = fs.readFileSync(cssPath, "utf8");

  // Read your logo and convert to base64 so it embeds in the HTML
  const logoPath = path.resolve("./public/CMA logo.png");
  const logoBase64 = fs.readFileSync(logoPath).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  // Build the full self-contained HTML — inject CSS inline so Puppeteer
  // doesn't need to make any external requests
  const html = buildReportHtml(reportData, userEmail, css, logoDataUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();

    // Set viewport to A4 width in px at 96dpi
    await page.setViewport({ width: 1240, height: 1754 });

    // Use setContent so no external requests are needed
    await page.setContent(html, {
      waitUntil: "networkidle0", // waits until no more than 0 network connections
    });

    // Give any CSS animations / web fonts a moment to settle
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true, // critical — renders dark backgrounds
      margin: {
        top: "20px",
        bottom: "20px",
        left: "0px",
        right: "0px",
      },
      displayHeaderFooter: false,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

// Builds the complete standalone HTML document
function buildReportHtml(d, userEmail, css, logoDataUrl) {
  // This is your renderFull logic — but server-side, returning an HTML string
  // instead of injecting into the DOM

  const E = d.executive_summary || {};
  const hl = E.headline_numbers || {};
  const M = d.maturity_index || {};
  const dims = M.dimensions || [];
  const mStages = M.maturity_stages || [];
  const S = d.social_media_audit || {};
  const P = S.platforms || {};
  const bench = S.competitor_benchmarks || [];
  const seo = d.seo_audit || {};
  const kw = seo.missed_keyword_clusters || [];
  const uxA = d.website_ux_audit || {};
  const cont = d.content_marketing || {};
  const assets = cont.content_assets || [];
  const story = cont.untapped_storytelling_assets || [];
  const sovD = d.digital_share_of_voice || {};
  const sovT = sovD.sov_table || [];
  const auth = d.digital_authority_trust || {};
  const esg = auth.esg_transparency || {};
  const paid = d.paid_media || {};
  const paidCh = paid.channel_status || [];
  const gaps = d.top_strategic_gaps || [];
  const road = d.twelve_month_roadmap || {};

  // Helper fns (same as your frontend)
  const fmt = (n) =>
    n >= 1e6
      ? (n / 1e6).toFixed(1) + "M"
      : n >= 1e3
        ? (n / 1e3).toFixed(1) + "K"
        : String(n || 0);
  const safe = (v) => v ?? "N/A";
  const sc = (s) =>
    s >= 7 ? "var(--green)" : s >= 4 ? "var(--gold)" : "var(--red)";
  const stCls = (s) =>
    s === "active" ? "st-a" : s === "weak" ? "st-w" : "st-x";
  const relCls = (r) =>
    r === "HIGH" ? "rel-h" : r === "MEDIUM" ? "rel-m" : "rel-l";

  const bullets = (arr, colour = "var(--gold)") =>
    `<ul class="bullet-list">${(arr || []).map((s) => `<li><span class="arr" style="color:${colour}">→</span>${s}</li>`).join("")}</ul>`;

  const platCard = (key, p) => {
    const name = key
      .replace("twitter_x", "Twitter/X")
      .replace(/_/g, " ")
      .toUpperCase();
    const count = fmt(p.followers || p.subscribers || 0);
    const issues = (p.issues || []).slice(0, 3);
    return `<div class="plat">
      <div class="plat-name">${name}</div>
      <div class="plat-count" style="color:${sc(p.score || 0)}">${count}</div>
      <div class="plat-tag ${stCls(p.status)}">${(p.status || "").toUpperCase()}</div>
      <div style="font-size:10px;color:var(--smoke);margin-top:4px">Score: ${p.score || 0}/10 · ${p.posting_frequency || ""}</div>
      <div class="plat-issues">${issues.map((i) => `<div class="plat-issue">• ${i}</div>`).join("")}</div>
    </div>`;
  };

  const benchTable = bench.length
    ? `
    <div class="mt16">
      <div class="label-sm">Follower Comparison by Platform</div>
      <table class="data-tbl">
        <thead><tr>
          <th>Platform</th>
          <th>${d.company_name || "Company"}</th>
          <th>${bench[0]?.c1_name || "Competitor 1"}</th>
          <th>${bench[0]?.c2_name || "Competitor 2"}</th>
          <th>${bench[0]?.c3_name || "Competitor 3"}</th>
        </tr></thead>
        <tbody>${bench
          .map(
            (b) => `<tr>
          <td>${b.platform}</td>
          <td>${fmt(b.company)}</td>
          <td>${fmt(b.competitor1)}</td>
          <td>${fmt(b.competitor2)}</td>
          <td>${fmt(b.competitor3)}</td>
        </tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>`
    : "";

  const uxComp = (uxA.competitor_comparison || []).length
    ? `
    <div class="mt16">
      <div class="label-sm">Feature Comparison</div>
      <table class="data-tbl">
        <thead><tr>
          <th>Feature</th>
          <th>${d.company_name || "Company"}</th>
          <th>${uxA.competitor2_name || "Competitor 2"}</th>
          <th>${uxA.competitor3_name || "Competitor 3"}</th>
        </tr></thead>
        <tbody>${uxA.competitor_comparison
          .map(
            (r) => `<tr>
          <td>${r.feature}</td>
          <td>${r.company}</td>
          <td>${r.competitor2}</td>
          <td>${r.competitor3}</td>
        </tr>`,
          )
          .join("")}</tbody>
      </table>
    </div>`
    : "";

  const phaseBlock = (key) => {
    const p = road[key] || {};
    if (!p.title) return "";
    return `<div class="phase-block">
      <div class="phase-t">${p.title}<div class="phase-priority">${p.priority || ""}</div></div>
      ${(p.actions || [])
        .map(
          (a) => `
        <div class="r-row">
          <span class="r-time">${a.timeline || ""}</span>
          <span class="r-action">${a.action || ""}</span>
          <span class="r-out">${a.outcome || ""}</span>
        </div>`,
        )
        .join("")}
    </div>`;
  };

  const body = `
  <div class="report-wrap">

    <!-- MASTHEAD -->
    <div class="r-masthead">
      <div class="r-masthead-inner">
        <div>
          <div class="r-eyebrow">Cerebre Media Africa — Strategic Digital Intelligence Division</div>
          <div class="r-h1">Digital Brand Health Tracker: <span>${company_name || ""}</span></div>
          <div class="r-meta">
            <span><strong>Date:</strong> ${d.report_date || new Date().toLocaleDateString()}</span>
            <span><strong>Prepared by:</strong> ${d.prepared_by || "Cerebre Media Africa"}</span>
            <span><strong>Delivered to:</strong> ${userEmail}</span>
          </div>
          <div class="r-badge">STRICTLY CONFIDENTIAL — EXECUTIVE USE ONLY</div>
        </div>
        <img src="${logoDataUrl}" class="r-masthead-logo" alt="Cerebre Media Africa">
      </div>
    </div>

    <!-- SCORE HERO -->
    <div class="score-hero">
      <div class="score-ring" style="border-color:${sc(d.overall_score || 0)}">
        <div class="score-big" style="color:${sc(d.overall_score || 0)}">${(d.overall_score || 0).toFixed(1)}</div>
        <div class="score-denom">/ 10</div>
      </div>
      <div class="score-info">
        <h2>Overall Digital Health Score</h2>
        <p>${E.overview || ""}</p>
        <div class="stage-tag">${M.stage || d.maturity_stage || ""}</div>
      </div>
    </div>

    <!-- HEADLINE METRICS -->
    <div class="metrics-row">
      <div class="m-box"><div class="m-lbl">Revenue Visibility Loss</div><div class="m-val val-red">${safe(hl.revenue_visibility_loss)}</div><div class="m-sub">Estimated annual</div></div>
      <div class="m-box"><div class="m-lbl">Organic Traffic Missed</div><div class="m-val val-red">${safe(hl.organic_traffic_missed)}</div><div class="m-sub">Per month estimate</div></div>
      <div class="m-box"><div class="m-lbl">Biggest Follower Gap</div><div class="m-val val-org">${safe(hl.biggest_follower_gap)}</div><div class="m-sub">vs top competitor</div></div>
    </div>

    <!-- EXECUTIVE SUMMARY -->
    <div class="s-card">
      <div class="s-head"><div class="s-title">Executive Summary — Strengths &amp; Critical Gaps</div></div>
      <div class="s-body">
        <div class="two-col">
          <div class="col-grn">
            <div class="col-head" style="color:var(--green)">✓ Strengths Identified</div>
            ${(E.strengths || []).map((s) => `<div class="col-item"><span style="color:var(--green);flex-shrink:0">•</span>${s}</div>`).join("")}
          </div>
          <div class="col-red">
            <div class="col-head" style="color:var(--red)">✗ Critical Gaps Found</div>
            ${(E.critical_gaps || []).map((g) => `<div class="col-item"><span style="color:var(--red);flex-shrink:0">•</span>${g}</div>`).join("")}
          </div>
        </div>
        <div class="verdict-box mt16"><strong>Maturity Verdict:</strong> ${E.maturity_verdict || ""}</div>
      </div>
    </div>

    <!-- DIGITAL MATURITY INDEX -->
    <div class="s-card">
      <div class="s-head">
        <div class="s-title">Digital Maturity Index</div>
        <div class="s-score" style="color:${sc(M.overall_score || 0)}">${(M.overall_score || d.overall_score || 0).toFixed(1)}/10</div>
      </div>
      <div class="s-body">
        ${dims
          .map(
            (dim) => `
          <div class="bar-row">
            <div class="bar-lbl">${dim.name}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(dim.score || 0) * 10}%;background:${sc(dim.score || 0)}"></div></div>
            <div class="bar-num" style="color:${sc(dim.score || 0)}">${dim.score || 0}/10</div>
          </div>
          ${dim.comment ? `<div class="bar-comment">${dim.comment}</div>` : ""}`,
          )
          .join("")}
        <div class="verdict-box mt16"><strong>Stage:</strong> ${M.stage || ""} — ${M.stage_description || ""}</div>
        ${
          mStages.length
            ? `
          <div class="mt16">
            <div class="label-sm">Maturity Stage Definitions</div>
            <table class="data-tbl">
              <thead><tr><th>Stage</th><th>Label</th><th>Description</th></tr></thead>
              <tbody>${mStages.map((st) => `<tr><td>${st.stage}</td><td><strong>${st.label}</strong></td><td>${st.description}</td></tr>`).join("")}</tbody>
            </table>
          </div>`
            : ""
        }
      </div>
    </div>

    <!-- WEBSITE UX -->
    <div class="s-card">
      <div class="s-head">
        <div class="s-title">Website &amp; UX Audit</div>
        <div class="s-score" style="color:${sc(uxA.score || 0)}">${uxA.score || 0}/10</div>
      </div>
      <div class="s-body">
        <div style="font-size:13px;color:var(--smoke);margin-bottom:14px;line-height:1.6">${uxA.overview || ""}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px">
          <div><div class="label-sm">Architecture Issues</div>${bullets(uxA.architecture_issues, "var(--red)")}</div>
          <div><div class="label-sm">Performance Issues</div>${bullets(uxA.performance_issues, "var(--orange)")}</div>
          <div><div class="label-sm">Conversion Issues</div>${bullets(uxA.conversion_issues, "var(--red)")}</div>
        </div>
        ${uxComp}
        <div class="verdict-box mt16"><strong>UX Verdict:</strong> ${uxA.ux_score_verdict || ""}<br><strong>Opportunity:</strong> ${uxA.ux_opportunity || ""}</div>
      </div>
    </div>

    <!-- SEO -->
    <div class="s-card">
      <div class="s-head">
        <div class="s-title">SEO &amp; Search Visibility</div>
        <div class="s-score" style="color:${sc(seo.score || 0)}">${seo.score || 0}/10</div>
      </div>
      <div class="s-body">
        <div class="metrics-row" style="margin-bottom:16px">
          <div class="m-box">
            <div class="m-lbl">Domain Authority</div>
            <div class="m-val ${(seo.score || 0) < 4 ? "val-red" : "val-gld"}">${safe(seo.domain_authority_estimate)}</div>
            <div class="m-sub">Benchmark: ${safe(seo.competitor_da_benchmark)}</div>
          </div>
          <div class="m-box">
            <div class="m-lbl">Monthly Organic Traffic</div>
            <div class="m-val val-red">${safe(seo.monthly_organic_traffic_estimate)}</div>
            <div class="m-sub">Benchmark: ${safe(seo.competitor_traffic_benchmark)}</div>
          </div>
          <div class="m-box">
            <div class="m-lbl">Indexed Pages / Keywords</div>
            <div class="m-val val-gld">${safe(seo.indexed_pages_estimate)}</div>
            <div class="m-sub">${safe(seo.ranking_keywords_estimate)} ranking keywords</div>
          </div>
        </div>
        ${
          kw.length
            ? `<div class="label-sm">Missed Keyword Opportunities</div>
          ${kw
            .map(
              (k) => `<div class="kw-row">
            <span class="kw-name">${k.keyword}</span>
            <span class="kw-vol">${k.monthly_searches}/mo</span>
            <span class="kw-rank">Rank: ${k.current_ranking || "Unranked"}</span>
            <span class="kw-rel ${relCls(k.revenue_relevance)}">${k.revenue_relevance}</span>
          </div>`,
            )
            .join("")}`
            : ""
        }
        ${(seo.content_backlink_gaps || []).length ? `<div class="mt16"><div class="label-sm">Content &amp; Backlink Gaps</div>${bullets(seo.content_backlink_gaps)}</div>` : ""}
        <div class="verdict-box mt16">
          <strong>SEO Verdict:</strong> ${seo.seo_score_verdict || ""}<br>
          <strong>Missed Opportunity:</strong> ${seo.missed_opportunity_statement || ""}
        </div>
      </div>
    </div>

    <!-- SOCIAL MEDIA -->
    <div class="s-card">
      <div class="s-head">
        <div class="s-title">Social Media Presence Audit</div>
        <div class="s-score" style="color:${sc(S.overall_score || 0)}">${S.overall_score || 0}/10</div>
      </div>
      <div class="s-body">
        <div style="font-size:13px;color:var(--smoke);margin-bottom:14px;line-height:1.6">${S.overview || ""}</div>
        <div class="plat-grid">${Object.entries(P)
          .map(([k, p]) => platCard(k, p))
          .join("")}</div>
        ${benchTable}
        <div class="verdict-box mt16"><strong>Social Verdict:</strong> ${S.social_maturity_verdict || ""}</div>
      </div>
    </div>

    <!-- CONTENT MARKETING -->
    <div class="s-card">
      <div class="s-head">
        <div class="s-title">Content Marketing Maturity</div>
        <div class="s-score" style="color:${sc(cont.score || 0)}">${cont.score || 0}/10</div>
      </div>
      <div class="s-body">
        <div style="font-size:13px;color:var(--smoke);margin-bottom:14px;line-height:1.6">${cont.overview || ""}</div>
        ${assets
          .map(
            (a) => `<div class="asset-row">
          <span class="asset-name">${a.asset}</span>
          <span class="asset-detail">${a.detail || ""}</span>
          <span class="a-tag ${a.status === "present" ? "at-p" : a.status === "partial" ? "at-m" : "at-x"}">${(a.status || "").toUpperCase()}</span>
        </div>`,
          )
          .join("")}
        ${story.length ? `<div class="mt16"><div class="label-sm">Untapped Storytelling Assets</div>${bullets(story, "var(--gold)")}</div>` : ""}
        <div class="verdict-box mt16"><strong>Content Verdict:</strong> ${cont.content_maturity_verdict || ""}</div>
      </div>
    </div>

    <!-- SHARE OF VOICE -->
    <div class="s-card">
      <div class="s-head"><div class="s-title">Digital Share of Voice</div></div>
      <div class="s-body">
        <div style="font-size:13px;color:var(--smoke);margin-bottom:14px;line-height:1.6">${sovD.overview || ""}</div>
        ${
          sovT.length
            ? `<table class="data-tbl">
          <thead><tr>
            <th>Category</th>
            <th>${d.company_name || "Company"}</th>
            <th>${sovT[0]?.c1 || "Competitor 1"}</th>
            <th>${sovT[0]?.c2 || "Competitor 2"}</th>
            <th>${sovT[0]?.c3 || "Competitor 3"}</th>
          </tr></thead>
          <tbody>${sovT
            .map(
              (r) => `<tr>
            <td>${r.category}</td>
            <td class="val-red">${r.company_pct}</td>
            <td>${r.competitor1_pct}</td>
            <td>${r.competitor2_pct}</td>
            <td>${r.competitor3_pct}</td>
          </tr>`,
            )
            .join("")}</tbody>
        </table>`
            : ""
        }
        ${(sovD.brand_perception_risks || []).length ? `<div class="mt16"><div class="label-sm">Brand Perception Risks</div>${bullets(sovD.brand_perception_risks, "var(--red)")}</div>` : ""}
        <div class="verdict-box mt16"><strong>SOV Verdict:</strong> ${sovD.sov_verdict || ""}</div>
      </div>
    </div>

    <!-- DIGITAL AUTHORITY -->
    <div class="s-card">
      <div class="s-head">
        <div class="s-title">Digital Authority &amp; Trust</div>
        <div class="s-score" style="color:${sc(auth.score || 0)}">${auth.score || 0}/10</div>
      </div>
      <div class="s-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px">
          <div>
            <div class="label-sm">Backlink Profile</div>
            <div style="font-size:13px;color:var(--smoke);line-height:1.6">${auth.backlink_profile || ""}</div>
            <div class="mt12 label-sm">Primary Backlink Sources</div>${bullets(auth.primary_backlink_sources)}
          </div>
          <div>
            <div class="label-sm">Missing Authority Sources</div>${bullets(auth.missing_authority_sources, "var(--red)")}
            <div class="mt12 label-sm">Platform Presence</div>
            <div style="font-size:13px;color:var(--smoke)">Wikipedia: ${auth.wikipedia_status || "N/A"}</div>
            <div style="font-size:13px;color:var(--smoke);margin-top:4px">${auth.business_intelligence_profiles || ""}</div>
          </div>
        </div>
        ${
          esg.overview
            ? `<div style="background:rgba(29,185,84,.04);border:1px solid rgba(29,185,84,.12);border-radius:8px;padding:14px;margin-top:14px">
          <div class="label-sm" style="color:var(--green);margin-bottom:8px">ESG &amp; Transparency</div>
          <div style="font-size:13px;color:var(--smoke);margin-bottom:10px">${esg.overview}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div><div class="label-sm">Present</div>${bullets(esg.esg_assets_present, "var(--green)")}</div>
            <div><div class="label-sm">Gaps</div>${bullets(esg.esg_gaps, "var(--red)")}</div>
          </div>
        </div>`
            : ""
        }
        <div class="verdict-box mt16"><strong>Authority Verdict:</strong> ${auth.authority_verdict || ""}</div>
      </div>
    </div>

    <!-- PAID MEDIA -->
    <div class="s-card">
      <div class="s-head">
        <div class="s-title">Paid Media Visibility</div>
        <div class="s-score" style="color:${sc(paid.score || 0)}">${paid.score || 0}/10</div>
      </div>
      <div class="s-body">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <span style="font-size:14px;font-weight:500">Active Campaigns:</span>
          <span style="padding:4px 14px;border-radius:10px;font-size:11px;font-weight:700;${paid.active_campaigns ? "background:rgba(29,185,84,.12);color:var(--green)" : "background:rgba(224,62,62,.12);color:var(--red)"}">
            ${paid.active_campaigns ? "DETECTED" : "NONE DETECTED"}
          </span>
        </div>
        <div style="font-size:13px;color:var(--smoke);margin-bottom:14px;line-height:1.6">${paid.overview || ""}</div>
        ${paidCh
          .map(
            (c) => `<div class="paid-row">
          <span class="paid-ch">${c.channel}</span>
          <span class="paid-status">${c.company_status}</span>
          <span class="paid-opp">→ ${c.opportunity}</span>
        </div>`,
          )
          .join("")}
        ${(paid.estimated_traffic_loss || []).length ? `<div class="mt16 label-sm">Estimated Traffic Loss</div>${bullets(paid.estimated_traffic_loss, "var(--red)")}` : ""}
        <div class="verdict-box mt16"><strong>Paid Media Verdict:</strong> ${paid.paid_media_verdict || ""}</div>
      </div>
    </div>

    <!-- TOP STRATEGIC GAPS -->
    <div class="s-card">
      <div class="s-head"><div class="s-title">Top Strategic Gaps — Ranked by Business Impact</div></div>
      <div class="s-body">
        ${gaps
          .map(
            (g) => `<div class="gap-card">
          <div class="gap-num">GAP #${g.rank}</div>
          <div class="gap-title">${g.title}</div>
          <div class="gap-body">${g.description}</div>
          ${g.business_risk ? `<div class="gap-risk"><strong>Business Risk:</strong> ${g.business_risk}</div>` : ""}
        </div>`,
          )
          .join("")}
      </div>
    </div>

    <!-- 12-MONTH ROADMAP -->
    <div class="s-card">
      <div class="s-head"><div class="s-title">12-Month Digital Transformation Roadmap</div></div>
      <div class="s-body">
        ${phaseBlock("phase1")}
        ${phaseBlock("phase2")}
        ${phaseBlock("phase3")}
        ${road.forecast ? `<div class="forecast-box"><strong>12-Month Forecast:</strong> ${road.forecast}</div>` : ""}
      </div>
    </div>

    <!-- FOOTER -->
    <div class="report-footer">
      <strong style="color:var(--gold2)">Cerebre Media Africa</strong> · Strategic Digital Intelligence Division · cerebre.africa<br>
      Generated by the Cerebre Intelligence Engine · ${d.report_date || new Date().toLocaleDateString()}<br>
      Figures are directional estimates based on industry benchmarks and AI analysis.
      <strong style="color:var(--red)"> STRICTLY CONFIDENTIAL.</strong>
    </div>

  </div>`;

  // Wrap in a full HTML doc with CSS inlined — Puppeteer sees everything it needs
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        /* ── Inline your full CSS here so Puppeteer needs zero network requests ── */
        ${css}

        /* PDF-specific overrides */
        body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .action-bar { display: none !important; }
        .r-masthead-logo-print { display: block !important; }
        .r-masthead-logo-screen { display: none !important; }
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}

router.post("/", async (req, res) => {
  const { type, email, reportData, company_name, filename, reference } = req.body;

  if (!email || !reportData) {
    return res.status(400).json({ message: "Missing email or reportData" });
  }
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

  try {
    const pdfBuffer = await generatePdfWithPuppeteer(reportData, email);

    const subject =
      type === "free"
        ? `Your Free Digital Brand Snapshot — ${company_name}`
        : `Your Full Digital Brand Report — ${company_name}`;

    await transporter.sendMail({
      from: FROM(),
      to: email,
      subject,
      html: `
        <p>Hi there,</p>
        <p>Please find your ${type === "free" ? "free snapshot" : "full"} Digital Brand Health Report
         for <strong>${company_name}</strong> attached.</p>
         <p>Reference: <strong>${reference}</strong></p>
        <p>Thanks for using Cerebre Media Africa!</p>
      `,
      attachments: [
        {
          filename: filename || `${company_name}-digital-brand-report.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Puppeteer/email error:", err);
    return res.status(500).json({ message: err.message });
  }
});

export default router;
