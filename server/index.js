// 1. Import necessary packages
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios'); // <-- THE FIX

// 2. Create an Express app
const app = express();
const PORT = 3001;

// 3. Set up middleware
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'eatery_app',
  password: 'Chal1124!', // Make sure this is correct
  port: 5432,
});

// --- API ENDPOINTS ---
app.get('/api/eateries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM eateries');
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server Error');
  }
});

app.get('/api/eateries/:id', async (req, res) => {
  try {
    const { id } = req.params; // Get the ID from the URL parameter
    console.log(`Request received for a single eatery with ID: ${id}`);
    
    // Query the database for the specific eatery
    const result = await pool.query('SELECT * FROM eateries WHERE id = $1', [id]);
    
    // Check if we found an eatery
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Eatery not found' });
    }
    
    // Send the first (and only) result back as JSON
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
  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.status(500).send('Error fetching image');
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});