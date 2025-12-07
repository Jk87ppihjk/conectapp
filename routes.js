const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    uploadImage, 
    searchUserByEmail, 
    startNewConversation, 
    getConversations,
    getConversationMessages, 
    sendMessage,
    getUserProfile // IMPORTADO
} = require('./controllers');
const { authenticateToken, upload } = require('./middleware');

// Rotas de Autenticação
router.post('/auth/register', register);
router.post('/auth/login', login);

// Rotas de Usuário (Protegidas)
// NOVO: Rota para buscar o perfil do usuário logado
router.get('/user/profile', authenticateToken, getUserProfile); 
router.get('/users/search-by-email', authenticateToken, searchUserByEmail);

// Rotas de Conversa (Protegidas)
router.get('/conversations', authenticateToken, getConversations); 
router.post('/conversations/start', authenticateToken, startNewConversation);
router.get('/conversations/:id', authenticateToken, getConversationMessages);

// Rota para enviar mensagens
router.post('/messages', authenticateToken, sendMessage);


// Protected route example: Image upload
router.post('/upload', authenticateToken, upload.single('image'), uploadImage);

// Public test route
router.get('/ping', (req, res) => {
    res.send('pong');
});

module.exports = router;
