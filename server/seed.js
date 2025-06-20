// FILE: server/seed.js

// Load environment variables from .env file (if it exists and is configured for this script)
require('dotenv').config();

const axios = require('axios');
const { Pool } = require('pg');

// --- DATABASE CONNECTION for SEED SCRIPT ---
const isProductionSeed = process.env.NODE_ENV === 'production';
let seedConnectionString;

if (isProductionSeed) {
  // For production, use DATABASE_URL from .env (should be Render's external URL)
  seedConnectionString = process.env.DATABASE_URL;
  if (!seedConnectionString) {
    console.error("FATAL: DATABASE_URL not found in environment for production seed.");
    process.exit(1);
  }
} else {
  // For LOCAL development: explicitly add sslmode=disable
  seedConnectionString = `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`;
}

const seedPoolConfig = {
  connectionString: seedConnectionString,
};

// If in production (Render), ensure SSL is configured as Render requires it.
// The DATABASE_URL from Render might already include SSL params, but this is a safeguard.
if (isProductionSeed) {
  seedPoolConfig.ssl = { rejectUnauthorized: false };
}
// For local (isProductionSeed is false), sslmode=disable in the connection string handles it.

const pool = new Pool(seedPoolConfig);

// --- GOOGLE MAPS API SETUP ---
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY && !isProductionSeed) { // Only critical if not in prod where it might be set differently
    console.warn("WARN: GOOGLE_MAPS_API_KEY not found in environment. Image fetching might fail or use defaults.");
}
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

const searchQueries = [
  'best chicken rice Singapore', 'best char kway teow Singapore', 'best laksa Singapore',
  'best hokkien mee Singapore', 'best bak chor mee Singapore', 'best satay Singapore',
  'best wanton mee Singapore', 'best chilli crab Singapore', 'best nasi lemak Singapore',
  'best roti prata Singapore', 'halal restaurants Singapore', 'vegetarian restaurants Singapore',
  'vegan restaurants Singapore'
];
const MAX_PAGES_PER_QUERY = 3;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function inferDietaryInfo(place) {
  const nameLower = (place.name || '').toLowerCase();
  const typesString = (place.types || []).join(' ').toLowerCase();
  const searchText = `${nameLower} ${typesString}`;
  const isHalal = /\b(halal|muslim)\b/i.test(searchText);
  const isVegetarian = /\b(vegetarian|vegan|plant-based)\b/i.test(searchText);
  return { isHalal, isVegetarian };
}

async function getFinalImageUrl(place) {
    if (!place.photos || place.photos.length === 0 || !API_KEY) {
        return 'https://via.placeholder.com/400x400.png?text=No+Image';
    }
    const photo_reference = place.photos[0].photo_reference;
    const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${API_KEY}`;
    try {
        const photoResponse = await axios.get(photoApiUrl, { responseType: 'stream' });
        return photoResponse.request.res.responseUrl;
    } catch (error) {
        console.error(`Could not fetch photo for ${place.name} (Ref: ${photo_reference}). Error: ${error.message}. Using default.`);
        return 'https://via.placeholder.com/400x400.png?text=No+Image';
    }
}

async function seedDatabase() {
  console.log(`Starting to seed the database. Connecting to: ${isProductionSeed ? 'PRODUCTION DB (Render)' : 'LOCAL DB'}`);
  let client; // Declare client outside try so it's accessible in finally
  try {
    client = await pool.connect(); // This is where the SSL error might occur
    console.log("Successfully connected to the database for seeding.");

    for (const query of searchQueries) {
      console.log(`\n--- Processing new query: "${query}" ---`);
      let nextPageToken = null;
      let pageCount = 0;

      do {
        pageCount++;
        console.log(` -> Fetching Page ${pageCount} for query "${query}"...`);
        const params = { query: query, key: API_KEY };
        if (nextPageToken) params.pagetoken = nextPageToken;

        const searchResponse = await axios.get(PLACES_API_URL, { params });
        const places = searchResponse.data.results;

        if (searchResponse.data.status !== 'OK' && searchResponse.data.status !== 'ZERO_RESULTS') {
          console.error(`  -> API Error for query "${query}": ${searchResponse.data.status}`, searchResponse.data.error_message || '');
          break;
        }
        nextPageToken = searchResponse.data.next_page_token;
        if (!places || places.length === 0) {
            console.log(`  -> No places found on this page for query "${query}".`);
            break;
        }
        console.log(`  -> Found ${places.length} places on this page. Preparing to process...`);


        const eateryDataPromises = places.map(async (place) => {
          const imageUrl = await getFinalImageUrl(place);
          const { isHalal, isVegetarian } = inferDietaryInfo(place);
          return {
            name: place.name,
            cuisine: place.types?.[0]?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Restaurant',
            neighbourhood: place.formatted_address?.split(',').slice(-2)[0]?.trim() || 'Singapore',
            rating: place.rating || 0,
            review_count: place.user_ratings_total || 0,
            price: '$'.repeat(place.price_level || 1),
            image_url: imageUrl,
            latitude: place.geometry?.location?.lat,
            longitude: place.geometry?.location?.lng,
            is_halal: isHalal,
            is_vegetarian: isVegetarian,
          };
        });

        const eateriesToInsert = await Promise.all(eateryDataPromises);
        let insertedCount = 0;
        for (const eatery of eateriesToInsert) {
          // Ensure your 'eateries' table has an 'updated_at' column if you keep it here.
          // Or remove 'updated_at' from columns and 'CURRENT_TIMESTAMP' from values if not.
          const insertQuery = `
            INSERT INTO public.eateries (
              name, cuisine, neighbourhood, rating, review_count,
              price, image_url, latitude, longitude,
              is_halal, is_vegetarian, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
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
            eatery.name, eatery.cuisine, eatery.neighbourhood, eatery.rating,
            eatery.review_count, eatery.price, eatery.image_url, eatery.latitude,
            eatery.longitude, eatery.is_halal, eatery.is_vegetarian
          ];
          try {
            const res = await client.query(insertQuery, values);
            if(res.rowCount > 0) insertedCount++;
          } catch (insertError) {
            console.error(`Error inserting/updating ${eatery.name}:`, insertError.message);
          }
        }
        console.log(`  -> Finished processing. Inserted/Updated ${insertedCount} of ${eateriesToInsert.length} places for this page.`);

        if (nextPageToken && pageCount < MAX_PAGES_PER_QUERY) {
          console.log("  -> Waiting 2 seconds before next page...");
          await delay(2000);
        }
      } while (nextPageToken && pageCount < MAX_PAGES_PER_QUERY);
    }
    console.log('\n\n--- All types processed. Database seeding completed successfully! ---');
  } catch (error) {
    console.error('An error occurred during seeding:', error.message, error.stack);
  } finally {
    if (client) {
      client.release();
      console.log("Database client released.");
    }
    await pool.end();
    console.log("Seed script database pool has ended.");
  }
}

seedDatabase();