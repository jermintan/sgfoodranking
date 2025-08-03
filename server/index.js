// FILE: server/index.js (FINAL - SIMPLIFIED API FOR DEPLOYMENT)

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
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`,
  ssl: isProductionApp ? { rejectUnauthorized: false } : false,
});

pool.query('SELECT NOW() AS now')
  .then(() => console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'}.`))
  .catch(err => console.error(`Error connecting to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'}:`, err.stack));

// --- API ENDPOINTS ---

// --- THIS IS THE SIMPLIFIED ENDPOINT ---
// It ignores all filters and just sends the first page of results.
app.get('/api/eateries', async (req, res) => {
  try {
    const limit = 20; // Default limit
    const offset = 0; // Always fetch the first page

    console.log("Simplified /api/eateries endpoint hit! Fetching all eateries.");
    
    const result = await pool.query('SELECT * FROM eateries ORDER BY rating DESC, name ASC LIMIT $1 OFFSET $2', [limit, offset]);
    const countResult = await pool.query('SELECT COUNT(*) FROM eateries');
    const totalItems = parseInt(countResult.rows[0].count, 10);

    const eateriesWithParsedPhotos = result.rows.map(eatery => ({
      ...eatery,
      photos: (typeof eatery.photos === 'string') ? JSON.parse(eatery.photos) : (eatery.photos || [])
    }));
    
    res.json({
      eateries: eateriesWithParsedPhotos,
      currentPage: 1,
      totalPages: Math.ceil(totalItems / limit)
    });

  } catch (err) {
    console.error('Error in simplified /api/eateries:', err.stack);
    res.status(500).send('Server Error');
  }
});

// --- SINGLE EATERY ENDPOINT (UNCHANGED) ---
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
    res.status(500).send('Server Error');
  }
});

// --- STATIC FILE SERVING FOR PRODUCTION ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
}
  
// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});