// FILE: server/manualDelete.js

require('dotenv').config();
const { Pool } = require('pg');

// --- 1. SET THE EXACT NAME OF THE EATERY TO DELETE HERE ---
const EATERY_NAME_TO_DELETE = "My Awesome New Cafe"; 
// --- END OF EDIT ---


// Safety check to prevent running with an empty name
if (!EATERY_NAME_TO_DELETE || EATERY_NAME_TO_DELETE.trim() === "") {
  console.error("❌ FATAL: Eatery name is not specified. Please edit the EATERY_NAME_TO_DELETE variable in the script.");
  process.exit(1);
}

// --- DATABASE CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:Chal1124!@localhost:5432/eatery_app?sslmode=disable`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});


async function deleteEatery() {
  console.log(`Attempting to delete eatery: "${EATERY_NAME_TO_DELETE}"`);

  const client = await pool.connect();
  try {
    const deleteQuery = `DELETE FROM public.eateries WHERE name = $1;`;
    const res = await client.query(deleteQuery, [EATERY_NAME_TO_DELETE]);

    if (res.rowCount > 0) {
      console.log(`✅ Success! ${res.rowCount} row(s) deleted. "${EATERY_NAME_TO_DELETE}" has been removed from the database.`);
    } else {
      console.log(`⚠️ Eatery "${EATERY_NAME_TO_DELETE}" not found in the database. No changes were made.`);
    }

  } catch (error) {
    console.error('❌ Error deleting eatery:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log("Manual delete script finished.");
  }
}

deleteEatery();