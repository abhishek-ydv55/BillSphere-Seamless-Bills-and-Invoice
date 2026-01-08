const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse JSON and serve static files
app.use(express.json({ limit: '10mb' })); // Increase limit for Base64 logo
app.use(express.static(path.join(__dirname, '..'))); // Serve files from the project root

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Open http://localhost:3000/index.html in your browser.');
});