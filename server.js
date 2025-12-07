const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all domains
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// Initialize Database Table (Optional: for convenience)
const initDb = async () => {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await db.query(createTableQuery);
        console.log('Database initialized: users table checked/created.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

// Start Server
app.listen(PORT, async () => {
    await initDb();
    console.log(`Server running on port ${PORT}`);
});
