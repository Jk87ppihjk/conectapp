const cloudinary = require('./cloudinary');
const { Readable } = require('stream');

// Helper function to get the current user ID from the request object (set by authenticateToken middleware)
const getCurrentUserId = (req) => {
    // Certifica-se de que o ID é tratado como número, se possível
    return req.user ? parseInt(req.user.id, 10) : null;
};

/**
 * Função unificada para upload de Mídia (Imagens e Vídeos) para o Cloudinary.
 * O Cloudinary usa 'resource_type: auto' para detectar o tipo do arquivo.
 */
const uploadMedia = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const currentUserId = getCurrentUserId(req);

    try {
        // Encerra o buffer do arquivo em um stream legível para o Cloudinary
        const streamUpload = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { 
                        folder: 'conectapp_media', // Pasta dedicada para todos os uploads de mídia
                        resource_type: 'auto',     // Deixa o Cloudinary detectar se é 'image' ou 'video'
                        tags: currentUserId ? [`user_${currentUserId}`] : [] // Tag opcional para o usuário
                    },
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
        
        // Retorna a URL segura, o ID público e o tipo de recurso detectado pelo Cloudinary
        res.json({ 
            url: result.secure_url, 
            public_id: result.public_id,
            type: result.resource_type, // Retorna 'image' ou 'video'
            message: `Media (${result.resource_type}) uploaded successfully`
        });
        
    } catch (error) {
        console.error(`Error uploading media:`, error);
        res.status(500).json({ message: 'Upload failed' });
    }
};

module.exports = {
    uploadMedia
};
