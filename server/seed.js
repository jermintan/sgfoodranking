// FILE: server/seed.js (FINAL VERSION - Saves all photos for gallery)

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

// --- SCRIPT CONFIGURATION ---
const SCRIPT_MODE = 'production'; // Set to 'production' for the final run
// --- END OF CONFIGURATION ---

const CONFIGS = {
  test: { maxQueries: 5, maxPages: 2, logMessage: "Starting TEST seed (Saves all photos)" },
  production: { maxQueries: 13, maxPages: 3, logMessage: "Starting FULL seed (Saves all photos)" }
};
const CONFIG = CONFIGS[SCRIPT_MODE];

const isProductionSeed = process.env.NODE_ENV === 'production';
let seedConnectionString;
if (isProductionSeed) {
  seedConnectionString = process.env.DATABASE_URL;
} else {
  seedConnectionString = `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`;
}
const seedPoolConfig = { connectionString: seedConnectionString };
if (isProductionSeed) {
  seedPoolConfig.ssl = { rejectUnauthorized: false };
}
const pool = new Pool(seedPoolConfig);

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.warn("WARN: GOOGLE_MAPS_API_KEY not found."); }
const PLACES_API_NEW_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.displayName,places.types,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.photos';

const allQueries = [
  'best chicken rice Singapore', 'best char kway teow Singapore', 'best laksa Singapore',
  'best hokkien mee Singapore', 'best bak chor mee Singapore', 'best satay Singapore',
  'best wanton mee Singapore', 'best chilli crab Singapore', 'best nasi lemak Singapore',
  'best roti prata Singapore', 'halal restaurants Singapore', 'vegetarian restaurants Singapore',
  'vegan restaurants Singapore'
];
const searchQueries = allQueries.slice(0, CONFIG.maxQueries);
const MAX_PAGES_PER_QUERY = CONFIG.maxPages;

// --- HELPER FUNCTIONS ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function inferDietaryInfo(place) {
  const name = place.displayName?.text || '';
  const nameLower = name.toLowerCase();
  const typesString = (place.types || []).join(' ').toLowerCase();
  const searchText = `${nameLower} ${typesString}`;
  const isHalal = /\b(halal|muslim)\b/i.test(searchText);
  const isVegetarian = /\b(vegetarian|vegan|plant-based)\b/i.test(searchText);
  return { isHalal, isVegetarian };
}

const priceLevelMap = {
  'PRICE_LEVEL_UNSPECIFIED': '$',
  'PRICE_LEVEL_FREE': 'Free',
  'PRICE_LEVEL_INEXPENSIVE': '$',
  'PRICE_LEVEL_MODERATE': '$$',
  'PRICE_LEVEL_EXPENSIVE': '$$$',
  'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
};

async function seedDatabase() {
  console.log(CONFIG.logMessage);
  let client;
  try {
    client = await pool.connect();
    console.log("Successfully connected to the database for seeding.");

    console.log("Purging old data from 'eateries' table...");
    await client.query('TRUNCATE TABLE eateries RESTART IDENTITY;');
    console.log("Old data purged successfully.");

    for (const query of searchQueries) {
      console.log(`\n--- Processing new query: "${query}" ---`);
      let nextPageToken = null;
      let pageCount = 0;
      do {
        pageCount++;
        console.log(` -> Fetching Page ${pageCount} of ${MAX_PAGES_PER_QUERY} for query "${query}"...`);

        const requestBody = {
          textQuery: query,
          maxResultCount: 20,
        };
        if (nextPageToken) requestBody.pageToken = nextPageToken;
        const headers = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        };

        const searchResponse = await axios.post(PLACES_API_NEW_URL, requestBody, { headers });
        const places = searchResponse.data.places;
        nextPageToken = searchResponse.data.nextPageToken;

        if (!places || places.length === 0) {
            console.log(`  -> No places found.`);
            break;
        }
        console.log(`  -> Found ${places.length} places. Preparing to process...`);

        for (const place of places) {
          let photoData = [];
          if (place.photos && place.photos.length > 0) {
            photoData = place.photos.map(p => ({ name: p.name }));
          }

          const { isHalal, isVegetarian } = inferDietaryInfo(place);
          const eatery = {
            name: place.displayName?.text,
            cuisine: place.types?.[0]?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Restaurant',
            neighbourhood: place.formattedAddress?.split(',').slice(-2)[0]?.trim() || 'Singapore',
            rating: place.rating || 0,
            review_count: place.userRatingCount || 0,
            price: priceLevelMap[place.priceLevel] || '$',
            photos: JSON.stringify(photoData),
            latitude: place.location?.latitude,
            longitude: place.location?.longitude,
            is_halal: isHalal,
            is_vegetarian: isVegetarian,
          };

          const insertQuery = `
            INSERT INTO public.eateries (
              name, cuisine, neighbourhood, rating, review_count, price, 
              photos, latitude, longitude, is_halal, is_vegetarian, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
            ON CONFLICT (name) DO UPDATE SET
              cuisine = EXCLUDED.cuisine, neighbourhood = EXCLUDED.neighbourhood, rating = EXCLUDED.rating,
              review_count = EXCLUDED.review_count, price = EXCLUDED.price, photos = EXCLUDED.photos,
              latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, is_halal = EXCLUDED.is_halal,
              is_vegetarian = EXCLUDED.is_vegetarian, updated_at = CURRENT_TIMESTAMP;
          `;
          const values = Object.values(eatery);
          try {
            await client.query(insertQuery, values);
          } catch (insertError) {
            console.error(`Error inserting/updating ${eatery.name}:`, insertError.message);
          }
        }
        console.log(`  -> Finished processing ${places.length} places.`);
      } while (nextPageToken && pageCount < MAX_PAGES_PER_QUERY);
    }
    console.log(`\n\n--- Seeding in ${SCRIPT_MODE.toUpperCase()} mode completed successfully! ---`);
  } catch (error) {
    console.error('An error occurred during seeding:', error.response ? error.response.data : error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log("Seed script database pool has ended.");
  }
}

seedDatabase();