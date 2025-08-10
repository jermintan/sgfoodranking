// FILE: server/index.js (GLOBAL SORT + CLEAN)
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
    // 1) Parse & normalize inputs
    const page  = Math.max(parseInt(req.query.page, 10)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const sort  = String(req.query.sort || 'rating_desc').toLowerCase(); // rating_desc | reviews_desc | name_asc | distance_asc

    const {
      is_halal,
      is_vegetarian,
      searchTerm,
      price,
      latitude,
      longitude,
      radius // km
    } = req.query;

    const offset = (page - 1) * limit;

    // 2) WHERE clause
    const where = [];
    const vals  = [];
    let p = 1;

    if (is_halal === 'true') {
      where.push(`is_halal = $${p++}`);
      vals.push(true);
    }
    if (is_vegetarian === 'true') {
      where.push(`is_vegetarian = $${p++}`);
      vals.push(true);
    }
    if (price && ['$', '$$', '$$$', '$$$$'].includes(price)) {
      where.push(`price = $${p++}`);
      vals.push(price);
    }

    if (searchTerm && searchTerm.trim() !== '') {
      const like = `%${searchTerm.trim()}%`;
      where.push(`(name ILIKE $${p} OR cuisine ILIKE $${p + 1} OR neighbourhood ILIKE $${p + 2})`);
      vals.push(like, like, like);
      p += 3;
    }

    // Location filter
    const userLat = Number(latitude);
    const userLng = Number(longitude);
    const radiusKm = Number(radius);
    const hasLocation =
      Number.isFinite(userLat) &&
      Number.isFinite(userLng) &&
      Number.isFinite(radiusKm) &&
      radiusKm > 0;

    if (hasLocation) {
      // keep results within radius (km)
      where.push(`haversine_distance($${p}, $${p + 1}, latitude, longitude) <= $${p + 2}`);
      vals.push(userLat, userLng, radiusKm);
      p += 3;
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 3) Count first
    const countSQL = `SELECT COUNT(*)::int AS cnt FROM eateries ${whereSQL}`;
    const { rows: countRows } = await pool.query(countSQL, vals);
    const totalItems = countRows[0]?.cnt ?? 0;
    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    // 4) Data query (GLOBAL ORDER BY, then LIMIT/OFFSET)
    const selectDistance = hasLocation
      ? `, haversine_distance($${p}, $${p + 1}, latitude, longitude) AS distance`
      : `, NULL AS distance`;

    // order map (safe, fixed strings)
    const SORTS = {
      rating_desc:  'rating DESC NULLS LAST, review_count DESC NULLS LAST, name ASC',
      reviews_desc: 'review_count DESC NULLS LAST, rating DESC NULLS LAST, name ASC',
      name_asc:     'name ASC, rating DESC NULLS LAST, review_count DESC NULLS LAST',
      distance_asc: hasLocation
        ? 'distance ASC, rating DESC NULLS LAST, name ASC'
        : 'rating DESC NULLS LAST, name ASC'
    };
    const orderBy = SORTS[sort] || SORTS.rating_desc;

    const dataVals = hasLocation
      ? [...vals, userLat, userLng, limit, offset]
      : [...vals, limit, offset];

    const dataSQL = `
      SELECT id, place_id, name, cuisine, neighbourhood, rating, review_count, price,
             photos, latitude, longitude, is_halal, is_vegetarian
             ${selectDistance}
      FROM eateries
      ${whereSQL}
      ORDER BY ${orderBy}
      LIMIT $${hasLocation ? p + 2 : p}
      OFFSET $${hasLocation ? p + 3 : p + 1};
    `;

    const { rows } = await pool.query(dataSQL, dataVals);

    // 5) Safe JSON parse for photos
    const eateries = rows.map(e => {
      let photos = [];
      if (Array.isArray(e.photos)) photos = e.photos;
      else if (typeof e.photos === 'string') {
        try { photos = JSON.parse(e.photos); } catch { photos = []; }
      }
      return { ...e, photos };
    });

    res.json({
      eateries,
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    });
  } catch (err) {
    console.error('Error executing query for all eateries:', err);
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
  return res.redirect(302, url);
});

// ---- Static serving ----
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
