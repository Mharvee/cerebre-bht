
export default async function handler(req, res) {
  // CORS headers — update ALLOWED_ORIGIN in Vercel env vars to your actual domain
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // Validate required fields
    if (!body.messages || !body.model) {
      return res.status(400).json({ error: { message: 'Missing required fields: messages, model' } });
    }

    // Log the request (upgrade to Redis-based rate limiting for high volume)
    console.log(`Report request: ${new Date().toISOString()} | Model: ${body.model}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-4-6',
        max_tokens: body.max_tokens || 16000, // Increased from 8000 — full report JSON is large
        system: body.system,
        tools: body.tools || [],
        messages: body.messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({
      error: { message: 'Internal server error: ' + err.message }
    });
  }
}
