// FILE: server/index.js (FINAL DEPLOYMENT VERSION)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const path = require('path'); // <<< --- ADDITION #1: Import the 'path' module

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// --- CONFIGURE CORS ---
const allowedOrigins = [
  'http://localhost:3000',
  'https://www.sgfooddirectory.com',
  'https://sgfooddirectory.com',
  'https://sgfoodranking.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// --- DATABASE CONNECTION ---
const isProductionApp = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`,
  ssl: isProductionApp ? { rejectUnauthorized: false } : false,
});

pool.query('SELECT NOW() AS now')
  .then(res => console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB (Render)' : 'LOCAL DB'}. Test query result:`, res.rows[0].now))
  .catch(err => console.error(`Error connecting to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'} on startup:`, err.stack));


// --- API ENDPOINTS ---
// (Your existing, full-featured API endpoints are unchanged)

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

app.get('/api/image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send('Image URL is required');
    }
    const imageApiResponse = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
    });
    res.setHeader('Content-Type', imageApiResponse.headers['content-type']);
    imageApiResponse.data.pipe(res);
  } catch (error) {
    console.error('Image proxy error:', error.message);
    if (error.response) {
        console.error('Image proxy error response status:', error.response.status);
    }
    res.status(error.response?.status || 500).send('Error fetching image');
  }
});

// --- ADDITION #2: STATIC FILE SERVING FOR PRODUCTION ---
// This code must be AFTER your API routes and BEFORE app.listen()
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app's 'build' directory
  // The path goes ../ up one level from 'server' to the root, then into 'build'
  app.use(express.static(path.join(__dirname, '../build')));

  // The "catchall" handler: for any request that doesn't match an API route,
  // send back React's index.html file. This allows React Router to work.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
}
// --- END OF ADDITION #2 ---
  
// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Removed the duplicate log message for API availability
});