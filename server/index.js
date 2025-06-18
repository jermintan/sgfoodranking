// 1. Import necessary packages
const express = require('express');
const cors = require('cors');

// 2. Create an Express app
const app = express();
const PORT = 3001;

// 3. Set up middleware
app.use(cors());
app.use(express.json());

// 4. Import our mock data FOR THE SERVER
// THE FIX: Change this path to the new file
const { mockEateries } = require('./serverMockData.js');

// 5. Define our first API endpoint
app.get('/api/eateries', (req, res) => {
  console.log('Request received for /api/eateries');
  res.json(mockEateries);
});

// 6. Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});