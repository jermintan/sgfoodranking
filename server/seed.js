// Load environment variables from our .env file
require('dotenv').config();

const axios = require('axios');
const { Pool } = require('pg');

// --- DATABASE CONNECTION ---
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'eatery_app',
  password: 'Chal1124!', // IMPORTANT: Use your actual password
  port: 5432,
});

// --- GOOGLE MAPS API SETUP ---
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

const searchStrategies = [
  { query: 'best chicken rice in Singapore', pages: 1 },
  { query: 'best laksa in Singapore', pages: 1 },
  { query: 'best hokkien mee in Singapore', pages: 1 },
  { query: 'best bak chor mee stalls Singapore', pages: 1 },
  { query: 'top rated cafes in Singapore', pages: 2 },
  { query: 'michelin star restaurants Singapore', pages: 2 },
  { query: 'best bars in Singapore', pages: 1 },
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- NEW HELPER FUNCTION TO GET THE FINAL IMAGE URL ---
async function getFinalImageUrl(place) {
  if (!place.photos || place.photos.length === 0) {
    return 'https://via.placeholder.com/400x400.png?text=No+Image';
  }

  const photo_reference = place.photos[0].photo_reference;
  const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${API_KEY}`;
  
  try {
    const photoResponse = await axios.get(photoApiUrl, { responseType: 'stream' });
    return photoResponse.request.res.responseUrl;
  } catch (error) {
    console.error(`Could not fetch photo for ${place.name}. Using default.`);
    return 'https://via.placeholder.com/400x400.png?text=No+Image';
  }
}

async function seedDatabase() {
  console.log('Starting to seed the database...');
  const client = await pool.connect();

  try {
    for (const strategy of searchStrategies) {
      console.log(`\n\n--- Processing new strategy: "${strategy.query}" ---`);
      
      let nextPageToken = null;
      let pageCount = 0;

      do {
        pageCount++;
        console.log(` -> Fetching Page ${pageCount} for "${strategy.query}"...`);
        
        const params = { query: strategy.query, key: API_KEY };
        if (nextPageToken) params.pagetoken = nextPageToken;
        
        const searchResponse = await axios.get(PLACES_API_URL, { params });
        const places = searchResponse.data.results;
        nextPageToken = searchResponse.data.next_page_token;
        
        console.log(`  -> Found ${places.length} places on this page. Preparing to process...`);

        // --- THE MAJOR FIX: Use Promise.all ---
        const eateryDataPromises = places.map(async (place) => {
          const imageUrl = await getFinalImageUrl(place);
          return {
            name: place.name,
            cuisine: place.types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Restaurant',
            neighbourhood: place.formatted_address.split(',')[1]?.trim() || 'Singapore',
            rating: place.rating || 0,
            review_count: place.user_ratings_total || 0,
            price: '$'.repeat(place.price_level || 1),
            image_url: imageUrl,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
          };
        });

        // Wait for all the image URLs and data processing to complete for this page
        const eateriesToInsert = await Promise.all(eateryDataPromises);

        // Now, loop through the fully prepared data and insert it
        for (const eatery of eateriesToInsert) {
          const insertQuery = `
            INSERT INTO public.eateries (name, cuisine, neighbourhood, rating, review_count, price, image_url, latitude, longitude) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (name) DO NOTHING;
          `;
          const values = [eatery.name, eatery.cuisine, eatery.neighbourhood, eatery.rating, eatery.review_count, eatery.price, eatery.image_url, eatery.latitude, eatery.longitude];
          await client.query(insertQuery, values);
        }
        console.log(`  -> Finished processing and inserting ${eateriesToInsert.length} places for this page.`);

        if (nextPageToken && pageCount < strategy.pages) {
          console.log("  -> Waiting 2 seconds before next page...");
          await delay(2000);
        }

      } while (nextPageToken && pageCount < strategy.pages);
    }

    console.log('\n\n--- All strategies processed. Database seeding completed successfully! ---');

  } catch (error) {
    console.error('An error occurred during seeding:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();