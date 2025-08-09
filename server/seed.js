// FILE: server/seed.js (EXPANDED QUERIES + PROGRESS COUNTS + place_id)
require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const SCRIPT_MODE = 'production';
const CONFIGS = {
  test:        { maxQueries: 10,  maxPages: 2, logMessage: "Starting TEST seed..." },
  production:  { maxQueries: 999, maxPages: 5, logMessage: "Starting FULL seed..." } // maxQueries large = use all
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

// --- API ---
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
// include place ids
const FIELD_MASK =
  'places.id,places.displayName,places.types,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.photos';

// --- Helpers ---
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const priceLevelMap = {
  PRICE_LEVEL_UNSPECIFIED: '$',
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$'
};
const inferDietaryInfo = (place) => {
  const text = `${place.displayName?.text || ''} ${(place.types || []).join(' ')}`.toLowerCase();
  return {
    isHalal: /\b(halal|muslim)\b/.test(text),
    isVegetarian: /\b(vegetarian|vegan|plant-based)\b/.test(text)
  };
};

// --- Expanded query set (≈ 90+) ---
const dishQueries = [
  'best chicken rice Singapore','best char kway teow Singapore','best laksa Singapore',
  'best hokkien mee Singapore','best bak chor mee Singapore','best satay Singapore',
  'best wanton mee Singapore','best chilli crab Singapore','best nasi lemak Singapore',
  'best roti prata Singapore','best fish head curry Singapore','best bak kut teh Singapore',
  'best kaya toast Singapore','best hainanese curry rice Singapore','best oyster omelette Singapore',
  'best carrot cake Singapore','best nasi briyani Singapore','best xiao long bao Singapore',
  'best dim sum Singapore','best mala xiang guo Singapore','best ban mian Singapore',
  'best thunder tea rice Singapore','best briyani Singapore','best chicken wings Singapore'
];

const cuisineQueries = [
  'japanese restaurants Singapore','italian restaurants Singapore','korean restaurants Singapore',
  'thai restaurants Singapore','indian restaurants Singapore','malay restaurants Singapore',
  'indonesian restaurants Singapore','chinese restaurants Singapore','vietnamese restaurants Singapore',
  'taiwanese restaurants Singapore','spanish restaurants Singapore','french restaurants Singapore',
  'mediterranean restaurants Singapore','middle eastern restaurants Singapore','peranakan restaurants Singapore',
  'western food Singapore','steakhouse Singapore','seafood restaurant Singapore','buffet restaurant Singapore',
  'best desserts Singapore','cafe Singapore','brunch Singapore','bakery Singapore','patisserie Singapore'
];

const dietaryQueries = [
  'halal restaurants Singapore','vegetarian restaurants Singapore','vegan restaurants Singapore',
  'gluten free restaurant Singapore','kosher restaurant Singapore'
];

const neighborhoodQueries = [
  'restaurants in Orchard Road','best food in Katong','cafes in Tiong Bahru','restaurants in Bugis',
  'restaurants in Chinatown Singapore','restaurants in Little India Singapore','restaurants in Tanjong Pagar',
  'restaurants in Raffles Place','restaurants in Marina Bay','restaurants in Suntec City',
  'restaurants in VivoCity','restaurants in Clarke Quay','restaurants in Boat Quay',
  'restaurants in Holland Village','restaurants in Dempsey Hill','restaurants in Joo Chiat',
  'restaurants in Jurong East','restaurants in Tampines','restaurants in Ang Mo Kio',
  'restaurants in Woodlands','restaurants in Toa Payoh','restaurants in Serangoon',
  'restaurants in Punggol','restaurants in Sengkang','restaurants in Bukit Timah',
  'restaurants in Bukit Panjang','restaurants in Clementi','restaurants in Bishan',
  'restaurants in Yishun','restaurants in Pasir Ris'
];

const hawkerQueries = [
  'hawker centres near Raffles Place','maxwell food centre','tiong bahru market food','old airport road food centre',
  'amoy street food centre','chinatown complex food centre','lau pa sat','adam road food centre',
  'newton food centre','golden mile food centre','tekka centre food','bedok interchange hawker centre',
  'ang mo kio hub hawker','toa payoh lorong 8 market food','serangoon gardens chomp chomp',
  'bukit timah hawker centre','jurong west hawker centre','tampines round market food',
  'pasir ris central hawker','yishun 925 chicken rice'
];

const mallQueries = [
  'best restaurants ion orchard','best restaurants takashimaya','best restaurants plaza singapura',
  'best restaurants bugis junction','best restaurants bugis+','best restaurants suntec city',
  'best restaurants marina bay sands','best restaurants jewel changi','best restaurants northpoint city',
  'best restaurants nex serangoon','best restaurants westgate','best restaurants jem',
  'best restaurants causeway point','best restaurants vivocity','best restaurants tampines mall',
  'best restaurants parkway parade','best restaurants 313 somerset'
];

const allQueries = [
  ...dishQueries, ...cuisineQueries, ...dietaryQueries,
  ...neighborhoodQueries, ...hawkerQueries, ...mallQueries
];

const searchQueries = allQueries.slice(0, CONFIG.maxQueries);
const MAX_PAGES_PER_QUERY = CONFIG.maxPages;

// --- MAIN ---
async function seedDatabase() {
  console.log(CONFIG.logMessage);
  let client;
  let totalInserted = 0;
  let totalDuped = 0;

  try {
    client = await pool.connect();
    console.log("Connected to DB.");

    console.log("Clearing old data...");
    await client.query('TRUNCATE TABLE eateries RESTART IDENTITY;');

    for (const query of searchQueries) {
      console.log(`\n--- Query: "${query}" ---`);
      let nextPageToken = null;
      let pageCount = 0;
      let insertedCount = 0;
      let dupedCount = 0;

      do {
        pageCount++;
        console.log(` -> Page ${pageCount}/${MAX_PAGES_PER_QUERY}`);

        const requestBody = {
          textQuery: query,
          pageSize: 20, // v1 param
          // keep results firmly inside SG
          locationBias: {
            circle: {
              center: { latitude: 1.3521, longitude: 103.8198 },
              radius: 50000
            }
          },
          ...(nextPageToken ? { pageToken: nextPageToken } : {})
        };

        const headers = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK
        };

        const res = await axios.post(PLACES_TEXT_URL, requestBody, { headers });
        const places = res.data?.places || [];
        nextPageToken = res.data?.nextPageToken;

        if (!places.length) break;

        for (const place of places) {
          const photos = (place.photos || []).map(p => ({ name: p.name }));
          const { isHalal, isVegetarian } = inferDietaryInfo(place);

          const eatery = {
            place_id: place.id,
            name: place.displayName?.text,
            cuisine: place.types?.[0]?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Restaurant',
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
    console.log("DB closed.");
  }
}

seedDatabase();
