const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

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
        socket.userId = decoded.id;
        next();
    });
};

const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // O usuário entra em uma sala de conversa específica
        socket.on('join_conversation', (conversationId) => {
            if (socket.currentRoom) {
                socket.leave(socket.currentRoom);
            }
            
            socket.join(conversationId);
            socket.currentRoom = conversationId;
            console.log(`User ${socket.userId} joined conversation: ${conversationId}`);
        });

        // Evento de digitação (já existente)
        socket.on('typing', (data) => {
            socket.to(data.conversationId).emit('typing', { 
                userId: socket.userId, 
                isTyping: data.isTyping 
            });
        });

        // Evento de leitura de mensagem (já existente)
        socket.on('message_read', (data) => {
            // Emite confirmação de leitura para o remetente
            socket.to(data.conversationId).emit('message_read_confirmation', {
                conversationId: data.conversationId,
                messageId: data.messageId,
                readerId: socket.userId
            });
        });

        // =======================================================
        // NOVOS HANDLERS PARA WEBRTC (SINALIZAÇÃO)
        // =======================================================

        // 1. Recebe a Oferta de Chamada e a repassa ao destinatário
        socket.on('call_offer', (data) => {
            // Repassa para a sala, excluindo o próprio remetente (socket.to)
            socket.to(data.conversationId).emit('call_offer', {
                offer: data.offer,
                callerId: socket.userId
            });
            console.log(`Offer sent from ${socket.userId} to room ${data.conversationId}`);
        });

        // 2. Recebe a Resposta da Chamada e a repassa ao chamador original
        socket.on('call_answer', (data) => {
            // Repassa para a sala
            socket.to(data.conversationId).emit('call_answer', {
                answer: data.answer,
                recipientId: socket.userId
            });
            console.log(`Answer sent from ${socket.userId} to room ${data.conversationId}`);
        });

        // 3. Recebe o Candidato ICE e o repassa ao peer
        socket.on('ice_candidate', (data) => {
            // Repassa para a sala
            socket.to(data.conversationId).emit('ice_candidate', {
                candidate: data.candidate
            });
        });

        // 4. Finaliza a chamada
        socket.on('call_end', (data) => {
            socket.to(data.conversationId).emit('call_end', {
                enderId: socket.userId
            });
            console.log(`Call ended by ${socket.userId} in room ${data.conversationId}`);
        });

        // Manipula a desconexão (já existente)
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
            if (socket.currentRoom) {
                socket.leave(socket.currentRoom);
            }
        });
    });

    return io;
};

module.exports = { initializeSocket };
