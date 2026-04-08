import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = 'Cerebré Intelligence Engine <reports@cerebre.africa>';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { type, email, data, reference } = req.body || {};
  if (!email || !data) return res.status(400).json({ error: 'email and data required' });

  try {
    if (type === 'free') {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Your Free Brand Health Audit — ${data.company_name} scored ${data.overall_score}/10`,
        html: buildFreeEmailHTML(data),
      });
    } else if (type === 'full') {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Your Full Digital Brand Health Report — ${data.company_name}`,
        html: buildFullEmailHTML(data, reference),
      });
    }
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── FREE EMAIL TEMPLATE ────────────────────────────────────────
function buildFreeEmailHTML(d) {
  const S = d.social_media_audit || {}, P = S.platforms || {};
  const seo = d.seo_audit || {};
  const gaps = d.top_3_gaps || [];
  const scoreColor = d.overall_score >= 7 ? '#276749' : d.overall_score >= 4 ? '#c05621' : '#c53030';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Brand Health Audit</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'DM Sans',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

      <!-- HEADER -->
      <tr><td style="background:#0D1B2A;padding:28px 32px;border-bottom:3px solid #C9922A">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <div style="width:36px;height:36px;background:#C9922A;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#0D1B2A;font-family:Georgia,serif;vertical-align:middle;margin-right:10px">C</div>
            <span style="color:#fff;font-size:14px;font-weight:600;letter-spacing:.05em;vertical-align:middle">CEREBRÉ MEDIA AFRICA</span>
          </td>
          <td align="right"><span style="color:#C9922A;font-size:11px;letter-spacing:.12em;text-transform:uppercase">Free Audit Report</span></td>
        </tr></table>
      </td></tr>

      <!-- SCORE HERO -->
      <tr><td style="padding:32px 32px 24px;background:#0D1B2A">
        <p style="color:#B8C0CC;font-size:13px;margin:0 0 8px">Your Digital Brand Health Score for</p>
        <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 20px;font-family:Georgia,serif">${d.company_name}</h1>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="100" align="center">
            <div style="width:90px;height:90px;border-radius:50%;border:4px solid ${scoreColor};display:inline-flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:rgba(255,255,255,.05)">
              <div style="color:${scoreColor};font-size:28px;font-weight:700;line-height:1;font-family:Georgia,serif">${(d.overall_score||0).toFixed(1)}</div>
              <div style="color:#B8C0CC;font-size:11px">/ 10</div>
            </div>
          </td>
          <td style="padding-left:24px">
            <div style="background:rgba(201,146,42,.15);border:1px solid rgba(201,146,42,.3);border-radius:20px;display:inline-block;padding:4px 14px;color:#E8B84B;font-size:11px;font-weight:600;margin-bottom:10px">${d.maturity_stage||''}</div>
            <p style="color:#B8C0CC;font-size:13px;line-height:1.6;margin:0">${(d.executive_summary||{}).overview||''}</p>
          </td>
        </tr></table>
      </td></tr>

      <!-- SOCIAL NUMBERS -->
      <tr><td style="padding:24px 32px;border-bottom:1px solid #eee">
        <h3 style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4a5568;margin:0 0 16px">Social Media At a Glance</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${Object.entries(P).slice(0,4).map(([k,p])=>`
          <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:13px;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;font-weight:600">${k.replace('_x','').replace('_',' ')}</span>
          </td><td align="right">
            <span style="font-size:16px;font-weight:700;color:${p.score>=4?'#276749':p.score>=2?'#c05621':'#c53030'}">${((p.followers||p.subscribers||0)).toLocaleString()}</span>
            <span style="font-size:11px;color:#999;margin-left:6px">${p.score||0}/10</span>
          </td></tr>`).join('')}
        </table>
      </td></tr>

      <!-- TOP 3 GAPS -->
      <tr><td style="padding:24px 32px;border-bottom:1px solid #eee">
        <h3 style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4a5568;margin:0 0 16px">3 Critical Gaps Found</h3>
        ${gaps.map((g,i)=>`
        <div style="border-left:3px solid #c53030;padding:12px 0 12px 16px;margin-bottom:14px;${i<gaps.length-1?'border-bottom:1px solid #f5f5f5;padding-bottom:14px':''}">
          <div style="font-size:10px;font-weight:700;color:#c53030;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">GAP ${g.rank}</div>
          <div style="font-size:14px;font-weight:600;color:#0D1B2A;margin-bottom:6px">${g.title}</div>
          <div style="font-size:13px;color:#4a5568;line-height:1.6">${g.description}</div>
        </div>`).join('')}
      </td></tr>

      <!-- CTA BLOCK -->
      <tr><td style="padding:32px;background:#0D1B2A;text-align:center">
        <div style="font-size:13px;color:#B8C0CC;margin-bottom:8px">There are 7 more critical gaps in your full report — plus your complete fix plan</div>
        <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px;font-family:Georgia,serif">Unlock Your Full Brand Health Report</h2>
        <div style="color:#E8B84B;font-size:32px;font-weight:700;font-family:Georgia,serif;margin-bottom:4px">₦15,000</div>
        <div style="color:#B8C0CC;font-size:13px;margin-bottom:24px">one-time · instant delivery</div>
        <a href="https://cerebre.africa/app" style="background:#C9922A;color:#0D1B2A;text-decoration:none;font-weight:700;font-size:15px;padding:16px 40px;border-radius:8px;display:inline-block;letter-spacing:.03em">Get Full Report →</a>
        <p style="color:rgba(184,192,204,.4);font-size:11px;margin-top:16px">Secure payment via Paystack · Emailed instantly<br>Traditional brand audits cost ₦2–5M and take 8 weeks.</p>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:20px 32px;background:#080C14;text-align:center">
        <p style="color:rgba(184,192,204,.4);font-size:11px;margin:0;line-height:1.8">
          Cerebré Media Africa · Strategic Digital Intelligence<br>
          cerebre.africa · hello@cerebre.africa<br>
          <a href="#" style="color:rgba(184,192,204,.3);text-decoration:none">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── FULL REPORT EMAIL TEMPLATE ─────────────────────────────────
function buildFullEmailHTML(d, reference) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
      <tr><td style="background:#0D1B2A;padding:28px 32px;border-bottom:3px solid #C9922A">
        <h2 style="color:#fff;margin:0;font-size:18px">✅ Your Full Report is Ready</h2>
        <p style="color:#C9922A;margin:6px 0 0;font-size:13px">Payment confirmed · Ref: ${reference}</p>
      </td></tr>
      <tr><td style="padding:32px">
        <h1 style="color:#0D1B2A;font-size:22px;font-weight:700;margin:0 0 8px;font-family:Georgia,serif">Digital Brand Health Report: ${d.company_name}</h1>
        <p style="color:#4a5568;font-size:14px;line-height:1.7;margin-bottom:24px">Your comprehensive 9-section digital audit is ready. Open the app to view and download your full report as a premium PDF.</p>
        <div style="background:#f8f9fb;border:1px solid #dee2e8;border-radius:8px;padding:20px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-size:13px;color:#4a5568;font-weight:600">Overall Digital Score</span>
            <span style="font-size:22px;font-weight:700;color:${d.overall_score>=4?'#c05621':'#c53030'}">${(d.overall_score||0).toFixed(1)}/10</span>
          </div>
          <p style="color:#4a5568;font-size:13px;margin:0">${(d.executive_summary||{}).overview||''}</p>
        </div>
        <p style="color:#4a5568;font-size:14px;line-height:1.7"><strong style="color:#0D1B2A">Your report includes:</strong><br>
        ✓ All 10 strategic gaps · ✓ 30-day action plan · ✓ 12-month roadmap<br>
        ✓ Cerebré services proposal with ROI · ✓ Paid media analysis · ✓ Print-ready PDF</p>
        <a href="https://cerebre.africa/app" style="background:#C9922A;color:#0D1B2A;text-decoration:none;font-weight:700;font-size:15px;padding:16px 40px;border-radius:8px;display:inline-block;margin-top:8px">Open & Download My Report →</a>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#080C14;text-align:center">
        <p style="color:rgba(184,192,204,.4);font-size:11px;margin:0">Cerebré Media Africa · cerebre.africa · <a href="#" style="color:rgba(184,192,204,.3);text-decoration:none">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

