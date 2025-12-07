const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const cloudinary = require('./cloudinary');
const { Readable } = require('stream'); // CORRIGIDO: Apenas um 'require'
require('dotenv').config();

// Helper function to get the current user ID from the request object (set by authenticateToken middleware)
const getCurrentUserId = (req) => {
    return req.user ? req.user.id : null;
};

const register = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const uploadImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const streamUpload = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'site_uploads' },
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
                Readable.from(buffer).pipe(stream);
            });
        };

        const result = await streamUpload(req.file.buffer);
        res.json({ url: result.secure_url, public_id: result.public_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Upload failed' });
    }
};

const searchUserByEmail = async (req, res) => {
    const { email } = req.query;
    const currentUserId = getCurrentUserId(req);

    if (!email) {
        return res.status(400).json({ message: 'Email is required for search' });
    }

    try {
        const [rows] = await db.query(
            'SELECT id, email, name, image_url FROM users WHERE email = ? AND id != ?', 
            [email, currentUserId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found or you are searching for yourself' });
        }

        const user = rows[0];
        res.json({
            id: user.id,
            email: user.email,
            name: user.name, 
            image_url: user.image_url
        });
    } catch (error) {
        console.error('Error searching user:', error);
        res.status(500).json({ message: 'Server error during search' });
    }
};


const startNewConversation = async (req, res) => {
    const userId = getCurrentUserId(req);
    const { targetUserId } = req.body; 

    if (!targetUserId) {
        return res.status(400).json({ message: 'Target user ID is required' });
    }
    
    const targetId = parseInt(targetUserId, 10);

    try {
        const [existing] = await db.query(
            `SELECT cp1.conversation_id 
             FROM conversation_participants cp1
             JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
             WHERE cp1.user_id = ? AND cp2.user_id = ? AND cp1.user_id != cp2.user_id`,
            [userId, targetId]
        );

        if (existing.length > 0) {
            return res.status(200).json({ 
                message: 'Conversation already exists', 
                conversationId: existing[0].conversation_id 
            });
        }
        
        const [convResult] = await db.query(
            'INSERT INTO conversations () VALUES ()'
        );
        const conversationId = convResult.insertId;

        await db.query(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
            [conversationId, userId, conversationId, targetId]
        );

        res.status(201).json({ message: 'Conversation started successfully', conversationId });

    } catch (error) {
        console.error('Error starting new conversation:', error);
        res.status(500).json({ message: 'Server error while starting conversation' });
    }
};


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
            JOIN conversation_participants cp2 
                ON c.id = cp2.conversation_id 
                AND cp2.user_id != ? 
            JOIN users u ON cp2.user_id = u.id
            LEFT JOIN messages m ON m.conversation_id = c.id
                AND m.id = (
                    SELECT MAX(id)
                    FROM messages
                    WHERE conversation_id = c.id
                )
            WHERE cp.user_id = ? 
            ORDER BY c.updated_at DESC;
            `,
            [userId, userId] 
        );

        const formattedConversations = conversations.map(conv => {
            const senderPrefix = (conv.lastMessageSenderId === userId) ? 'Você: ' : '';
            
            return {
                id: conv.conversationId,
                contactName: conv.contactName || 'Contato Desconhecido',
                contactImage: conv.contactImage,
                lastMessageContent: conv.lastMessageContent ? (senderPrefix + conv.lastMessageContent) : 'Nenhuma mensagem.',
                lastActive: conv.lastActive,
                unreadCount: 0, 
            };
        });

        res.json(formattedConversations);

    } catch (error) {
        console.error('Error fetching conversations list:', error);
        res.status(500).json({ 
            message: 'Server error fetching conversations list', 
            error: error.message, 
            sqlState: error.sqlState || 'N/A' 
        });
    }
};

const getUserProfile = async (req, res) => {
    const userId = getCurrentUserId(req);

    try {
        const [rows] = await db.query(
            'SELECT id, email, name, image_url FROM users WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = rows[0];
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            image_url: user.image_url
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error fetching user profile' });
    }
};

const getConversationMessages = async (req, res) => {
    const conversationId = req.params.id;
    const currentUserId = getCurrentUserId(req);

    try {
        const [isParticipant] = await db.query(
            'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
            [conversationId, currentUserId]
        );

        if (isParticipant.length === 0) {
            return res.status(403).json({ message: 'Access denied to this conversation' });
        }

        const [otherParticipantRows] = await db.query(
            `SELECT u.name, u.image_url 
             FROM conversation_participants cp
             JOIN users u ON cp.user_id = u.id
             WHERE cp.conversation_id = ? AND cp.user_id != ?`,
            [conversationId, currentUserId]
        );
        
        const contact = otherParticipantRows[0] || { name: 'Usuário Desconhecido', image_url: null };

        const [messages] = await db.query(
            'SELECT id, sender_id as senderId, content, type, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
            [conversationId]
        );

        const formattedMessages = messages.map(msg => ({
            ...msg,
            isRead: true, 
            status: 'Delivered'
        }));


        res.json({
            conversationId: conversationId,
            contactName: contact.name,
            contactImage: contact.image_url,
            contactStatus: 'Online', 
            messages: formattedMessages
        });

    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ message: 'Server error fetching conversation data' });
    }
};

const sendMessage = async (req, res) => {
    const senderId = getCurrentUserId(req);
    const { conversation_id, content, type = 'text' } = req.body;
    const io = req.app.get('socketio');

    if (!conversation_id || !content) {
        return res.status(400).json({ message: 'Conversation ID and content are required' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)',
            [conversation_id, senderId, content, type]
        );
        
        const messageId = result.insertId;

        await db.query(
            'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [conversation_id]
        );
        
        const [messageRow] = await db.query('SELECT created_at FROM messages WHERE id = ?', [messageId]);
        const created_at = messageRow.length > 0 ? messageRow[0].created_at : new Date().toISOString();


        const newMessage = {
            id: messageId,
            conversation_id: conversation_id,
            senderId: senderId,
            content: content,
            type: type,
            created_at: created_at,
            isRead: false
        };

        if (io) {
             io.to(conversation_id).emit('new_message', newMessage);
        }

        res.status(201).json({ 
            message: 'Message sent successfully', 
            messageId: messageId,
            success: true 
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error sending message' });
    }
};


module.exports = { 
    register, 
    login, 
    uploadImage, 
    searchUserByEmail, 
    startNewConversation, 
    getConversations,
    getConversationMessages, 
    sendMessage,
    getUserProfile 
};
