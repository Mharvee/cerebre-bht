import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static HTML files
app.use(express.static(__dirname));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Homepage — serve landing.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
});

// App route
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});

// API proxy route
app.post('/api/generate', async (req, res) => {
  try {
    const body = req.body;

    if (!body.messages || !body.model) {
      return res.status(400).json({ error: { message: 'Missing required fields: messages, model' } });
    }

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
        max_tokens: body.max_tokens || 16000,
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
    console.error('Server error:', err);
    return res.status(500).json({
      error: { message: 'Internal server error: ' + err.message }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Cerebré server running on port ${PORT}`);
});