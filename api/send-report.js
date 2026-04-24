import { Router } from 'express';
import { Resend }  from 'resend';

const router = Router();

const FROM     = () => process.env.FROM_EMAIL     || 'Cerebré Intelligence Engine <onboarding@resend.dev>';
const APP_URL  = () => process.env.APP_URL         || 'https://cerebre-bht.onrender.com';
const BIZ_EMAIL= () => process.env.BUSINESS_EMAIL  || 'cerebreplus@gmail.com';

// ── POST /api/send-report ──
router.post('/', async (req, res) => {
  const { type, email, data, reference } = req.body || {};

  if (!email || !data) {
    return res.status(400).json({ error: 'email and data required' });
  }

  // Fail gracefully if Resend not configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('[send-report] RESEND_API_KEY not set — skipping send');
    return res.status(200).json({ sent: false, reason: 'email not configured' });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (type === 'free') {
      await resend.emails.send({
        from:    FROM(),
        to:      email,
        subject: `Your Free Brand Audit — ${data.company_name} scored ${(data.overall_score || 0).toFixed(1)}/10`,
        html:    buildFreeHTML(data),
      });

    } else if (type === 'full') {
      await resend.emails.send({
        from:    FROM(),
        to:      email,
        subject: `Your Full Digital Brand Report — ${data.company_name} [Ref: ${reference}]`,
        html:    buildFullHTML(data, reference),
      });

      // BCC business owner on every paid report
      if (BIZ_EMAIL()) {
        await resend.emails.send({
          from:    FROM(),
          to:      BIZ_EMAIL(),
          subject: `[PAID] New full report — ${data.company_name} | ${email} | Ref: ${reference}`,
          html:    `<p style="font-family:Arial,sans-serif;font-size:14px">
            <strong>Reference:</strong> ${reference}<br>
            <strong>Client:</strong> ${email}<br>
            <strong>Company:</strong> ${data.company_name}<br>
            <strong>Score:</strong> ${(data.overall_score || 0).toFixed(1)}/10
          </p>`,
        });
      }
    }

    console.log(`[send-report] sent type=${type} to=${email}`);
    return res.status(200).json({ sent: true });

  } catch (err) {
    console.error('[send-report] Resend error:', err);
    // Return 200 so the front-end non-critical path never surfaces errors
    return res.status(200).json({ sent: false, error: err.message });
  }
});

export default router;


