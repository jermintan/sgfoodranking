// FILE: server/seed.js
require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const SCRIPT_MODE = 'production';
const CONFIGS = {
  test:        { maxQueries: 5,  maxPages: 2, logMessage: "Starting TEST seed..." },
  production:  { maxQueries: 25, maxPages: 5, logMessage: "Starting FULL seed..." }
};
const CONFIG = CONFIGS[SCRIPT_MODE];

// --- DB ---
const isProductionSeed = process.env.NODE_ENV === 'production';
const seedConnectionString = isProductionSeed
  ? process.env.DATABASE_URL
  : 'postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable';

const seedPoolConfig = { connectionString: seedConnectionString };
if (isProductionSeed) seedPoolConfig.ssl = { rejectUnauthorized: false };
const pool = new Pool(seedPoolConfig);

// Whether to wipe the table first.
// Default: test/dev = true, production = false (append).
// You can override by setting FORCE_TRUNCATE=true in env.
const SHOULD_TRUNCATE =
  process.env.FORCE_TRUNCATE === 'true'
    ? true
    : isProductionSeed
      ? false
      : true;

// --- API ---
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_API_NEW_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK =
  'places.id,places.displayName,places.types,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.photos';

const priceLevelMap = {
  PRICE_LEVEL_UNSPECIFIED: '$',
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$'
};

const allQueries = [
  'best chicken rice Singapore', 'best char kway teow Singapore', 'best laksa Singapore',
  'best hokkien mee Singapore', 'best bak chor mee Singapore', 'best satay Singapore',
  'best wanton mee Singapore', 'best chilli crab Singapore', 'best nasi lemak Singapore',
  'best roti prata Singapore', 'halal restaurants Singapore', 'vegetarian restaurants Singapore',
  'vegan restaurants Singapore', 'best bak kut teh Singapore', 'best fish head curry Singapore',
  'best kaya toast Singapore', 'best hainanese curry rice Singapore',
  'japanese restaurants Singapore', 'italian restaurants Singapore',
  'best desserts Singapore', 'michelin star restaurants Singapore',
  'restaurants in Orchard Road', 'best food in Katong',
  'hawker centres near Raffles Place', 'cafes in Tiong Bahru'
];
const searchQueries = allQueries.slice(0, CONFIG.maxQueries);
const MAX_PAGES_PER_QUERY = CONFIG.maxPages;

// --- Helpers ---
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const inferDietaryInfo = (place) => {
  const text = `${place.displayName?.text || ''} ${(place.types || []).join(' ')}`.toLowerCase();
  return {
    isHalal: /\b(halal|muslim)\b/.test(text),
    isVegetarian: /\b(vegetarian|vegan|plant-based)\b/.test(text)
  };
};

async function seedDatabase() {
  console.log(CONFIG.logMessage);
  let client;
  let totalInserted = 0;
  let totalDuped = 0;

  try {
    client = await pool.connect();

    // --- Ensure schema is correct (prod DB may not have these yet) ---
    await client.query(`
      -- Add the column if missing
      ALTER TABLE public.eateries
        ADD COLUMN IF NOT EXISTS place_id text;

      -- Drop unique constraint on "name" if it exists (branches can share names)
      DO $$
      BEGIN
        ALTER TABLE public.eateries DROP CONSTRAINT eateries_name_key;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END$$;

      -- Ensure unique index on place_id (for deduplication)
      CREATE UNIQUE INDEX IF NOT EXISTS eateries_place_id_key
        ON public.eateries(place_id);
    `);

    console.log("Connected to DB.");

    if (SHOULD_TRUNCATE) {
      console.log("Clearing old data (TRUNCATE)...");
      await client.query('TRUNCATE TABLE public.eateries RESTART IDENTITY;');
    } else {
      console.log("Production mode: skipping TRUNCATE (appending new rows).");
    }

    for (const query of searchQueries) {
      console.log(`\n--- Query: "${query}" ---`);
      let nextPageToken = null;
      let pageCount = 0;
      let insertedCount = 0;
      let dupedCount = 0;

      do {
        pageCount++;
        console.log(` -> Page ${pageCount}/${MAX_PAGES_PER_QUERY}`);

        const requestBody = { textQuery: query, pageSize: 20, ...(nextPageToken ? { pageToken: nextPageToken } : {}) };
        const headers = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK
        };

        const res = await axios.post(PLACES_API_NEW_URL, requestBody, { headers });
        const places = res.data?.places || [];
        nextPageToken = res.data?.nextPageToken;

        if (!places.length) break;

        for (const place of places) {
          const photos = (place.photos || []).map((p) => ({ name: p.name }));
          const { isHalal, isVegetarian } = inferDietaryInfo(place);

          const eatery = {
            place_id: place.id,
            name: place.displayName?.text,
            cuisine:
              place.types?.[0]?.replace(/_/g, ' ')?.replace(/\b\w/g, (l) => l.toUpperCase()) || 'Restaurant',
            neighbourhood: place.formattedAddress?.split(',').slice(-2)[0]?.trim() || 'Singapore',
            rating: place.rating || 0,
            review_count: place.userRatingCount || 0,
            price: priceLevelMap[place.priceLevel] || '$',
            photos: JSON.stringify(photos),
            latitude: place.location?.latitude,
            longitude: place.location?.longitude,
            is_halal: isHalal,
            is_vegetarian: isVegetarian
          };

          const insertQuery = `
            INSERT INTO public.eateries (
              place_id, name, cuisine, neighbourhood, rating, review_count, price,
              photos, latitude, longitude, is_halal, is_vegetarian, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)
            ON CONFLICT (place_id) DO NOTHING;
          `;
          const values = [
            eatery.place_id, eatery.name, eatery.cuisine, eatery.neighbourhood,
            eatery.rating, eatery.review_count, eatery.price, eatery.photos,
            eatery.latitude, eatery.longitude, eatery.is_halal, eatery.is_vegetarian
          ];

        const result = await client.query(insertQuery, values);
          if (result.rowCount > 0) {
            insertedCount++; totalInserted++;
          } else {
            dupedCount++; totalDuped++;
          }
        }

        if (nextPageToken && pageCount < MAX_PAGES_PER_QUERY) {
          await delay(2000);
        }
      } while (nextPageToken && pageCount < MAX_PAGES_PER_QUERY);

      console.log(`Inserted: ${insertedCount}, Duplicates skipped: ${dupedCount}`);
    }

    console.log(`\n=== SEED COMPLETE ===`);
    console.log(`TOTAL Inserted: ${totalInserted}`);
    console.log(`TOTAL Duplicates Skipped: ${totalDuped}`);
  } catch (e) {
    console.error('Seeding error:', e.response ? e.response.data : e.message);
  } finally {
    await pool.end();
  }
}

seedDatabase();
