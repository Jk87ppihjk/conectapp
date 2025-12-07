const express = require('express');
const http = require('http'); // NOVO
const cors = require('cors');
const routes = require('./routes');
const db = require('./db');
const { initializeSocket } = require('./socket'); // NOVO: Importa o handler de socket
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all domains
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api', routes);

// Endpoint Raiz
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// Inicialização do Banco de Dados
const initDb = async () => { /* ... existing initDb code ... */ };

// NOVO: Cria o servidor HTTP e anexa o Express
const server = http.createServer(app); 

// NOVO: Inicializa o Socket.IO no servidor
const io = initializeSocket(server); 

// Adicione a instância 'io' ao objeto de requisição para poder usá-la no controllers.js (ex: na função sendMessage)
app.set('socketio', io);


// Iniciar Servidor, usando 'server.listen' em vez de 'app.listen'
server.listen(PORT, async () => {
    await initDb();
    console.log(`Server running on port ${PORT}`);
});
