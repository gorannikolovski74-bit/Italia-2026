const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const BOOKMARKS_FILE = path.join(__dirname, 'bookmarks.json');

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
