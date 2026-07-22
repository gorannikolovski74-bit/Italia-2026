// One-off migration: makes "Italia 2026" the first row in the new `trips`
// table. Safe to run multiple times — it no-ops if that trip already exists.
// Usage: node migrate.js
const db = require('./db');

const ITALIA_2026_TRIP = {
  id: 'italia-2026',
  name: 'Italia 2026',
  destination: 'Салерно, Италија',
  startDate: '2026-06-29',
  endDate: '2026-07-06',
  travelers: 3,
  currency: 'EUR',
  budgetTotal: 1800,
};

function migrate() {
  const existing = db.prepare('SELECT id FROM trips WHERE id = ?').get(ITALIA_2026_TRIP.id);
  if (existing) {
    console.log(`[migrate] Trip "${ITALIA_2026_TRIP.id}" already exists, skipping.`);
    return;
  }

  db.prepare(`
    INSERT INTO trips (id, name, destination, startDate, endDate, travelers, currency, budgetTotal, updatedAt, deleted)
    VALUES (@id, @name, @destination, @startDate, @endDate, @travelers, @currency, @budgetTotal, @updatedAt, 0)
  `).run({ ...ITALIA_2026_TRIP, updatedAt: Date.now() });

  console.log(`[migrate] Created trip "${ITALIA_2026_TRIP.name}" (id=${ITALIA_2026_TRIP.id}).`);
}

migrate();
