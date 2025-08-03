// FILE: server/manualAdd.js

require('dotenv').config();
const { Pool } = require('pg');

// --- 1. EDIT THE EATERY DETAILS HERE ---
const newEatery = {
  name: "My Awesome New Cafe", // Required: Must be unique
  cuisine: "Coffee & Pastries",
  neighbourhood: "Tiong Bahru",
  rating: 4.8,
  review_count: 150,
  price: '$$', // Use '$', '$$', '$$$', etc.
  // Optional: Provide a direct URL to an image, or leave it for a placeholder
  image_url: 'https://images.unsplash.com/your-image-here.jpg', 
  latitude: 1.2809,  // Optional: Get from Google Maps
  longitude: 103.8319, // Optional: Get from Google Maps
  is_halal: false,
  is_vegetarian: true
};
// --- END OF EDITS ---


// --- DATABASE CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});


async function addEatery() {
  // Use a placeholder if no image_url is provided
  if (!newEatery.image_url) {
    newEatery.image_url = 'https://via.placeholder.com/400x400.png?text=No+Image';
    console.log("No image URL provided. Using default placeholder.");
  }

  console.log(`Attempting to add/update eatery: "${newEatery.name}"`);

  const client = await pool.connect();
  try {
    const insertQuery = `
      INSERT INTO public.eateries (
        name, cuisine, neighbourhood, rating, review_count, price, image_url, 
        latitude, longitude, is_halal, is_vegetarian, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET
        cuisine = EXCLUDED.cuisine,
        neighbourhood = EXCLUDED.neighbourhood,
        rating = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        price = EXCLUDED.price,
        image_url = EXCLUDED.image_url,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_halal = EXCLUDED.is_halal,
        is_vegetarian = EXCLUDED.is_vegetarian,
        updated_at = CURRENT_TIMESTAMP;
    `;

    const values = [
      newEatery.name, newEatery.cuisine, newEatery.neighbourhood, newEatery.rating,
      newEatery.review_count, newEatery.price, newEatery.image_url, newEatery.latitude,
      newEatery.longitude, newEatery.is_halal, newEatery.is_vegetarian
    ];

    const res = await client.query(insertQuery, values);

    if (res.rowCount > 0) {
      console.log(`✅ Success! "${newEatery.name}" was successfully inserted or updated in the database.`);
    } else {
      // This case typically happens if the ON CONFLICT update resulted in no actual data change.
      console.log(`✅ "${newEatery.name}" already exists and is up-to-date.`);
    }

  } catch (error) {
    console.error('❌ Error adding eatery:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log("Manual add script finished.");
  }
}

addEatery();