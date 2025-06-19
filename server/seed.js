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

// --- NEW: THE MULTI-PRONGED SEARCH STRATEGY ---
// We define a list of search objects. This gives us fine-grained control.
// We can specify how many pages of results we want for each specific query.
const searchStrategies = [
  { query: 'best chicken rice in Singapore', pages: 1 },
  { query: 'best laksa in Singapore', pages: 1 },
  { query: 'best hokkien mee in Singapore', pages: 1 },
  { query: 'best bak chor mee stalls Singapore', pages: 1 },
  { query: 'top rated cafes in Singapore', pages: 2 },
  { query: 'michelin star restaurants Singapore', pages: 2 },
  { query: 'best bars in Singapore', pages: 1 },
];

// A helper function to pause execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seedDatabase() {
  console.log('Starting to seed the database...');
  const client = await pool.connect();

  try {
    // --- Outer loop to iterate through each search STRATEGY ---
    for (const strategy of searchStrategies) {
      console.log(`\n\n--- Processing new strategy: "${strategy.query}" ---`);
      
      let nextPageToken = null;
      let pageCount = 0;

      // --- PAGINATION LOGIC (Now nested inside the strategy loop) ---
      do {
        pageCount++;
        console.log(` -> Fetching Page ${pageCount} for "${strategy.query}"...`);
        
        const params = {
          query: strategy.query,
          key: API_KEY,
        };

        if (nextPageToken) {
          params.pagetoken = nextPageToken;
        }
        
        const searchResponse = await axios.get(PLACES_API_URL, { params });
        const places = searchResponse.data.results;
        nextPageToken = searchResponse.data.next_page_token;
        
        console.log(`  -> Found ${places.length} places on this page.`);

        // --- Process each place from the current page ---
        for (const place of places) {
            let image_url = 'https://via.placeholder.com/400x400.png?text=No+Image';

            if (place.photos && place.photos.length > 0) {
                const photo_reference = place.photos[0].photo_reference;
                const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${API_KEY}`;
                try {
                    const photoResponse = await axios.get(photoApiUrl, { responseType: 'stream' });
                    image_url = photoResponse.request.res.responseUrl;
                } catch (photoError) { /* Silently use fallback */ }
            }

            const name = place.name;
            const rating = place.rating || 0;
            const review_count = place.user_ratings_total || 0;
            const price_level = place.price_level || 1;
            const price = '$'.repeat(price_level);
            // We still use a simplified neighborhood logic for now
            const neighbourhood = place.formatted_address.split(',')[1]?.trim() || 'Singapore';
            // And a simplified cuisine logic
            const cuisine = place.types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Restaurant';

            const insertQuery = `
              INSERT INTO public.eateries (name, cuisine, neighbourhood, rating, review_count, price, image_url) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (name) DO NOTHING;
            `;
            const values = [name, cuisine, neighbourhood, rating, review_count, price, image_url];
            await client.query(insertQuery, values);
        }

        if (nextPageToken) {
          console.log("  -> Waiting 2 seconds before next page...");
          await delay(2000);
        }

      } while (nextPageToken && pageCount < strategy.pages);
    }

    console.log('\n\n--- All strategies processed. Database seeding completed successfully! ---');

  } catch (error) {
    console.error('An error occurred during seeding:', error.response ? error.response.data : error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the main function
seedDatabase();