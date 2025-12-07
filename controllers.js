const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const cloudinary = require('./cloudinary');
const { Readable } = require('stream');
require('dotenv').config();

const register = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        // Check if user exists
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
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

// NOVO: Busca um usuário pelo email
const searchUserByEmail = async (req, res) => {
    const { email } = req.query;
    const currentUserId = req.user.id;

    if (!email) {
        return res.status(400).json({ message: 'Email is required for search' });
    }

    try {
        // Busca o usuário, excluindo o próprio usuário logado
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


// NOVO: Inicia uma nova conversa 1-para-1
const startNewConversation = async (req, res) => {
    const userId = req.user.id;
    const { targetUserId } = req.body; // targetUserId é o ID do contato encontrado

    if (!targetUserId) {
        return res.status(400).json({ message: 'Target user ID is required' });
    }
    
    const targetId = parseInt(targetUserId, 10);

    try {
        // Verifica se a conversa já existe entre os dois usuários
        // Esta query simples assume que um chat 1-para-1 tem apenas dois participantes
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
        
        // 1. Cria a nova conversa
        const [convResult] = await db.query(
            'INSERT INTO conversations () VALUES ()'
        );
        const conversationId = convResult.insertId;

        // 2. Adiciona os dois participantes
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


module.exports = { register, login, uploadImage, searchUserByEmail, startNewConversation };
