const express = require('express');
const router = express.Router();
const { register, login, uploadImage, searchUserByEmail, startNewConversation } = require('./controllers');
const { authenticateToken, upload } = require('./middleware');

// Rotas de Autenticação
router.post('/auth/register', register);
router.post('/auth/login', login);

// Rotas de Usuário/Contatos (Protegidas)
router.get('/users/search-by-email', authenticateToken, searchUserByEmail);

// Rotas de Conversa (Protegidas)
router.post('/conversations/start', authenticateToken, startNewConversation);

// Protected route example: Image upload
router.post('/upload', authenticateToken, upload.single('image'), uploadImage);

// Public test route
router.get('/ping', (req, res) => {
    res.send('pong');
});

module.exports = router;
