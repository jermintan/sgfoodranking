// 1. Import necessary packages
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');

// 2. Create an Express app
const app = express();
// Render will set the PORT environment variable. For local dev, we default to 3001.
const PORT = process.env.PORT || 3001;

// 3. Set up middleware
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
// This robust setup works for both local development and production on Render.
const isProduction = process.env.NODE_ENV === 'production';

// Use the Render DATABASE_URL if it's in production, otherwise use local credentials.
const connectionString = isProduction 
  ? process.env.DATABASE_URL 
  : `postgresql://postgres:Chal1124!@localhost:5432/eatery_app`;

const pool = new Pool({
  connectionString: connectionString,
  // Only require SSL in production (on Render).
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// --- API ENDPOINTS ---

// GET all eateries
app.get('/api/eateries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM eateries ORDER BY rating DESC'); // Let's add a default sort
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query for all eateries', err.stack);
    res.status(500).send('Server Error');
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
    console.error('Error executing single eatery query', err.stack);
    res.status(500).send('Server Error');
  }
});

// Image Proxy Endpoint
app.get('/api/image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send('Image URL is required');
    }
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
    });
    res.setHeader('Content-Type', response.headers['content-type']);
    response.data.pipe(res);
  } catch (error)
    console.error('Image proxy error:', error.message);
    res.status(500).send('Error fetching image');
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});