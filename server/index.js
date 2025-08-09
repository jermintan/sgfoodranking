// FILE: server/index.js (CLEAN + WORKING)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ---- DB ----
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---- API: Eateries (list) ----
app.get('/api/eateries', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { is_halal, is_vegetarian, searchTerm, price, latitude, longitude, radius } = req.query;

    const offset = (page - 1) * limit;
    let conditions = [];
    let args = [];
    let i = 1;

    if (is_halal === 'true') { conditions.push(`is_halal = $${i++}`); args.push(true); }
    if (is_vegetarian === 'true') { conditions.push(`is_vegetarian = $${i++}`); args.push(true); }
    if (price && ['$','$$','$$$','$$$$'].includes(price)) { conditions.push(`price = $${i++}`); args.push(price); }

    if (searchTerm && searchTerm.trim()) {
      const patt = `%${searchTerm.trim()}%`;
      const fields = ['name','cuisine','neighbourhood'];
      conditions.push(`(${fields.map(() => `${fields.shift()} ILIKE $${i++}`).join(' OR ')})`);
      args.push(patt, patt, patt);
    }

    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(searchRadius) && searchRadius > 0) {
      conditions.push(`haversine_distance($${i++}, $${i++}, latitude, longitude) <= $${i++}`);
      args.push(userLat, userLng, searchRadius);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM eateries ${where}`, args);
    const totalItems = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    const order =
      (!isNaN(userLat) && !isNaN(userLng) && !isNaN(searchRadius) && searchRadius > 0)
        ? `ORDER BY distance ASC, rating DESC, name ASC`
        : `ORDER BY rating DESC, name ASC`;

    const dataArgs = args.slice();
    const distSel = (!isNaN(userLat) && !isNaN(userLng))
      ? `haversine_distance(${userLat}, ${userLng}, latitude, longitude) AS distance`
      : `NULL AS distance`;

    dataArgs.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT *, ${distSel} FROM eateries ${where} ${order} LIMIT $${i++} OFFSET $${i++}`,
      dataArgs
    );

    const eateries = dataRes.rows.map(e => ({
      ...e,
      photos: (typeof e.photos === 'string') ? JSON.parse(e.photos) : (e.photos || [])
    }));

    res.json({ eateries, currentPage: page, totalPages, totalItems, itemsPerPage: limit });
  } catch (err) {
    console.error('Error executing query for all eateries:', err.stack);
    res.status(500).send('Server Error retrieving eateries');
  }
});

// ---- API: Single eatery ----
app.get('/api/eateries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM eateries WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Eatery not found' });

    const eatery = result.rows[0];
    eatery.photos = (typeof eatery.photos === 'string') ? JSON.parse(eatery.photos) : (eatery.photos || []);
    res.json(eatery);
  } catch (err) {
    console.error('Error executing single eatery query:', err.stack);
    res.status(500).send('Server Error retrieving single eatery');
  }
});

// ---- API: Photo proxy (placed BEFORE static) ----
app.get('/api/photo', (req, res) => {
  const { name, h = '400' } = req.query;
  if (!name) return res.status(400).send('Missing photo name');

  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY;
  if (!key) return res.status(500).send('Maps API key not configured');

  const url = `https://places.googleapis.com/v1/${name}/media?maxHeightPx=${h}&key=${key}`;
  // Simple, reliable: redirect to Google Places media
  return res.redirect(302, url);
});

// ---- Static serving (ONE block) ----
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
}

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
