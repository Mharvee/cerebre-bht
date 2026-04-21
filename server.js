import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import generateRouter   from './api/generate.js';
import sendReportRouter from './api/send-report.js';
import webhookRouter    from './api/webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Raw body for Paystack webhook — MUST come before express.json ──
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// ── JSON body parser for all other routes ──
app.use(express.json({ limit: '4mb' }));

// ── CORS ──
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── API routes — MUST come before static middleware ──
app.use('/api/generate',    generateRouter);
app.use('/api/send-report', sendReportRouter);
app.use('/api/webhook',     webhookRouter);

// ── Named pages ──
app.get('/',    (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));

// ── Static files — after API routes so /api/* is never intercepted ──
app.use(express.static(__dirname, {
  // Never serve the api/ folder as static files
  setHeaders: (res, filePath) => {
    if (filePath.includes(path.join(__dirname, 'api'))) {
      res.status(404).end();
    }
  },
}));

const server = app.listen(PORT, () => console.log(`✓ Cerebre server running on port ${PORT}`));

server.timeout          = 300000;
server.keepAliveTimeout = 305000;
server.headersTimeout   = 310000;