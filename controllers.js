const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const cloudinary = require('./cloudinary');
const { Readable } = require('stream');
require('dotenv').config();

// Helper function to decode JWT and get user ID (since req.user.id is set in middleware)
const getCurrentUserId = (req) => {
    return req.user ? req.user.id : null;
};

// ... (register, login, uploadImage, searchUserByEmail, startNewConversation, getConversationMessages, sendMessage - existing code) ...

// NOVO: Busca a lista de todas as conversas do usuário logado
const getConversations = async (req, res) => {
    const userId = getCurrentUserId(req);

    try {
        const [conversations] = await db.query(
            `
            SELECT 
                c.id AS conversationId,
                c.updated_at AS lastActive,
                u.id AS contactId,
                u.name AS contactName,
                u.image_url AS contactImage,
                m.content AS lastMessageContent,
                m.sender_id AS lastMessageSenderId
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            -- Encontra o ID do outro participante (usando JOIN com a mesma tabela)
            JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != ?
            -- Junta com a tabela de usuários para obter os dados do contato
            JOIN users u ON cp2.user_id = u.id
            -- Junta com a tabela de mensagens para obter a última mensagem
            LEFT JOIN messages m ON m.conversation_id = c.id
                AND m.id = (
                    -- Subconsulta para encontrar o ID da última mensagem para esta conversa
                    SELECT MAX(id)
                    FROM messages
                    WHERE conversation_id = c.id
                )
            WHERE cp.user_id = ?
            ORDER BY c.updated_at DESC;
            `,
            [userId, userId]
        );

        // Formata o resultado para o frontend
        const formattedConversations = conversations.map(conv => {
            const senderPrefix = (conv.lastMessageSenderId === userId) ? 'Você: ' : '';
            
            return {
                id: conv.conversationId,
                contactName: conv.contactName || conv.contactEmail,
                contactImage: conv.contactImage,
                lastMessageContent: conv.lastMessageContent ? (senderPrefix + conv.lastMessageContent) : 'Nenhuma mensagem.',
                lastActive: conv.lastActive,
                // Aqui você pode adicionar lógica para calcular unreadCount se tiver uma tabela de status de leitura
                unreadCount: 0, 
            };
        });

        res.json(formattedConversations);

    } catch (error) {
        console.error('Error fetching conversations list:', error);
        res.status(500).json({ message: 'Server error fetching conversations list' });
    }
};

// Exporta a nova função
module.exports = { 
    register, 
    login, 
    uploadImage, 
    searchUserByEmail, 
    startNewConversation, 
    getConversationMessages, 
    sendMessage,
    getConversations // Exportado
};
