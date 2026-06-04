const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.DASHBOARD_PORT || 3002;

// ===== GLOBAL WHATSAPP CLIENT =====
let whatsappClient = null;
let isClientReady = false;
let clientInfo = null;

// ===== STATISTICS TRACKING =====
let stats = {
    totalMessages: 0,
    messagesReceived: 0,
    messagesSent: 0,
    dealsLocked: 0,
    numbersValidated: 0,
    activeCampaigns: 0
};

// ===== MESSAGE HISTORY =====
let messageHistory = [];
const MAX_HISTORY = 100;

// ===== DEALS TRACKING =====
let deals = [];

// ===== AI AGENT CONFIGURATION =====
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// AI Agent enabled state
let aiAgentEnabled = false;

// Keywords for deal detection
const DEAL_KEYWORDS = ['price', 'cost', 'buy', 'purchase', 'interested', 'quote', 'order', 'deal', 'package', 'service'];

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static(__dirname));

// Serve CSV files from parent directory
app.get('/valid.csv', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'valid.csv'));
});

app.get('/invalid.csv', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'invalid.csv'));
});

// ===== WHATSAPP CLIENT INITIALIZATION =====
function initializeWhatsAppClient() {
    console.log('🔄 Initializing WhatsApp client...');

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            clientId: 'dashboard-client',
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    // ===== EVENT: QR Code Generated =====
    whatsappClient.on('qr', async (qr) => {
        console.log('📱 QR Code received');

        try {
            // Generate QR code as data URL
            const qrDataUrl = await qrcode.toDataURL(qr);

            // Emit to all connected clients
            io.emit('whatsapp:qr', {
                qr: qrDataUrl,
                timestamp: new Date().toISOString()
            });

            console.log('✓ QR Code sent to dashboard');
        } catch (error) {
            console.error('❌ Error generating QR code:', error);
        }
    });

    // ===== EVENT: Client Ready =====
    whatsappClient.on('ready', async () => {
        console.log('✅ WhatsApp client is READY!');
        isClientReady = true;

        try {
            // Get client info
            const info = whatsappClient.info;
            clientInfo = {
                name: info.pushname,
                number: info.wid.user,
                platform: info.platform,
                profilePicUrl: null
            };

            console.log('📋 Client info:', {
                name: clientInfo.name,
                number: clientInfo.number,
                platform: clientInfo.platform
            });

            // Try to get profile picture with multiple attempts
            let profilePicUrl = null;
            const maxAttempts = 3;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    console.log(`🖼️ Attempting to fetch profile picture (attempt ${attempt}/${maxAttempts})...`);

                    // Try different methods to get profile picture
                    try {
                        profilePicUrl = await whatsappClient.getProfilePicUrl(info.wid._serialized);
                    } catch (err1) {
                        console.log('⚠️ Method 1 failed, trying alternative...');
                        // Try without _serialized
                        try {
                            profilePicUrl = await whatsappClient.getProfilePicUrl(info.wid.user + '@c.us');
                        } catch (err2) {
                            console.log('⚠️ Method 2 failed');
                        }
                    }

                    if (profilePicUrl) {
                        console.log('✅ Profile picture URL obtained:', profilePicUrl.substring(0, 50) + '...');
                        clientInfo.profilePicUrl = profilePicUrl;
                        break;
                    } else {
                        console.log(`⚠️ Attempt ${attempt} returned null, waiting 2 seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (error) {
                    console.log(`⚠️ Attempt ${attempt} failed:`, error.message);
                    if (attempt < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            if (!profilePicUrl) {
                console.log('⚠️ Could not fetch profile picture after all attempts - will use default avatar');
            }

            // Emit ready status to all clients
            const readyData = {
                status: 'connected',
                info: clientInfo,
                timestamp: new Date().toISOString()
            };

            console.log('📤 Emitting ready event with data:', {
                ...readyData,
                info: {
                    ...readyData.info,
                    profilePicUrl: readyData.info.profilePicUrl ? 'URL_PROVIDED' : 'NULL'
                }
            });

            io.emit('whatsapp:ready', readyData);

            console.log('✓ Client ready event emitted to all connected clients');
        } catch (error) {
            console.error('❌ Error in ready event handler:', error);
            io.emit('whatsapp:error', {
                error: 'Failed to get client info: ' + error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // ===== EVENT: Authentication Success =====
    whatsappClient.on('authenticated', () => {
        console.log('🔐 WhatsApp authenticated successfully');
        io.emit('whatsapp:authenticated', {
            message: 'Authentication successful',
            timestamp: new Date().toISOString()
        });
    });

    // ===== EVENT: Authentication Failure =====
    whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ Authentication failed:', msg);
        isClientReady = false;
        io.emit('whatsapp:auth_failure', {
            error: msg,
            timestamp: new Date().toISOString()
        });
    });

    // ===== EVENT: Disconnected =====
    whatsappClient.on('disconnected', (reason) => {
        console.log('🔌 WhatsApp disconnected:', reason);
        isClientReady = false;
        clientInfo = null;

        io.emit('whatsapp:disconnected', {
            reason: reason,
            timestamp: new Date().toISOString()
        });

        // Attempt to reconnect after 5 seconds
        console.log('⏳ Will attempt to reconnect in 5 seconds...');
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            initializeWhatsAppClient();
        }, 5000);
    });

    // ===== EVENT: Loading Screen =====
    whatsappClient.on('loading_screen', (percent, message) => {
        console.log(`⏳ Loading: ${percent}% - ${message}`);
        io.emit('whatsapp:loading', {
            percent: percent,
            message: message
        });
    });

    // ===== EVENT: Message Received =====
    whatsappClient.on('message', async (message) => {
        try {
            console.log('📨 Message received:', {
                from: message.from,
                body: message.body,
                isGroup: message.from.includes('@g.us')
            });

            // Update statistics
            stats.totalMessages++;
            stats.messagesReceived++;

            // Add to message history
            const messageData = {
                id: message.id._serialized,
                from: message.from,
                body: message.body,
                timestamp: message.timestamp,
                type: 'received',
                isGroup: message.from.includes('@g.us')
            };

            messageHistory.unshift(messageData);
            if (messageHistory.length > MAX_HISTORY) {
                messageHistory.pop();
            }

            // Emit to frontend
            io.emit('message:received', messageData);
            io.emit('stats:update', stats);

            // Skip group messages for AI agent
            if (message.from.includes('@g.us')) {
                console.log('⏭️ Skipping group message');
                return;
            }

            // Check if AI agent is enabled
            if (!aiAgentEnabled) {
                console.log('🤖 AI Agent is disabled');
                return;
            }

            // Check for deal keywords
            const messageText = message.body.toLowerCase();
            const isDealRelated = DEAL_KEYWORDS.some(keyword => messageText.includes(keyword));

            if (isDealRelated) {
                console.log('💰 Deal-related message detected');

                // Add to deals tracker
                const deal = {
                    id: Date.now().toString(),
                    contact: message.from,
                    message: message.body,
                    timestamp: new Date().toISOString(),
                    status: 'new'
                };

                deals.unshift(deal);
                stats.dealsLocked++;

                // Emit to frontend
                io.emit('deal:new', deal);
                io.emit('stats:update', stats);
            }

            // Call GROQ API for AI response
            console.log('🤖 Calling GROQ API for AI response...');

            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful WhatsApp business assistant. Keep responses concise and professional. If the message is about pricing, products, or services, be enthusiastic and helpful.'
                        },
                        {
                            role: 'user',
                            content: message.body
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                throw new Error(`GROQ API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const aiReply = data.choices[0].message.content;

            console.log('✅ AI response generated:', aiReply.substring(0, 50) + '...');

            // Send AI reply
            await whatsappClient.sendMessage(message.from, aiReply);

            stats.messagesSent++;

            // Add to message history
            const replyData = {
                id: Date.now().toString(),
                from: 'me',
                to: message.from,
                body: aiReply,
                timestamp: Date.now(),
                type: 'sent'
            };

            messageHistory.unshift(replyData);
            if (messageHistory.length > MAX_HISTORY) {
                messageHistory.pop();
            }

            // Emit to frontend
            io.emit('message:sent', replyData);
            io.emit('stats:update', stats);

            console.log('✅ AI reply sent successfully');

        } catch (error) {
            console.error('❌ Error handling message:', error);
            io.emit('error', {
                type: 'message_handler',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Initialize the client
    whatsappClient.initialize().catch(error => {
        console.error('❌ Failed to initialize WhatsApp client:', error);
        io.emit('whatsapp:error', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
    });
}

// ===== API ENDPOINTS =====

// Get WhatsApp connection status
app.get('/api/whatsapp/status', (req, res) => {
    res.json({
        connected: isClientReady,
        info: clientInfo,
        timestamp: new Date().toISOString()
    });
});

// Logout from WhatsApp
app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        if (whatsappClient) {
            await whatsappClient.logout();
            isClientReady = false;
            clientInfo = null;

            // Delete session folder
            const sessionPath = path.join(__dirname, '.wwebjs_auth');
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('✓ Session folder deleted');
            }

            io.emit('whatsapp:logged_out', {
                message: 'Logged out successfully',
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, message: 'Logged out successfully' });

            // Reinitialize client for new QR
            setTimeout(() => {
                initializeWhatsAppClient();
            }, 2000);
        } else {
            res.status(400).json({ success: false, message: 'No active client' });
        }
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get global WhatsApp client (for other tools to use)
app.get('/api/whatsapp/client', (req, res) => {
    if (isClientReady && whatsappClient) {
        res.json({
            available: true,
            info: clientInfo
        });
    } else {
        res.status(503).json({
            available: false,
            message: 'WhatsApp client not ready'
        });
    }
});

// Send a test message
app.post('/api/whatsapp/send-message', async (req, res) => {
    try {
        if (!isClientReady || !whatsappClient) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client not ready'
            });
        }

        const { number, message } = req.body;

        if (!number || !message) {
            return res.status(400).json({
                success: false,
                error: 'Number and message are required'
            });
        }

        // Format number (add @c.us if not present)
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

        // Send message
        await whatsappClient.sendMessage(chatId, message);

        // Update statistics
        stats.messagesSent++;

        // Add to message history
        const messageData = {
            id: Date.now().toString(),
            from: 'me',
            to: chatId,
            body: message,
            timestamp: Date.now(),
            type: 'sent'
        };

        messageHistory.unshift(messageData);
        if (messageHistory.length > MAX_HISTORY) {
            messageHistory.pop();
        }

        // Emit to frontend
        io.emit('message:sent', messageData);
        io.emit('stats:update', stats);

        res.json({
            success: true,
            message: 'Message sent successfully'
        });
    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get statistics
app.get('/api/stats', (req, res) => {
    res.json(stats);
});

// Get message history
app.get('/api/messages', (req, res) => {
    res.json({
        messages: messageHistory,
        total: messageHistory.length
    });
});

// Get deals
app.get('/api/deals', (req, res) => {
    res.json({
        deals: deals,
        total: deals.length
    });
});

// Toggle AI agent
app.post('/api/ai-agent/toggle', (req, res) => {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: 'enabled must be a boolean'
        });
    }

    aiAgentEnabled = enabled;

    console.log(`🤖 AI Agent ${enabled ? 'ENABLED' : 'DISABLED'}`);

    io.emit('ai-agent:status', { enabled: aiAgentEnabled });

    res.json({
        success: true,
        enabled: aiAgentEnabled
    });
});

// Get AI agent status
app.get('/api/ai-agent/status', (req, res) => {
    res.json({
        enabled: aiAgentEnabled
    });
});

// Bulk send messages
app.post('/api/bulk-send', async (req, res) => {
    try {
        if (!isClientReady || !whatsappClient) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client not ready'
            });
        }

        const { numbers, message, delay } = req.body;

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'numbers must be a non-empty array'
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'message is required'
            });
        }

        const delayMs = delay || 2000; // Default 2 seconds between messages

        // Start bulk send in background
        res.json({
            success: true,
            message: `Starting bulk send to ${numbers.length} numbers`,
            total: numbers.length
        });

        // Process in background
        (async () => {
            let sent = 0;
            let failed = 0;

            for (const number of numbers) {
                try {
                    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
                    await whatsappClient.sendMessage(chatId, message);

                    sent++;
                    stats.messagesSent++;

                    // Add to message history
                    const messageData = {
                        id: Date.now().toString(),
                        from: 'me',
                        to: chatId,
                        body: message,
                        timestamp: Date.now(),
                        type: 'sent'
                    };

                    messageHistory.unshift(messageData);
                    if (messageHistory.length > MAX_HISTORY) {
                        messageHistory.pop();
                    }

                    // Emit progress
                    io.emit('bulk-send:progress', {
                        sent,
                        failed,
                        total: numbers.length,
                        current: number
                    });

                    io.emit('message:sent', messageData);
                    io.emit('stats:update', stats);

                    console.log(`✅ Bulk send: ${sent}/${numbers.length} - ${number}`);

                    // Wait before next message
                    if (sent < numbers.length) {
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }

                } catch (error) {
                    failed++;
                    console.error(`❌ Bulk send failed for ${number}:`, error.message);

                    io.emit('bulk-send:progress', {
                        sent,
                        failed,
                        total: numbers.length,
                        current: number,
                        error: error.message
                    });
                }
            }

            // Emit completion
            io.emit('bulk-send:complete', {
                sent,
                failed,
                total: numbers.length
            });

            console.log(`✅ Bulk send complete: ${sent} sent, ${failed} failed`);

        })();

    } catch (error) {
        console.error('❌ Bulk send error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== SOCKET.IO CONNECTION =====
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Send current status immediately
    socket.emit('whatsapp:status', {
        connected: isClientReady,
        info: clientInfo,
        timestamp: new Date().toISOString()
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });

    // Handle manual reconnect request
    socket.on('whatsapp:reconnect', () => {
        console.log('🔄 Manual reconnect requested');
        if (whatsappClient) {
            whatsappClient.destroy().then(() => {
                initializeWhatsAppClient();
            });
        } else {
            initializeWhatsAppClient();
        }
    });
});

