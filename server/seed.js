// FILE: server/seed.js
require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const SCRIPT_MODE = 'production';
const CONFIGS = {
  test:        { logMessage: "Starting TEST seed...",    maxPages: 3,  perPageDelayMs: 2000, betweenCallsMs: 250 },
  production:  { logMessage: "Starting FULL seed...",    maxPages: 5,  perPageDelayMs: 2000, betweenCallsMs: 150 }
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

// Truncate policy
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

// --- Tiles (9 rectangles over Singapore) ---
const SG_TILES = [
  { ne: { lat: 1.470, lng: 103.820 }, sw: { lat: 1.420, lng: 103.700 } },
  { ne: { lat: 1.470, lng: 103.880 }, sw: { lat: 1.420, lng: 103.820 } },
  { ne: { lat: 1.470, lng: 103.960 }, sw: { lat: 1.420, lng: 103.880 } },

  { ne: { lat: 1.420, lng: 103.820 }, sw: { lat: 1.360, lng: 103.700 } },
  { ne: { lat: 1.420, lng: 103.880 }, sw: { lat: 1.360, lng: 103.820 } },
  { ne: { lat: 1.420, lng: 103.960 }, sw: { lat: 1.360, lng: 103.880 } },

  { ne: { lat: 1.360, lng: 103.820 }, sw: { lat: 1.290, lng: 103.700 } },
  { ne: { lat: 1.360, lng: 103.880 }, sw: { lat: 1.290, lng: 103.820 } },
  { ne: { lat: 1.360, lng: 103.960 }, sw: { lat: 1.290, lng: 103.880 } },
];

// --- Dish queries (48) ---
const DISH_QUERIES = [
  "Chicken Rice", "Duck Rice", "Roast Meat Rice", "Hainanese Curry Rice", "Claypot Rice", "Economic Rice", "Teochew Porridge",
  "Wanton Mee", "Bak Chor Mee", "Fishball Noodles", "Prawn Noodles", "Laksa", "Char Kway Teow", "Hokkien Mee", "Lor Mee", "Ban Mian", "Kway Chap", "Yong Tau Foo",
  "Muslim", "Nasi Briyani", "Nasi Padang", "Ayam Penyet", "Satay", "Indian Rojak", "Roti Prata",
  "Western Food", "Fried Carrot Cake",
  "Chinese Rojak", "Popiah", "Vegetarian Bee Hoon", "Thunder Tea Rice", "Kaya Toast", "Ice Kachang", "Cendol", "Tau Huay",
  "Sushi", "Ramen", "Thai Food", "Korean Food", "Vietnamese Food", "Indonesian Food", "Dim Sum", "Zi Char", "Pizza", "Fried Chicken", "Fish Soup", "Mala", "Japanese Food"
];

const HALAL_GUARANTEE_TERMS = [
  "muslim", "nasi briyani", "nasi biryani", "nasi padang", "ayam penyet", "indian rojak", "roti prata"
];

const NO_STRICT_TYPE_QUERIES = new Set([
  "Muslim", "Nasi Briyani", "Nasi Padang", "Ayam Penyet", "Indian Rojak", "Roti Prata"
]);

const priceLevelMap = {
  PRICE_LEVEL_UNSPECIFIED: '$',
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$'
};

// filters
const INCLUDED_PRIMARY_TYPES = new Set(["restaurant","meal_takeaway","cafe","bakery","food_court"]);
const EXCLUDED_TYPES = new Set(["mosque","church","hindu_temple","synagogue","place_of_worship"]);
const inSingapore = (p) => /singapore/i.test(p.formattedAddress || '');
const hasAtLeastTwoPhotos = (p) => Array.isArray(p.photos) && p.photos.length >= 2;
const isEatery = (p) => {
  const types = p.types || [];
  if (!types.length) return false;
  if (types.some(t => EXCLUDED_TYPES.has(t))) return false;
  const primary = types[0];
  return INCLUDED_PRIMARY_TYPES.has(primary);
};

// Helpers
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const inferDietaryInfo = (place) => {
  const name = place.displayName?.text || '';
  const typesText = (place.types || []).join(' ');
  const address = place.formattedAddress || '';
  const haystack = `${name} ${typesText} ${address}`.toLowerCase();

  const isHalal =
    /\b(halal|muslim)\b/.test(haystack) ||
    HALAL_GUARANTEE_TERMS.some(term => haystack.includes(term));

  const isVegetarian =
    /\b(vegetarian|vegan|plant[- ]?based)\b/.test(haystack) ||
    /lei\s*cha|thunder\s*tea/i.test(name);

  return { isHalal, isVegetarian };
};

const buildRequestBody = ({
  textQuery,
  tile,
  pageToken,
  includedType,
  strictTypeFiltering
}) => {
  const body = {
    textQuery,
    languageCode: "en-SG",
    regionCode: "SG",
    pageSize: 20,
    locationRestriction: {
      rectangle: {
        high: { latitude: tile.ne.lat, longitude: tile.ne.lng },
        low:  { latitude: tile.sw.lat, longitude: tile.sw.lng }
      }
    }
  };
  if (pageToken) body.pageToken = pageToken;
  if (includedType) body.includedType = includedType;
  if (typeof strictTypeFiltering === 'boolean') body.strictTypeFiltering = strictTypeFiltering;
  return body;
};

async function seedDatabase() {
  console.log(CONFIG.logMessage);
  let client;
  let totalInserted = 0;
  let totalDuped = 0;

  try {
    client = await pool.connect();

    await client.query(`
      ALTER TABLE public.eateries
        ADD COLUMN IF NOT EXISTS place_id text;

      DO $$
      BEGIN
        ALTER TABLE public.eateries DROP CONSTRAINT eateries_name_key;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END$$;

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

    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK
    };

    for (const dish of DISH_QUERIES) {
      console.log(`\n==== Dish query: "${dish}" ====`);
      let dishInserted = 0, dishDuped = 0;

      for (const tile of SG_TILES) {
        const passes = NO_STRICT_TYPE_QUERIES.has(dish)
          ? [{ includedType: null, strictTypeFiltering: false }]
          : [
              { includedType: "restaurant",    strictTypeFiltering: true  },
              { includedType: "meal_takeaway", strictTypeFiltering: true  }
            ];

        for (const pass of passes) {
          let nextPageToken = null;
          let pageCount = 0;

          do {
            pageCount++;
            const requestBody = buildRequestBody({
              textQuery: dish,
              tile,
              pageToken: nextPageToken,
              includedType: pass.includedType,
              strictTypeFiltering: pass.strictTypeFiltering
            });

            const res = await axios.post(PLACES_API_NEW_URL, requestBody, { headers });
            const places = res.data?.places || [];
            nextPageToken = res.data?.nextPageToken;

            if (!places.length) break;

            for (const place of places) {
              if (!inSingapore(place)) continue;
              if (!isEatery(place)) continue;
              if (!hasAtLeastTwoPhotos(place)) continue;

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
              if (result.rowCount > 0) { dishInserted++; totalInserted++; }
              else { dishDuped++; totalDuped++; }
            }

            if (nextPageToken && pageCount < CONFIG.maxPages) {
              await delay(CONFIG.perPageDelayMs);
            }
          } while (nextPageToken && pageCount < CONFIG.maxPages);

          await delay(CONFIG.betweenCallsMs);
        }
      }

      console.log(`Inserted for "${dish}": ${dishInserted}, Duplicates skipped: ${dishDuped}`);
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
