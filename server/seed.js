// Load environment variables from our .env file.
require('dotenv').config();

const axios = require('axios');
const { Pool } = require('pg');

// --- DATABASE CONNECTION ---
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = isProduction 
  ? process.env.DATABASE_URL 
  : `postgresql://postgres:Chal1124!@localhost:5432/eatery_app`;
const pool = new Pool({
  connectionString: connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// --- GOOGLE MAPS API SETUP ---
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
// We switch back to Text Search as it's better for specific queries like dish names
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

// --- NEW DISH-FIRST SEARCH STRATEGY ---
const searchQueries = [
  'best chicken rice Singapore',
  'best char kway teow Singapore',
  'best laksa Singapore',
  'best hokkien mee Singapore',
  'best bak chor mee Singapore',
  'best satay Singapore',
  'best wanton mee Singapore',
  'best chilli crab Singapore',
  'best nasi lemak Singapore',
  'best roti prata Singapore'
];
const MAX_PAGES_PER_QUERY = 1; // Fetch 1 page (~20 results) for each dish type.

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        for (const query of searchQueries) {
            console.log(`\n--- Processing new query: "${query}" ---`);
            let nextPageToken = null;
            let pageCount = 0;

            do {
                pageCount++;
                console.log(` -> Fetching Page ${pageCount} for query "${query}"...`);

                const params = {
                    query: query,
                    key: API_KEY,
                };
                if (nextPageToken) params.pagetoken = nextPageToken;

                const searchResponse = await axios.get(PLACES_API_URL, { params });
                const places = searchResponse.data.results;
                
                if (searchResponse.data.status !== 'OK' && searchResponse.data.status !== 'ZERO_RESULTS') {
                    console.error(`  -> API Error for query "${query}": ${searchResponse.data.status}`, searchResponse.data.error_message || '');
                    break; 
                }

                nextPageToken = searchResponse.data.next_page_token;
                console.log(`  -> Found ${places.length} places on this page. Preparing to process...`);
                if (places.length === 0) break;

                const eateryDataPromises = places.map(async (place) => {
                    const imageUrl = await getFinalImageUrl(place);
                    return {
                        name: place.name,
                        cuisine: place.types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Restaurant',
                        neighbourhood: place.formatted_address.split(',').slice(-2)[0]?.trim() || 'Singapore',
                        rating: place.rating || 0,
                        review_count: place.user_ratings_total || 0,
                        price: '$'.repeat(place.price_level || 1),
                        image_url: imageUrl,
                        latitude: place.geometry.location.lat,
                        longitude: place.geometry.location.lng,
                    };
                });

                const eateriesToInsert = await Promise.all(eateryDataPromises);

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

                if (nextPageToken && pageCount < MAX_PAGES_PER_QUERY) {
                    console.log("  -> Waiting 2 seconds before next page...");
                    await delay(2000);
                }
            } while (nextPageToken && pageCount < MAX_PAGES_PER_QUERY);
        }
        console.log('\n\n--- All types processed. Database seeding completed successfully! ---');
    } catch (error) {
        console.error('An error occurred during seeding:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

seedDatabase();