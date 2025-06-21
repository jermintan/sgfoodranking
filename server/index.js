// FILE: server/index.js

// Load environment variables from .env file (if it exists)
require('dotenv').config();

const express = require('express');
const cors = require('cors'); // Make sure 'cors' is installed (npm install cors)
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// app.use(cors()); // We will replace this with more specific options
app.use(express.json());


// --- CONFIGURE CORS ---
const allowedOrigins = [
  'http://localhost:3000',         // For your local React dev server
  'https://www.sgfooddirectory.com', // Your new live frontend domain (primary)
  'https://sgfooddirectory.com',     // The root domain (secondary, good to include)
  'https://sgfoodranking.vercel.app' // Your old Vercel frontend domain (optional)
  // Add any other origins that need access in the future
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions)); // Apply the configured CORS options


// --- DATABASE CONNECTION for EXPRESS APP ---
const isProductionApp = process.env.NODE_ENV === 'production';
let appConnectionString;

if (isProductionApp) {
  appConnectionString = process.env.DATABASE_URL;
  if (!appConnectionString) {
    console.error("FATAL: DATABASE_URL not found in environment for production app.");
    process.exit(1);
  }
} else {
  appConnectionString = `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`;
}

const appPoolConfig = {
  connectionString: appConnectionString,
};

if (isProductionApp) {
  appPoolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(appPoolConfig);

// Test DB connection on startup
pool.connect((err, client, release) => {
  if (err) {
    return console.error(`Error acquiring client from pool for ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'} on startup:`, err.stack);
  }
  client.query('SELECT NOW() AS now', (err, result) => {
    release();
    if (err) {
      return console.error(`Error executing test query on ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'} on startup:`, err.stack);
    }
    if (result && result.rows && result.rows.length > 0) {
        console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB (Render)' : 'LOCAL DB'}. Test query result:`, result.rows[0].now);
    } else {
        console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB (Render)' : 'LOCAL DB'}. Test query ran, but no rows returned.`);
    }
  });
});


// --- API ENDPOINTS ---

// GET all eateries (with pagination and server-side search)
app.get('/api/eateries', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { 
        is_halal, is_vegetarian, searchTerm, price,
        latitude, longitude, radius // New location parameters
    } = req.query;

    const offset = (page - 1) * limit;

    let conditions = [];
    let queryValuesForWhere = [];
    let paramIndex = 1;

    // --- Standard Filters ---
    if (is_halal === 'true') { /* ... as before ... */ conditions.push(`is_halal = $${paramIndex++}`); queryValuesForWhere.push(true); }
    if (is_vegetarian === 'true') { /* ... as before ... */ conditions.push(`is_vegetarian = $${paramIndex++}`); queryValuesForWhere.push(true); }
    if (price && ['$','$$','$$$','$$$$'].includes(price)) { /* ... as before ... */ conditions.push(`price = $${paramIndex++}`); queryValuesForWhere.push(price); }
    
    if (searchTerm && searchTerm.trim() !== '') {
        const searchPattern = `%${searchTerm.trim()}%`;
        const searchFields = ['name', 'cuisine', 'neighbourhood'];
        const searchSubConditions = searchFields.map(field => `${field} ILIKE $${paramIndex++}`);
        conditions.push(`(${searchSubConditions.join(' OR ')})`);
        searchFields.forEach(() => queryValuesForWhere.push(searchPattern));
    }

    // --- Location Filter (Server-Side) ---
    // Ensure latitude, longitude, and radius are valid numbers if provided
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(searchRadius) && searchRadius > 0) {
      // Use the haversine_distance function created in your DB
      // The function takes (userLat, userLng, eatery.latitude, eatery.longitude)
      // Parameters for the function will be $${paramIndex}, $${paramIndex+1}
      // Parameter for the radius comparison will be $${paramIndex+2}
      conditions.push(
        `haversine_distance($${paramIndex++}, $${paramIndex++}, latitude, longitude) <= $${paramIndex++}`
      );
      queryValuesForWhere.push(userLat);
      queryValuesForWhere.push(userLng);
      queryValuesForWhere.push(searchRadius);
    }
    // --- End Location Filter ---

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Get total count
    const countQuery = `SELECT COUNT(*) FROM eateries ${whereClause}`;
    const totalItemsResult = await pool.query(countQuery, queryValuesForWhere);
    const totalItems = parseInt(totalItemsResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    // 2. Get paginated data
    let dataQueryValues = [...queryValuesForWhere]; // Values for WHERE clause
    let dataQuery = `SELECT *, 
                        ${(!isNaN(userLat) && !isNaN(userLng)) ? 
                            `haversine_distance(${userLat}, ${userLng}, latitude, longitude) AS distance` : 
                            'NULL AS distance'} 
                     FROM eateries ${whereClause}`;
    
    // ORDER BY: If location filter is active, sort by distance first, then rating. Otherwise, by rating.
    if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(searchRadius) && searchRadius > 0) {
        dataQuery += ` ORDER BY distance ASC, rating DESC, name ASC`;
    } else {
        dataQuery += ` ORDER BY rating DESC, name ASC`;
    }

    let finalParamIndexForLimitOffset = dataQueryValues.length + 1; // This needs to be dynamic based on params already in dataQueryValues for WHERE
                                                                  // The actual SQL parameters $1, $2 are built by the pg driver

    // Re-calculate paramIndex for LIMIT/OFFSET based on how many $n were used in queryValuesForWhere
    // The above 'paramIndex' already reflects the count after WHERE clause parameters.
    // So, the *next* available placeholders for LIMIT and OFFSET will start from this `paramIndex`.

    dataQuery += ` LIMIT $${paramIndex++}`; // paramIndex continues from where WHERE clause left off
    dataQueryValues.push(limit); // This value will be used for the LIMIT placeholder

    dataQuery += ` OFFSET $${paramIndex++}`; // paramIndex continues further
    dataQueryValues.push(offset); // This value will be used for the OFFSET placeholder
    
    // console.log('PAGINATION TEST - Count Query:', countQuery, queryValuesForWhere);
    // console.log('PAGINATION TEST - Paginated Data Query:', dataQuery, dataQueryValues);
    const result = await pool.query(dataQuery, dataQueryValues);

    res.json({
      eateries: result.rows,
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
    res.json(result.rows[0]);
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