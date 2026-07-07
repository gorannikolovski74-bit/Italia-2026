const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

const selectTrip = db.prepare('SELECT * FROM trips WHERE id = ? AND deleted = 0');
const selectAllTrips = db.prepare('SELECT * FROM trips WHERE deleted = 0 ORDER BY updatedAt DESC');
const selectAnyTripById = db.prepare('SELECT id FROM trips WHERE id = ?');
const insertTrip = db.prepare(`
  INSERT INTO trips (id, name, destination, startDate, endDate, travelers, currency, budgetTotal, updatedAt, deleted)
  VALUES (@id, @name, @destination, @startDate, @endDate, @travelers, @currency, @budgetTotal, @updatedAt, 0)
`);
const updateTrip = db.prepare(`
  UPDATE trips
  SET name = @name, destination = @destination, startDate = @startDate, endDate = @endDate,
      travelers = @travelers, currency = @currency, budgetTotal = @budgetTotal, updatedAt = @updatedAt
  WHERE id = @id AND deleted = 0
`);
const softDeleteTrip = db.prepare('UPDATE trips SET deleted = 1, updatedAt = ? WHERE id = ? AND deleted = 0');

function validateTripBody(body) {
  const { name, destination, startDate, endDate, travelers, currency, budgetTotal } = body;
  if (typeof name !== 'string' || !name.trim()) return 'name is required';
  if (typeof destination !== 'string' || !destination.trim()) return 'destination is required';
  if (typeof startDate !== 'string' || !startDate.trim()) return 'startDate is required';
  if (typeof endDate !== 'string' || !endDate.trim()) return 'endDate is required';
  if (!Number.isInteger(travelers) || travelers < 1) return 'travelers must be a positive integer';
  if (typeof currency !== 'string' || !currency.trim()) return 'currency is required';
  if (typeof budgetTotal !== 'number' || !Number.isFinite(budgetTotal) || budgetTotal < 0) {
    return 'budgetTotal must be a non-negative number';
  }
  return null;
}

router.get('/', (req, res) => {
  res.json(selectAllTrips.all());
});

router.get('/:id', (req, res) => {
  const trip = selectTrip.get(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(trip);
});

router.post('/', (req, res) => {
  const error = validateTripBody(req.body);
  if (error) return res.status(400).json({ error });

  // The mobile client generates the id offline (Room needs a stable primary
  // key before the server confirms the row), so honor a client-supplied id
  // instead of always minting our own — otherwise the local and remote
  // copies of the same trip would end up under different ids.
  const id = typeof req.body.id === 'string' && req.body.id.trim() ? req.body.id : crypto.randomUUID();
  if (selectAnyTripById.get(id)) {
    return res.status(409).json({ error: 'Trip with this id already exists' });
  }

  const trip = {
    id,
    name: req.body.name,
    destination: req.body.destination,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    travelers: req.body.travelers,
    currency: req.body.currency,
    budgetTotal: req.body.budgetTotal,
    updatedAt: Date.now(),
  };
  insertTrip.run(trip);
  res.status(201).json(trip);
});

router.put('/:id', (req, res) => {
  const existing = selectTrip.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trip not found' });

  const error = validateTripBody(req.body);
  if (error) return res.status(400).json({ error });

  const trip = {
    id: req.params.id,
    name: req.body.name,
    destination: req.body.destination,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    travelers: req.body.travelers,
    currency: req.body.currency,
    budgetTotal: req.body.budgetTotal,
    updatedAt: Date.now(),
  };
  updateTrip.run(trip);
  res.json(trip);
});

router.delete('/:id', (req, res) => {
  const existing = selectTrip.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trip not found' });

  softDeleteTrip.run(Date.now(), req.params.id);
  res.json({ ok: true });
});

module.exports = router;