// ===== EXPORT CLIENT FOR OTHER MODULES =====
function getWhatsAppClient() {
    if (isClientReady && whatsappClient) {
        return whatsappClient;
    }
    return null;
}

function isWhatsAppReady() {
    return isClientReady;
}

// ===== START SERVER =====
server.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║     WhatsApp Toolkit Dashboard Server                 ║');
    console.log('║     with WhatsApp Web Integration                     ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Dashboard running on: http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO ready for real-time updates`);
    console.log('');
    console.log('📍 Available pages:');
    console.log(`   - Dashboard: http://localhost:${PORT}/index.html`);
    console.log(`   - Login: http://localhost:${PORT}/login.html`);
    console.log('');
    console.log('📡 API Endpoints:');
    console.log(`   - GET  /api/whatsapp/status`);
    console.log(`   - POST /api/whatsapp/logout`);
    console.log(`   - POST /api/whatsapp/send-message`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');

    // Initialize WhatsApp client
    initializeWhatsAppClient();
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use`);
        console.error('   Please stop the other server or use a different port');
    } else {
        console.error('❌ Server error:', error);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down server...');

    if (whatsappClient) {
        console.log('🔌 Closing WhatsApp client...');
        await whatsappClient.destroy();
    }

    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

// Export for use in other modules
module.exports = {
    getWhatsAppClient,
    isWhatsAppReady,
    app,
    io
};
