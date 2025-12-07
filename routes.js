const express = require('express');
const router = express.Router();
const { register, login, uploadImage } = require('./controllers');
const { authenticateToken, upload } = require('./middleware');

router.post('/auth/register', register);
router.post('/auth/login', login);

// Protected route example: Image upload
router.post('/upload', authenticateToken, upload.single('image'), uploadImage);

// Public test route
router.get('/ping', (req, res) => {
    res.send('pong');
});

module.exports = router;
