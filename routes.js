const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    // REMOVIDO: uploadImage, 
    searchUserByEmail, 
    startNewConversation, 
    getConversations,
    getConversationMessages, 
    sendMessage,
    getUserProfile,
    saveContactAlias, // Importado para salvar o apelido do contato
    getSavedContacts // Importado para listar os contatos salvos
} = require('./controllers');
const { uploadMedia } = require('./mediaControllers'); // NOVO: Importa o controller de mídia
const { authenticateToken, upload } = require('./middleware');

// Rotas de Autenticação
router.post('/auth/register', register);
router.post('/auth/login', login);

// Rotas de Usuário (Protegidas)
router.get('/user/profile', authenticateToken, getUserProfile); 
router.get('/users/search-by-email', authenticateToken, searchUserByEmail);

// Rota para salvar o nome/apelido local de um contato
router.post('/user/contacts', authenticateToken, saveContactAlias); 

// NOVO: Rota para listar contatos salvos
router.get('/user/contacts', authenticateToken, getSavedContacts); 

// Rotas de Conversa (Protegidas)
router.get('/conversations', authenticateToken, getConversations); 
router.post('/conversations/start', authenticateToken, startNewConversation);
router.get('/conversations/:id', authenticateToken, getConversationMessages);

// Rota para enviar mensagens
router.post('/messages', authenticateToken, sendMessage);


// Rota Protegida para Upload de Mídia (Imagens e Vídeos)
// O nome do campo do arquivo no formulário deve ser 'media'
router.post('/upload', authenticateToken, upload.single('media'), uploadMedia);

// Public test route
router.get('/ping', (req, res) => {
    res.send('pong');
});

module.exports = router;
