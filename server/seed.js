// FILE: server/seed.js
require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const SCRIPT_MODE = 'production';
const CONFIGS = {
  test:       { logMessage: "Starting TEST seed...",    maxPages: 3,  perPageDelayMs: 2000, betweenCallsMs: 150 },
  production: { logMessage: "Starting FULL seed...",    maxPages: 5,  perPageDelayMs: 2000, betweenCallsMs: 120 }
};
const CONFIG = CONFIGS[SCRIPT_MODE];

const isProductionSeed = process.env.NODE_ENV === 'production';
const seedConnectionString = isProductionSeed
  ? process.env.DATABASE_URL
  : 'postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable';

const seedPoolConfig = { connectionString: seedConnectionString };
if (isProductionSeed) seedPoolConfig.ssl = { rejectUnauthorized: false };
const pool = new Pool(seedPoolConfig);

const SHOULD_TRUNCATE =
  process.env.FORCE_TRUNCATE === 'true'
    ? true
    : isProductionSeed
      ? false
      : true;

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_API_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELD_MASK =
  'places.id,places.displayName,places.types,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.photos,nextPageToken';

const DISH_QUERIES = [
  "Chicken Rice","Duck Rice","Roast Meat Rice","Hainanese Curry Rice","Claypot Rice","Economic Rice","Teochew Porridge",
  "Wanton Mee","Bak Chor Mee","Fishball Noodles","Prawn Noodles","Laksa","Char Kway Teow","Hokkien Mee","Lor Mee","Ban Mian","Kway Chap","Yong Tau Foo",
  "Muslim","Nasi Briyani","Nasi Padang","Ayam Penyet","Satay","Indian Rojak","Roti Prata",
  "Western Food","Fried Carrot Cake",
  "Chinese Rojak","Popiah","Vegetarian Bee Hoon","Thunder Tea Rice","Kaya Toast","Ice Kachang","Cendol","Tau Huay",
  "Sushi","Ramen","Thai Food","Korean Food","Vietnamese Food","Indonesian Food","Dim Sum","Zi Char","Pizza","Fried Chicken","Fish Soup","Mala","Japanese Food"
];

const HALAL_GUARANTEE_TERMS = [
  "muslim","nasi briyani","nasi biryani","nasi padang","ayam penyet","indian rojak","roti prata"
];

const INCLUDED_TYPES = ["restaurant","meal_takeaway","cafe","bakery","food_court"];
const EXCLUDE_IF_TYPE_INCLUDES = new Set(["mosque","church","hindu_temple","synagogue","place_of_worship"]);

const priceLevelMap = {
  PRICE_LEVEL_UNSPECIFIED: '$',
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$'
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const aliases = {
  "Nasi Briyani": ["nasi briyani","nasi biryani","briyani","biryani"],
  "Zi Char": ["zi char","zi-char","zichar","tze char","tze-char"],
  "Fried Carrot Cake": ["fried carrot cake","carrot cake","chai tow kway","chai tow kuay","chai tao kway"],
  "Tau Huay": ["tau huay","bean curd","beancurd","douhua","tofu pudding","soy pudding"],
  "Mala": ["mala","mala xiang guo","mala hotpot","malatang","ma la"],
  "Yong Tau Foo": ["yong tau foo","yong tofu","yong tau fu"],
  "Ban Mian": ["ban mian","you mian","youmian"],
  "Prawn Noodles": ["prawn noodles","hae mee","prawn mee"],
  "Roast Meat Rice": ["roast meat rice","char siew rice","charsiew rice","roasted pork rice","sio bak rice"],
  "Western Food": ["western food","western cuisine"],
  "Japanese Food": ["japanese food","japanese cuisine"],
  "Thai Food": ["thai food","thai cuisine"],
  "Korean Food": ["korean food","korean cuisine"],
  "Vietnamese Food": ["vietnamese food","vietnamese cuisine"],
  "Indonesian Food": ["indonesian food","indonesian cuisine"],
  "Dim Sum": ["dim sum","dimsum"]
};

const looksLikeDish = (place, dish) => {
  const name = (place.displayName?.text || '').toLowerCase();
  const addr = (place.formattedAddress || '').toLowerCase();
  const hay = `${name} ${addr}`;
  const list = aliases[dish] || [dish.toLowerCase()];
  return list.some(t => hay.includes(t));
};

const inSingapore = (place) => /singapore/i.test(place.formattedAddress || '');
const hasPhoto = (place) => Array.isArray(place.photos) && place.photos.length > 0;

const isEatery = (place) => {
  const types = place.types || [];
  if (!types.length) return false;
  if (types.some(t => EXCLUDE_IF_TYPE_INCLUDES.has(t))) return false;
  const primary = types[0];
  return INCLUDED_TYPES.includes(primary);
};

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

const buildNearbyBody = ({ center, pageToken }) => {
  const body = {
    includedTypes: INCLUDED_TYPES,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        radius: 1000
      }
    },
    languageCode: "en-SG",
    regionCode: "SG",
    rankPreference: "POPULARITY"
  };
  if (pageToken) body.pageToken = pageToken;
  return body;
};

const generateCenters = () => {
  const latMin = 1.240, latMax = 1.455;
  const lngMin = 103.610, lngMax = 104.020;
  const step = 0.015;
  const centers = [];
  for (let lat = latMin; lat <= latMax; lat += step) {
    for (let lng = lngMin; lng <= lngMax; lng += step) {
      centers.push({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
    }
  }
  return centers;
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

    const centers = generateCenters();

    for (const dish of DISH_QUERIES) {
      let dishInserted = 0, dishDuped = 0;

      for (const center of centers) {
        let nextPageToken = null;
        let pageCount = 0;

        do {
          pageCount++;
          const body = buildNearbyBody({ center, pageToken: nextPageToken });
          const res = await axios.post(PLACES_API_NEARBY_URL, body, { headers });
          const places = res.data?.places || [];
          nextPageToken = res.data?.nextPageToken;

          if (!places.length) break;

          for (const place of places) {
            if (!isEatery(place)) continue;
            if (!hasPhoto(place)) continue;
            if (!inSingapore(place)) continue;
            if (!looksLikeDish(place, dish)) continue;

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
            if (result.rowCount > 0) { dishInserted++; totalInserted++; } else { dishDuped++; totalDuped++; }
          }

          if (nextPageToken && pageCount < CONFIG.maxPages) {
            await delay(CONFIG.perPageDelayMs);
          }
        } while (nextPageToken && pageCount < CONFIG.maxPages);

        await delay(CONFIG.betweenCallsMs);
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
