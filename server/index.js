// FILE: server/index.js

// Load environment variables from .env file (if it exists)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios'); // Used for image proxy

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION for EXPRESS APP ---
const isProductionApp = process.env.NODE_ENV === 'production';
let appConnectionString;

if (isProductionApp) {
  // For production, use DATABASE_URL from .env (should be Render's external URL)
  appConnectionString = process.env.DATABASE_URL;
  if (!appConnectionString) {
    console.error("FATAL: DATABASE_URL not found in environment for production app.");
    process.exit(1);
  }
} else {
  // For LOCAL development: explicitly add sslmode=disable
  appConnectionString = `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`;
}

const appPoolConfig = {
  connectionString: appConnectionString,
};

// If in production (Render), ensure SSL is configured as Render requires it.
if (isProductionApp) {
  appPoolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(appPoolConfig);

// Test DB connection on startup
pool.connect((err, client, release) => {
  if (err) {
    return console.error(`Error acquiring client from pool for ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'} on startup:`, err.stack);
  }
  client.query('SELECT NOW() AS now', (err, result) => { // Added alias 'now' for clarity
    release();
    if (err) {
      return console.error(`Error executing test query on ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'} on startup:`, err.stack);
    }
    if (result && result.rows && result.rows.length > 0) {
        console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB (Render)' : 'LOCAL DB'}. Test query result:`, result.rows[0].now);
    } else {
        console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB (Render)' : 'LOCAL DB'}. Test query ran, but no rows returned (this is odd for SELECT NOW()).`);
    }
  });
});


// --- API ENDPOINTS ---

// GET all eateries (NOW WITH PAGINATION)
app.get('/api/eateries', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20; // Your current items per page
    const { is_halal, is_vegetarian, searchTerm } = req.query; // Added searchTerm

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

    // Add server-side search condition
    if (searchTerm && searchTerm.trim() !== '') {
      // Search across name, cuisine, and neighbourhood
      // Using ILIKE for case-insensitive partial matching
      conditions.push(
        `(name ILIKE $${paramIndex} OR cuisine ILIKE $${paramIndex} OR neighbourhood ILIKE $${paramIndex})`
      );
      queryValuesForWhere.push(`%${searchTerm.trim()}%`); // Add wildcards for partial match
      paramIndex++; // Note: paramIndex is incremented once for the group, but $${paramIndex} is used three times.
                     // A better way for multiple fields is to use separate placeholders if the DB driver requires it,
                     // or ensure the driver correctly handles repeated placeholders for the same value.
                     // For simplicity here, we assume the driver handles it or you'd adjust.
                     // A SAFER WAY for multiple ILIKEs on the same term:
      // conditions.push(
      //   `(name ILIKE $${paramIndex++} OR cuisine ILIKE $${paramIndex++} OR neighbourhood ILIKE $${paramIndex++})`
      // );
      // queryValuesForWhere.push(`%${searchTerm.trim()}%`);
      // queryValuesForWhere.push(`%${searchTerm.trim()}%`);
      // queryValuesForWhere.push(`%${searchTerm.trim()}%`);
      // For this example, let's use the simpler one first, assuming pg handles it.
      // If not, use the version above with paramIndex incremented for each field.
      // **Correction for clarity and safety with parameter indexing:**
      // Let's ensure distinct parameter indexes if the search term is used multiple times in OR conditions
    }
    
    // --- Corrected Search Condition Logic ---
    let searchCondition = '';
    if (searchTerm && searchTerm.trim() !== '') {
        const searchPattern = `%${searchTerm.trim()}%`;
        const searchFields = ['name', 'cuisine', 'neighbourhood'];
        const searchSubConditions = searchFields.map(field => `${field} ILIKE $${paramIndex++}`);
        searchCondition = `(${searchSubConditions.join(' OR ')})`;
        conditions.push(searchCondition);
        searchFields.forEach(() => queryValuesForWhere.push(searchPattern));
    }
    // --- End Corrected Search Condition Logic ---


    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Get total count
    const countQuery = `SELECT COUNT(*) FROM eateries ${whereClause}`;
    const totalItemsResult = await pool.query(countQuery, queryValuesForWhere);
    const totalItems = parseInt(totalItemsResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    // 2. Get paginated data
    let dataQueryValues = [...queryValuesForWhere]; // Use the same values for where clause
    let dataQuery = `SELECT * FROM eateries ${whereClause} ORDER BY rating DESC, name ASC`;

    // Reset paramIndex for LIMIT/OFFSET or ensure it's distinct from WHERE clause params
    // Let's re-calculate paramIndex based on the length of dataQueryValues for safety
    let finalParamIndex = dataQueryValues.length + 1; 

    dataQuery += ` LIMIT $${finalParamIndex++}`;
    dataQueryValues.push(limit);
    dataQuery += ` OFFSET $${finalParamIndex++}`;
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