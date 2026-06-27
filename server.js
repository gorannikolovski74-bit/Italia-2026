const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const BOOKMARKS_FILE = path.join(__dirname, 'bookmarks.json');
const EXPENSES_FILE = path.join(__dirname, 'expenses.json');
const CHAT_FILE = path.join(__dirname, 'chat.json');

function loadChat() {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
    }
  } catch (e) {}
  return { history: [], display: [], updatedAt: 0 };
}

function saveChat(data) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function loadBookmarks() {
  try {
    if (fs.existsSync(BOOKMARKS_FILE)) {
      return JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveBookmarks(list) {
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function loadExpenses() {
  try {
    if (fs.existsSync(EXPENSES_FILE)) {
      return JSON.parse(fs.readFileSync(EXPENSES_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveExpenses(list) {
  fs.writeFileSync(EXPENSES_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// ── GitHub Auto-Deploy Webhook (must be BEFORE express.json) ──────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'italia2026deploy';

app.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const sig = req.headers['x-hub-signature-256'] || '';
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  const digest = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  let valid = false;
  try {
    valid = sig.length === digest.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  } catch (e) { valid = false; }

  if (!valid) return res.status(401).send('Unauthorized');

  res.json({ ok: true });
  setTimeout(() => {
    try {
      execSync('git pull origin main', { cwd: __dirname, stdio: 'inherit' });
      execSync('pm2 restart italia-2026', { stdio: 'inherit' });
      console.log('[webhook] Deploy successful');
    } catch (e) {
      console.error('[webhook] Deploy error:', e.message);
    }
  }, 100);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Bookmarks API ────────────────────────────────────────────────────
app.get('/api/bookmarks', (req, res) => {
  res.json(loadBookmarks());
});

app.post('/api/bookmarks', (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  const list = loadBookmarks();
  const item = { id: Date.now().toString(), name, url };
  list.push(item);
  saveBookmarks(list);
  res.json(item);
});

app.delete('/api/bookmarks/:id', (req, res) => {
  const list = loadBookmarks().filter(b => b.id !== req.params.id);
  saveBookmarks(list);
  res.json({ ok: true });
});

// ── Expenses API ─────────────────────────────────────────────────────
app.get('/api/expenses', (req, res) => {
  res.json(loadExpenses());
});

app.post('/api/expenses', (req, res) => {
  const { date, category, label, amount } = req.body;
  if (!label || amount == null) return res.status(400).json({ error: 'label and amount required' });
  const list = loadExpenses();
  const item = {
    id: Date.now().toString(),
    date: date || new Date().toISOString().slice(0, 10),
    category: category || 'Друго',
    label,
    amount: Number(amount)
  };
  list.push(item);
  saveExpenses(list);
  res.json(item);
});

app.delete('/api/expenses/:id', (req, res) => {
  const list = loadExpenses().filter(e => e.id !== req.params.id);
  saveExpenses(list);
  res.json({ ok: true });
});

// ── Chat history (synced across devices) ─────────────────────────────
app.get('/api/chat-history', (req, res) => {
  res.json(loadChat());
});

app.post('/api/chat-history', (req, res) => {
  const { history, display } = req.body;
  const data = {
    history: Array.isArray(history) ? history : [],
    display: Array.isArray(display) ? display : [],
    updatedAt: Date.now()
  };
  saveChat(data);
  res.json({ ok: true, updatedAt: data.updatedAt });
});

app.delete('/api/chat-history', (req, res) => {
  saveChat({ history: [], display: [], updatedAt: Date.now() });
  res.json({ ok: true });
});

// ── Anthropic proxy ──────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': ANTHROPIC_API_KEY
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Anthropic proxy error:', err);
    res.status(502).json({ error: 'Failed to reach Anthropic API' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Italia 2026 Dashboard running on http://0.0.0.0:${PORT}`);
});
