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
    const limit = parseInt(req.query.limit, 10) || 20; // Your items per page
    const { is_halal, is_vegetarian, searchTerm } = req.query;

    const offset = (page - 1) * limit;

    let conditions = [];
    let queryValuesForWhere = [];
    let paramIndex = 1;

    if (is_halal === 'true') {
      conditions.push(`is_halal = $${paramIndex++}`);
      queryValuesForWhere.push(true);
    }
    if (is_vegetarian === 'true') {
      conditions.push(`is_vegetarian = $${paramIndex++}`);
      queryValuesForWhere.push(true);
    }
    
    if (searchTerm && searchTerm.trim() !== '') {
        const searchPattern = `%${searchTerm.trim()}%`;
        const searchFields = ['name', 'cuisine', 'neighbourhood']; // Fields to search
        const searchSubConditions = searchFields.map(field => `${field} ILIKE $${paramIndex++}`);
        conditions.push(`(${searchSubConditions.join(' OR ')})`);
        searchFields.forEach(() => queryValuesForWhere.push(searchPattern));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Get total count
    const countQuery = `SELECT COUNT(*) FROM eateries ${whereClause}`;
    const totalItemsResult = await pool.query(countQuery, queryValuesForWhere);
    const totalItems = parseInt(totalItemsResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    // 2. Get paginated data
    let dataQueryValues = [...queryValuesForWhere];
    let dataQuery = `SELECT * FROM eateries ${whereClause} ORDER BY rating DESC, name ASC`;

    // Use current length of dataQueryValues to determine next paramIndex for LIMIT/OFFSET
    let finalParamIndexForLimitOffset = dataQueryValues.length + 1; 

    dataQuery += ` LIMIT $${finalParamIndexForLimitOffset++}`;
    dataQueryValues.push(limit);
    dataQuery += ` OFFSET $${finalParamIndexForLimitOffset++}`;
    dataQueryValues.push(offset);
    
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
    console.error('Error executing query for all eateries (paginated/searched):', err.stack);
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