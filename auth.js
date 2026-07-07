const crypto = require('crypto');

const API_TOKEN = process.env.API_TOKEN || '';

function requireApiToken(req, res, next) {
  if (!API_TOKEN) {
    return res.status(500).json({ error: 'API_TOKEN not configured on server' });
  }

  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const provided = Buffer.from(match ? match[1] : '');
  const expected = Buffer.from(API_TOKEN);

  const valid = provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected);

  if (!valid) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

module.exports = { requireApiToken };