// ══════════════════════════════════════════════════════════════
//  FREE EMAIL TEMPLATE
// ══════════════════════════════════════════════════════════════
function buildFreeHTML(d) {
  const P          = (d.social_media_audit || {}).platforms || {};
  const gaps       = d.top_3_gaps || [];
  const score      = d.overall_score || 0;
  const scoreColor = score >= 7 ? '#276749' : score >= 4 ? '#c05621' : '#c53030';

  const platformRows = Object.entries(P).slice(0, 4).map(([k, p]) => {
    const count = (p.followers || p.subscribers || 0).toLocaleString();
    const col   = (p.score || 0) >= 4 ? '#276749' : (p.score || 0) >= 2 ? '#c05621' : '#c53030';
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;font-weight:600">
          ${k.replace('twitter_x', 'Twitter/X').replace(/_/g, ' ')}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #f0f0f0">
          <span style="font-size:17px;font-weight:700;color:${col}">${count}</span>
          <span style="font-size:11px;color:#999;margin-left:6px">${p.score || 0}/10</span>
        </td>
      </tr>`;
  }).join('');

  const gapBlocks = gaps.map((g, i) => `
    <div style="border-left:3px solid #c53030;padding:12px 0 12px 16px;margin-bottom:${i < gaps.length - 1 ? '16px' : '0'}">
      <div style="font-size:10px;font-weight:700;color:#c53030;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">GAP ${g.rank}</div>
      <div style="font-size:14px;font-weight:600;color:#0D1B2A;margin-bottom:6px">${g.title}</div>
      <div style="font-size:13px;color:#4a5568;line-height:1.65">${g.description}</div>
      ${g.business_risk ? `<div style="margin-top:8px;font-size:12px;color:#c53030;background:rgba(197,48,48,.07);padding:8px 10px;border-radius:5px"><strong>Risk:</strong> ${g.business_risk}</div>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Brand Health Audit — ${d.company_name}</title></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0">
<tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:#0D1B2A;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:3px solid #C9922A">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <span style="display:inline-block;width:32px;height:32px;background:#C9922A;border-radius:5px;text-align:center;line-height:32px;font-size:16px;font-weight:700;color:#0D1B2A;font-family:Georgia,serif;vertical-align:middle">C</span>
        &nbsp;<span style="color:#fff;font-size:13px;font-weight:600;letter-spacing:.05em;vertical-align:middle">CEREBRÉ MEDIA AFRICA</span>
      </td>
      <td align="right"><span style="color:#C9922A;font-size:11px;letter-spacing:.12em;text-transform:uppercase">Free Audit</span></td>
    </tr></table>
  </td></tr>

  <!-- SCORE BLOCK -->
  <tr><td style="background:#0D1B2A;padding:28px 32px">
    <p style="color:#B8C0CC;font-size:13px;margin:0 0 6px">Digital Brand Health Score for</p>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 20px;font-family:Georgia,serif">${d.company_name}</h1>
    <table cellpadding="0" cellspacing="0"><tr>
      <td width="90" align="center" valign="middle">
        <div style="width:80px;height:80px;border-radius:50%;border:4px solid ${scoreColor};text-align:center;background:rgba(255,255,255,.05);padding-top:18px;box-sizing:border-box">
          <div style="color:${scoreColor};font-size:26px;font-weight:700;font-family:Georgia,serif">${score.toFixed(1)}</div>
          <div style="color:#B8C0CC;font-size:11px">/ 10</div>
        </div>
      </td>
      <td style="padding-left:20px" valign="middle">
        <div style="background:rgba(201,146,42,.18);border:1px solid rgba(201,146,42,.35);border-radius:20px;display:inline-block;padding:3px 12px;color:#E8B84B;font-size:11px;font-weight:600;margin-bottom:8px">${d.maturity_stage || ''}</div>
        <p style="color:#B8C0CC;font-size:13px;line-height:1.65;margin:0">${(d.executive_summary || {}).overview || ''}</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- WHITE BODY -->
  <tr><td style="background:#fff;padding:28px 32px">
    <h3 style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4a5568;margin:0 0 14px">Social Media At a Glance</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      ${platformRows}
    </table>
    <h3 style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4a5568;margin:0 0 14px">3 Critical Gaps Found</h3>
    ${gapBlocks}
  </td></tr>

  <!-- CTA -->
  <tr><td style="background:#0D1B2A;padding:32px;text-align:center">
    <p style="color:#B8C0CC;font-size:13px;margin:0 0 6px">7 more critical gaps + your complete fix plan await</p>
    <h2 style="color:#fff;font-size:19px;font-weight:700;margin:0 0 10px;font-family:Georgia,serif">Unlock Your Full Brand Report</h2>
    <div style="color:#E8B84B;font-size:34px;font-weight:700;font-family:Georgia,serif;margin-bottom:4px">₦15,000</div>
    <div style="color:#B8C0CC;font-size:13px;margin-bottom:22px">one-time · instant email delivery</div>
    <a href="${APP_URL()}" style="background:#C9922A;color:#0D1B2A;text-decoration:none;font-weight:700;font-size:15px;padding:15px 38px;border-radius:8px;display:inline-block">Get Full Report →</a>
    <p style="color:rgba(184,192,204,.4);font-size:11px;margin-top:16px;line-height:1.7">
      Secure payment via Paystack · Emailed instantly<br>Traditional brand audits cost ₦2–5M and take 8 weeks.
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#080C14;border-radius:0 0 12px 12px;padding:18px 32px;text-align:center">
    <p style="color:rgba(184,192,204,.35);font-size:11px;margin:0;line-height:1.8">
      Cerebré Media Africa · Strategic Digital Intelligence<br>
      cerebre.africa · hello@cerebre.africa
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}


// ══════════════════════════════════════════════════════════════
//  FULL REPORT EMAIL TEMPLATE
// ══════════════════════════════════════════════════════════════
function buildFullHTML(d, reference) {
  const score    = d.overall_score || 0;
  const scoreCol = score >= 7 ? '#276749' : score >= 4 ? '#c05621' : '#c53030';
  const E        = d.executive_summary || {};

  const strengthRows = (E.strengths || []).slice(0, 4).map(s =>
    `<tr><td style="padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#276749;width:20px">✓</td><td style="padding:7px 0 7px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#4a5568">${s}</td></tr>`
  ).join('');

  const gapRows = (E.critical_gaps || []).slice(0, 4).map(g =>
    `<tr><td style="padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#c53030;width:20px">✗</td><td style="padding:7px 0 7px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#4a5568">${g}</td></tr>`
  ).join('');

  const includedItems = [
    'All 10 strategic gaps ranked by business impact',
    '30-day week-by-week Cerebré action plan',
    '12-month digital transformation roadmap',
    'Cerebré services proposal with ROI estimates',
    'Full social, SEO & paid media analysis',
    'Print-ready PDF (Download/Print in the app)',
  ];

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Full Brand Report — ${d.company_name}</title></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0">
<tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:#0D1B2A;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:3px solid #C9922A">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <span style="display:inline-block;width:32px;height:32px;background:#C9922A;border-radius:5px;text-align:center;line-height:32px;font-size:16px;font-weight:700;color:#0D1B2A;font-family:Georgia,serif;vertical-align:middle">C</span>
        &nbsp;<span style="color:#fff;font-size:13px;font-weight:600;letter-spacing:.05em;vertical-align:middle">CEREBRÉ MEDIA AFRICA</span>
      </td>
      <td align="right">
        <span style="background:rgba(29,185,84,.2);color:#1DB954;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px">✅ PAYMENT CONFIRMED</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- SCORE HERO -->
  <tr><td style="background:#0D1B2A;padding:28px 32px">
    <p style="color:#B8C0CC;font-size:13px;margin:0 0 4px">Full Digital Brand Health Report for</p>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 4px;font-family:Georgia,serif">${d.company_name}</h1>
    <p style="color:rgba(201,146,42,.6);font-size:12px;margin:0 0 20px">Payment Ref: ${reference}</p>
    <table cellpadding="0" cellspacing="0"><tr>
      <td width="90" align="center" valign="middle">
        <div style="width:80px;height:80px;border-radius:50%;border:4px solid ${scoreCol};text-align:center;background:rgba(255,255,255,.05);padding-top:18px;box-sizing:border-box">
          <div style="color:${scoreCol};font-size:26px;font-weight:700;font-family:Georgia,serif">${score.toFixed(1)}</div>
          <div style="color:#B8C0CC;font-size:11px">/ 10</div>
        </div>
      </td>
      <td style="padding-left:20px" valign="middle">
        <p style="color:#B8C0CC;font-size:13px;line-height:1.65;margin:0">${E.overview || ''}</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#fff;padding:28px 32px">

    <!-- Strengths & Gaps side by side -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        <td width="48%" valign="top">
          <h3 style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#276749;margin:0 0 12px">Strengths</h3>
          <table cellpadding="0" cellspacing="0" width="100%">${strengthRows}</table>
        </td>
        <td width="4%"></td>
        <td width="48%" valign="top">
          <h3 style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c53030;margin:0 0 12px">Critical Gaps</h3>
          <table cellpadding="0" cellspacing="0" width="100%">${gapRows}</table>
        </td>
      </tr>
    </table>

    <!-- What's included -->
    <div style="background:#f8f9fb;border:1px solid #dee2e8;border-radius:8px;padding:20px;margin-bottom:24px">
      <h3 style="font-size:13px;font-weight:700;color:#0D1B2A;margin:0 0 14px">Your report includes:</h3>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${includedItems.map(item => `
          <tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;color:#4a5568">
            <span style="color:#C9922A;font-weight:700;margin-right:8px">✓</span>${item}
          </td></tr>`).join('')}
      </table>
    </div>

    <p style="font-size:13px;color:#4a5568;line-height:1.7;margin:0 0 24px">
      Your report is live in the app. Use the <strong>"Download / Print PDF"</strong> button at the top to save a professional copy.
    </p>

    <a href="${APP_URL()}" style="background:#C9922A;color:#0D1B2A;text-decoration:none;font-weight:700;font-size:15px;padding:15px 38px;border-radius:8px;display:inline-block">Open &amp; Download My Report →</a>

    <p style="font-size:12px;color:#999;margin-top:20px">
      Questions? Contact <strong style="color:#0D1B2A">${BIZ_EMAIL() || 'hello@cerebre.africa'}</strong>
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#080C14;border-radius:0 0 12px 12px;padding:18px 32px;text-align:center">
    <p style="color:rgba(184,192,204,.35);font-size:11px;margin:0;line-height:1.8">
      Cerebré Media Africa · Strategic Digital Intelligence<br>
      cerebre.africa · hello@cerebre.africa
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}
