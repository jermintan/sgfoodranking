// FILE: server/index.js (FINAL - CORRECTED FILE PATH)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const isProductionApp = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:Chal1234!@localhost:5432/eatery_app?sslmode=disable`,
  ssl: isProductionApp ? { rejectUnauthorized: false } : false,
});

pool.query('SELECT NOW() AS now')
  .then(res => console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'}.`))
  .catch(err => console.error(`Error connecting to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'}:`, err.stack));


// --- API ENDPOINTS ---
app.get('/api/eateries', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { 
        is_halal, is_vegetarian, searchTerm, price,
        latitude, longitude, radius
    } = req.query;

    const offset = (page - 1) * limit;
    let conditions = [];
    let queryValuesForWhere = [];
    let paramIndex = 1;

    if (is_halal === 'true') { conditions.push(`is_halal = $${paramIndex++}`); queryValuesForWhere.push(true); }
    if (is_vegetarian === 'true') { conditions.push(`is_vegetarian = $${paramIndex++}`); queryValuesForWhere.push(true); }
    if (price && ['$','$$','$$$','$$$$'].includes(price)) { conditions.push(`price = $${paramIndex++}`); queryValuesForWhere.push(price); }
    
    if (searchTerm && searchTerm.trim() !== '') {
        const searchPattern = `%${searchTerm.trim()}%`;
        const searchFields = ['name', 'cuisine', 'neighbourhood'];
        const searchSubConditions = searchFields.map(field => `${field} ILIKE $${paramIndex++}`);
        conditions.push(`(${searchSubConditions.join(' OR ')})`);
        searchFields.forEach(() => queryValuesForWhere.push(searchPattern));
    }

    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(searchRadius) && searchRadius > 0) {
      conditions.push(`haversine_distance($${paramIndex++}, $${paramIndex++}, latitude, longitude) <= $${paramIndex++}`);
      queryValuesForWhere.push(userLat);
      queryValuesForWhere.push(userLng);
      queryValuesForWhere.push(searchRadius);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*) FROM eateries ${whereClause}`;
    const totalItemsResult = await pool.query(countQuery, queryValuesForWhere);
    const totalItems = parseInt(totalItemsResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    let dataQueryValues = [...queryValuesForWhere];
    let dataQuery = `SELECT *, ${(!isNaN(userLat) && !isNaN(userLng)) ? `haversine_distance(${userLat}, ${userLng}, latitude, longitude) AS distance` : 'NULL AS distance'} FROM eateries ${whereClause}`;
    
    if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(searchRadius) && searchRadius > 0) {
        dataQuery += ` ORDER BY distance ASC, rating DESC, name ASC`;
    } else {
        dataQuery += ` ORDER BY rating DESC, name ASC`;
    }

    dataQuery += ` LIMIT $${paramIndex++}`;
    dataQueryValues.push(limit);
    dataQuery += ` OFFSET $${paramIndex++}`;
    dataQueryValues.push(offset);
    
    const result = await pool.query(dataQuery, dataQueryValues);

    const eateriesWithParsedPhotos = result.rows.map(eatery => ({
      ...eatery,
      photos: (typeof eatery.photos === 'string') ? JSON.parse(eatery.photos) : (eatery.photos || [])
    }));

    res.json({
      eateries: eateriesWithParsedPhotos,
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: limit
    });
  } catch (err) {
    console.error('Error executing query for all eateries:', err.stack);
    res.status(500).send('Server Error retrieving eateries');
  }
});

app.get('/api/eateries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM eateries WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Eatery not found' });
    }
    const eatery = result.rows[0];
    eatery.photos = (typeof eatery.photos === 'string') ? JSON.parse(eatery.photos) : (eatery.photos || []);
    res.json(eatery);
  } catch (err) {
    console.error('Error executing single eatery query:', err.stack);
    res.status(500).send('Server Error retrieving single eatery');
  }
});


// --- STATIC FILE SERVING FOR PRODUCTION ---
if (process.env.NODE_ENV === 'production') {
  // --- THIS IS THE ONLY CHANGE - THE PATH IS NOW CORRECT ---
  // The server is in /server, the build is in /build. We go up one level.
  app.use(express.static(path.join(__dirname, '../build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
}
  
// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});