// FILE: server/index.js (FINAL VERSION - Correctly handles the 'photos' column)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');

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

// Test DB connection on startup
pool.query('SELECT NOW() AS now')
  .then(res => console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB (Render)' : 'LOCAL DB'}. Test query result:`, res.rows[0].now))
  .catch(err => console.error(`Error connecting to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'} on startup:`, err.stack));


// --- API ENDPOINTS ---

// GET all eateries (with pagination and server-side search)
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

    // --- Standard Filters ---
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

    // --- Location Filter ---
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(searchRadius) && searchRadius > 0) {
      conditions.push(
        `haversine_distance($${paramIndex++}, $${paramIndex++}, latitude, longitude) <= $${paramIndex++}`
      );
      queryValuesForWhere.push(userLat);
      queryValuesForWhere.push(userLng);
      queryValuesForWhere.push(searchRadius);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Get total count
    const countQuery = `SELECT COUNT(*) FROM eateries ${whereClause}`;
    const totalItemsResult = await pool.query(countQuery, queryValuesForWhere);
    const totalItems = parseInt(totalItemsResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    // 2. Get paginated data
    let dataQueryValues = [...queryValuesForWhere];
    let dataQuery = `SELECT *, 
                        ${(!isNaN(userLat) && !isNaN(userLng)) ? 
                            `haversine_distance(${userLat}, ${userLng}, latitude, longitude) AS distance` : 
                            'NULL AS distance'} 
                     FROM eateries ${whereClause}`;
    
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

    // --- NEW FIX FOR PHOTOS ---
    // The ListingCard needs a single image URL to display. We will add it here.
    const eateriesWithMainPhoto = result.rows.map(eatery => {
      let mainPhotoUrl = 'https://via.placeholder.com/400x400.png?text=No+Image';
      // The 'photos' column is a JSON string. We must parse it.
      const photosArray = (typeof eatery.photos === 'string') ? JSON.parse(eatery.photos) : (eatery.photos || []);
      
      if (photosArray.length > 0) {
        // We can just send the photo reference name. The frontend will build the full URL.
        // This keeps the backend simpler.
      }
      return {
        ...eatery,
        photos: photosArray // Send the parsed array
      };
    });
    // --- END OF FIX ---

    res.json({
      eateries: eateriesWithMainPhoto,
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

// GET a single eatery by ID
app.get('/api/eateries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM eateries WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Eatery not found' });
    }

    const eatery = result.rows[0];

    // --- NEW FIX FOR PHOTOS ---
    // The 'photos' column is stored as a JSON string. We parse it into a real array.
    if (typeof eatery.photos === 'string') {
      eatery.photos = JSON.parse(eatery.photos);
    } else {
      // If photos is null or not a string, ensure it's an empty array
      eatery.photos = eatery.photos || [];
    }
    // --- END OF FIX ---

    res.json(eatery);
  } catch (err) {
    console.error('Error executing single eatery query:', err.stack);
    res.status(500).send('Server Error retrieving single eatery');
  }
});


// Image Proxy Endpoint
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


// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});