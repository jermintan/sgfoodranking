// FILE: server/index.js (FINAL DEBUGGING VERSION)

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
  .then(res => console.log(`Successfully connected to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'}.`))
  .catch(err => console.error(`Error connecting to ${isProductionApp ? 'PRODUCTION DB' : 'LOCAL DB'}:`, err.stack));

// --- API ENDPOINTS ---

app.get('/api/eateries', async (req, res) => {
  try {
    // --- DEBUG LOG #1 ---
    console.log("LOG: /api/eateries endpoint was hit.");

    const result = await pool.query('SELECT * FROM eateries ORDER BY rating DESC, name ASC');
    
    // --- DEBUG LOG #2 ---
    console.log(`LOG: Database query returned ${result.rows.length} rows.`);

    const eateriesWithParsedPhotos = result.rows.map(eatery => ({
      ...eatery,
      photos: (typeof eatery.photos === 'string') ? JSON.parse(eatery.photos) : (eatery.photos || [])
    }));
    
    // --- DEBUG LOG #3 ---
    console.log("LOG: Sending successful response to frontend.");
    
    res.json({
      eateries: eateriesWithParsedPhotos,
      totalPages: Math.ceil(result.rows.length / 20)
    });

  } catch (err) {
    // --- DEBUG LOG #4 (for errors) ---
    console.error('LOG: An error occurred in /api/eateries endpoint:', err.stack);
    res.status(500).send('Server Error');
  }
});

// (The rest of the file is the same)
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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
}
  
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});