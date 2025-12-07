const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Mapeamento para armazenar em qual sala (conversação) cada usuário está
// userId -> conversationId
const userConversationMap = new Map();

// Função para autenticar o token JWT do cliente Socket.IO
const authenticateSocket = (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: Token missing'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
        // Anexa o ID do usuário ao objeto do socket
        socket.userId = decoded.id;
        next();
    });
};

const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*", // Ajuste conforme necessário para produção
            methods: ["GET", "POST"]
        }
    });

    // Aplica o middleware de autenticação a todas as conexões
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // 1. O usuário entra em uma sala de conversa específica
        socket.on('join_conversation', (conversationId) => {
            if (socket.currentRoom) {
                socket.leave(socket.currentRoom);
                userConversationMap.delete(socket.userId);
            }
            
            socket.join(conversationId);
            socket.currentRoom = conversationId;
            userConversationMap.set(socket.userId, conversationId);
            console.log(`User ${socket.userId} joined conversation: ${conversationId}`);

            // Avisa a sala que o usuário está online/ativo na conversa
            io.to(conversationId).emit('user_status_update', { 
                userId: socket.userId, 
                conversationId: conversationId, 
                status: 'online' 
            });
        });

        // 2. O usuário está digitando
        socket.on('typing', (data) => {
            // Repassa o evento de digitação para todos os outros usuários na sala
            socket.to(data.conversationId).emit('typing', { 
                userId: socket.userId, 
                isTyping: data.isTyping 
            });
        });

        // 3. O usuário leu a última mensagem
        socket.on('message_read', (data) => {
            // Você precisaria de um controlador aqui para atualizar o DB
            // Em seguida, emite a confirmação de leitura para o remetente
            socket.to(data.conversationId).emit('message_read_confirmation', {
                conversationId: data.conversationId,
                messageId: data.messageId,
                readerId: socket.userId
            });
        });
        
        // 4. Manipula a desconexão
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
            
            // Avisa a sala que o usuário saiu/ficou offline na conversa
            if (socket.currentRoom) {
                io.to(socket.currentRoom).emit('user_status_update', { 
                    userId: socket.userId, 
                    conversationId: socket.currentRoom, 
                    status: 'offline' 
                });
                userConversationMap.delete(socket.userId);
            }
        });
    });

    return io;
};

// A função sendMessage no controllers.js deve emitir um evento 'new_message' 
// APÓS salvar no DB, usando a instância 'io' para notificar o destinatário.

module.exports = { initializeSocket };
