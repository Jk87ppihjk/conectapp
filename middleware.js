const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Multer Setup for Memory Storage (files are uploaded to Cloudinary directly from buffer or temp)
// Using memory storage to keep it simple and avoid temp files if possible, 
// but for Cloudinary upload_stream, memory storage is good.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = { authenticateToken, upload };
