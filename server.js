const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

// Import API routes
const campaignRoutes = require('./backend/routes/campaigns');

// Import bulk sender service
const { getInstance: getBulkSenderService } = require('./backend/services/bulkSenderService');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const activeLoops = require('./activeLoops');

// ===== SUPABASE CLIENT =====
const SUPABASE_URL = 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('✓ Supabase client initialized');

// ===== GLOBAL WHATSAPP CLIENT =====
let whatsappClient = null;
let isClientReady = false;
let clientInfo = null;
let isInitializing = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

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

// ===== SUPPRESS CHROME DEVTOOLS 404 ERROR =====
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.status(204).send(); // No Content - suppresses Chrome DevTools error
});

// ===== PAGE ROUTES =====
// Login page route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'login.html'));
});

// Dashboard page route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Root route - serve dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Serve CSV files from parent directory
app.get('/valid.csv', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'valid.csv'));
});

app.get('/invalid.csv', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'invalid.csv'));
});

// ===== WHATSAPP CLIENT INITIALIZATION =====
function initializeWhatsAppClient() {
    // Prevent multiple simultaneous initializations
    if (isInitializing) {
        console.log('⚠️ Client is already initializing, skipping...');
        return;
    }

    if (whatsappClient && isClientReady) {
        console.log('⚠️ Client is already ready, skipping initialization...');
        return;
    }

    isInitializing = true;
    console.log('🔄 Initializing WhatsApp client...');

    // Hard Reset: Delete SingletonLock if it exists (blocks initialization)
    const lockPath = path.join(__dirname, '.wwebjs_auth', 'session-dashboard-client', 'SingletonLock');
    if (fs.existsSync(lockPath)) {
        try {
            fs.unlinkSync(lockPath);
            console.log('🗑️ Deleted SingletonLock to prevent hang');
        } catch (err) {
            console.warn('⚠️ Could not delete SingletonLock:', err.message);
        }
    }

    // Check if session exists
    const sessionPath = path.join(__dirname, '.wwebjs_auth');
    const sessionExists = fs.existsSync(sessionPath);
    console.log(`📁 Session folder status: ${sessionExists ? 'EXISTS (will try to restore session)' : 'NOT FOUND (will show QR code)'}`);

    // Destroy existing client if any
    if (whatsappClient) {
        console.log('🗑️ Destroying existing client...');
        try {
            whatsappClient.destroy().catch(err => console.log('⚠️ Error destroying client:', err.message));
        } catch (err) {
            console.log('⚠️ Error in destroy:', err.message);
        }
        whatsappClient = null;
    }

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            clientId: 'dashboard-client',
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        puppeteer: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Hardcoded Windows Chrome path
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ],
            timeout: 60000 // 60 seconds timeout
        },
        authTimeoutMs: 60000,
        qrTimeoutMs: 60000,
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    });

    // Connection Timeout logic: Restart if initialization hangs
    let initTimeout = setTimeout(() => {
        if (isInitializing && !isClientReady) {
            console.log('🛑 Initialization timed out after 60s. Restarting client...');
            isInitializing = false;
            initializeWhatsAppClient();
        }
    }, 60000);

    // ===== EVENT: QR Code Generated =====
    whatsappClient.on('qr', async (qr) => {
        console.log('📱 QR Code received - waiting for scan');
        console.log('QR RECEIVED:', qr.substring(0, 50) + '...'); // Log QR for debugging
        isInitializing = false; // Allow re-initialization if QR expires

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
            io.emit('whatsapp:error', {
                error: 'Failed to generate QR code: ' + error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // ===== EVENT: Client Ready =====
    whatsappClient.on('ready', async () => {
        console.log('✅ WhatsApp client is READY!');
        isClientReady = true;
        isInitializing = false;
        reconnectAttempts = 0; // Reset reconnect counter on success

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
        isInitializing = false;
        reconnectAttempts = 0; // Reset on successful auth
        io.emit('whatsapp:authenticated', {
            message: 'Authentication successful',
            timestamp: new Date().toISOString()
        });
    });

    // ===== EVENT: Authentication Failure =====
    whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ CRITICAL: WhatsApp Authentication failed:', msg);
        isClientReady = false;
        isInitializing = false;
        io.emit('whatsapp:auth_failure', {
            error: msg,
            timestamp: new Date().toISOString()
        });

        // Don't auto-reconnect on auth failure - user needs to logout and rescan
        console.log('⚠️ Session might be corrupted. Delete .wwebjs_auth and restart.');
    });

    // ===== EVENT: Disconnected =====
    whatsappClient.on('disconnected', (reason) => {
        console.error('🔌 CRITICAL: WhatsApp disconnected! Reason:', reason);
        isClientReady = false;
        isInitializing = false;
        clientInfo = null;

        io.emit('whatsapp:disconnected', {
            reason: reason,
            timestamp: new Date().toISOString()
        });

        // Only attempt reconnect if we haven't exceeded max attempts
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`⏳ Attempting reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in 10 seconds...`);

            setTimeout(() => {
                console.log(`🔄 Re-initializing client after disconnect...`);
                initializeWhatsAppClient();
            }, 10000);
        }
    });

    // ===== EVENT: Loading Screen =====
    whatsappClient.on('loading_screen', (percent, message) => {
        console.log(`⏳ Loading: ${percent}% - ${message}`);
        io.emit('whatsapp:loading', {
            percent: percent,
            message: message
        });
    });

    // ===== EVENT: Remote Session Saved =====
    whatsappClient.on('remote_session_saved', () => {
        console.log('💾 Remote session saved successfully');
        console.log('✓ Session will persist across server restarts');
        io.emit('whatsapp:session_saved', {
            message: 'Session saved',
            timestamp: new Date().toISOString()
        });
    });

    // ===== EVENT: Change State =====
    whatsappClient.on('change_state', (state) => {
        console.log('🔄 Client state changed:', state);
        io.emit('whatsapp:state_change', {
            state: state,
            timestamp: new Date().toISOString()
        });
    });

    // ===== EVENT: General Error Handler =====
    whatsappClient.on('error', (error) => {
        console.error('❌ WhatsApp client error:', error);
        io.emit('whatsapp:error', {
            error: error.message || 'Unknown error',
            timestamp: new Date().toISOString()
        });
        // Don't crash - just log the error
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

            // Skip group messages and newsletters for AI agent
            if (message.from.includes('@g.us') || message.from.includes('@newsletter')) {
                console.log('⏭️ Skipping group message or newsletter');
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

            // ===== CHECK FOR PHOTO REQUESTS =====
            const photoKeywords = ['pic', 'pix', 'photo', 'image', 'dikhao', 'dikha', 'dekh'];
            const isPhotoRequest = photoKeywords.some(keyword => messageText.includes(keyword));

            if (isPhotoRequest) {
                console.log('📸 Photo request detected');

                try {
                    // Try to extract product tag from message
                    let productTag = null;

                    // Get all available tags from database
                    const { data: allMedia, error: mediaError } = await supabase
                        .from('product_media')
                        .select('product_tag');

                    if (!mediaError && allMedia && allMedia.length > 0) {
                        const uniqueTags = [...new Set(allMedia.map(m => m.product_tag.toLowerCase()))];

                        // Check if message contains any product tag
                        for (const tag of uniqueTags) {
                            if (messageText.includes(tag.toLowerCase())) {
                                productTag = tag;
                                console.log(`✓ Detected product tag: ${productTag}`);
                                break;
                            }
                        }
                    }

                    // Fetch images based on filter
                    let query = supabase
                        .from('product_media')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (productTag) {
                        // Filter by specific product
                        query = query.ilike('product_tag', productTag);
                    }

                    const { data: mediaItems, error: fetchError } = await query;

                    if (fetchError) {
                        console.error('⚠️ Error fetching media:', fetchError.message);
                    } else if (mediaItems && mediaItems.length > 0) {
                        console.log(`📤 Found ${mediaItems.length} images to send`);

                        // If no specific tag, send one image per category
                        let imagesToSend = mediaItems;
                        if (!productTag) {
                            const tagsSent = new Set();
                            imagesToSend = mediaItems.filter(item => {
                                if (!tagsSent.has(item.product_tag.toLowerCase())) {
                                    tagsSent.add(item.product_tag.toLowerCase());
                                    return true;
                                }
                                return false;
                            });
                            console.log(`📤 Sending one image per category: ${imagesToSend.length} images`);
                        }

                        // Limit to 5 images max to avoid spam
                        imagesToSend = imagesToSend.slice(0, 5);

                        // Send images
                        for (const mediaItem of imagesToSend) {
                            try {
                                console.log(`📤 Sending image: ${mediaItem.product_tag} - ${mediaItem.image_url}`);

                                const media = await MessageMedia.fromUrl(mediaItem.image_url);
                                await whatsappClient.sendMessage(message.from, media, {
                                    caption: `${mediaItem.product_tag}`
                                });

                                stats.messagesSent++;
                                console.log(`✅ Image sent: ${mediaItem.product_tag}`);

                                // Small delay between images
                                await new Promise(resolve => setTimeout(resolve, 1000));

                            } catch (sendError) {
                                console.error(`❌ Error sending image ${mediaItem.product_tag}:`, sendError.message);
                            }
                        }

                        // Send confirmation message
                        const confirmMsg = productTag
                            ? `Ji bhai ${productTag} ki pics bhej di hain. Quality dekh lo!`
                            : `Ji bhai pics bhej di hain. Quality dekh lo!`;

                        await whatsappClient.sendMessage(message.from, confirmMsg);
                        stats.messagesSent++;

                        io.emit('stats:update', stats);

                        console.log('✅ Photo request handled successfully');
                        return; // Exit - don't call AI for photo requests

                    } else {
                        console.log('⚠️ No images found in database');
                        // Let AI handle the "no images" response
                    }

                } catch (photoError) {
                    console.error('❌ Error handling photo request:', photoError.message);
                    // Continue to AI response on error
                }
            }

            // Call GROQ API for AI response
            console.log('🤖 Calling GROQ API for AI response...');

            // Fetch business instructions from Supabase
            let systemPrompt = 'You are a helpful WhatsApp business assistant.'; // Fallback

            try {
                console.log('📡 Fetching business config from Supabase...');
                const { data, error } = await supabase
                    .from('business_config')
                    .select('prompt_text')
                    .eq('id', 1)
                    .single();

                if (error) {
                    console.error('⚠️ Supabase error fetching business config:', error.message);
                    console.log('📝 Using fallback prompt');
                } else if (data && data.prompt_text) {
                    systemPrompt = data.prompt_text;
                    console.log('✓ Using business instructions from database');
                } else {
                    console.warn('⚠️ No business config found in database, using fallback');
                }
            } catch (dbError) {
                console.error('⚠️ Exception fetching business config:', dbError.message);
                console.log('📝 Using fallback prompt');
            }

            // Fetch current products and prices from Supabase
            try {
                console.log('📡 Fetching products from Supabase...');
                const { data: products, error: productsError } = await supabase
                    .from('products')
                    .select('item_name, price_pkr')
                    .order('item_name', { ascending: true });

                if (productsError) {
                    console.error('⚠️ Error fetching products:', productsError.message);
                } else if (products && products.length > 0) {
                    // Format products list for AI with STRICT instructions
                    const productsList = products.map(p => {
                        const price = parseFloat(p.price_pkr);
                        return `${p.item_name} = PKR ${price.toFixed(0)}`;
                    }).join('\n');

                    // Append products to system prompt with VERY STRICT instructions
                    systemPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**YAHAN TERI INVENTORY HAI - SIRF YEHI PRICES USE KARNA:**

${productsList}

**CRITICAL RULES:**
1. Agar customer kisi item ka price poocha to SIRF upar wali list se exact price batao
2. KABHI price ranges mat do (jaise "800 se 6000")
3. KABHI apni taraf se prices mat banao
4. Agar item list mein nahi hai to kehna "Bhai ye item abhi available nahi hai"
5. Design ya category ki baat mat karo - seedha price batao

Example: Agar customer "bedsheet kitne ki hai" poocha aur list mein "Bedsheet = PKR 1500" hai
to tu kehna: "Bhai bedsheet 1500 ki hai"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                    console.log(`✓ Loaded ${products.length} products into AI context:`);
                    products.forEach(p => {
                        console.log(`   - ${p.item_name}: PKR ${parseFloat(p.price_pkr).toFixed(0)}`);
                    });
                } else {
                    console.warn('⚠️ No products found in database');
                    systemPrompt += '\n\n**IMPORTANT:** Abhi inventory mein koi products nahi hain. Agar customer price poocha to kehna "Bhai abhi stock update ho raha hai, thori der mein batata hun"';
                }
            } catch (productsDbError) {
                console.error('⚠️ Exception fetching products:', productsDbError.message);
            }

            // Call GROQ API
            let aiReply = null;
            try {
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
                                content: systemPrompt
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
                    const errorText = await response.text();
                    throw new Error(`GROQ API error: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const data = await response.json();

                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    throw new Error('Invalid response format from GROQ API');
                }

                aiReply = data.choices[0].message.content;
                console.log('✅ AI response generated:', aiReply.substring(0, 50) + '...');

            } catch (apiError) {
                console.error('❌ GROQ API error:', apiError.message);
                io.emit('error', {
                    type: 'groq_api',
                    error: apiError.message,
                    timestamp: new Date().toISOString()
                });
                // Don't send a message if API fails
                return;
            }

            // Send AI reply
            try {
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

            } catch (sendError) {
                console.error('❌ Error sending message:', sendError.message);
                io.emit('error', {
                    type: 'send_message',
                    error: sendError.message,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('❌ Critical error in message handler:', error);
            io.emit('error', {
                type: 'message_handler',
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            // Don't crash the server - just log and continue
        }
    });

    // Initialize the client
    whatsappClient.initialize().catch(error => {
        console.error('❌ Failed to initialize WhatsApp client:', error);
        isInitializing = false;
        isClientReady = false;

        io.emit('whatsapp:error', {
            error: 'Initialization failed: ' + error.message,
            timestamp: new Date().toISOString()
        });

        // Attempt reconnect if under max attempts
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`⏳ Will retry initialization (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in 10 seconds...`);
            setTimeout(() => {
                initializeWhatsAppClient();
            }, 10000);
        } else {
            console.log('❌ Max initialization attempts reached. Please restart the server or check your configuration.');
        }
    });
}

// ===== API ENDPOINTS =====

// Mount campaign routes
app.use('/api/campaigns', campaignRoutes);

// Temporary test route
app.get('/api/test', (req, res) => res.send('API Working'));

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
            console.log('🚪 Logging out from WhatsApp...');

            // Reset all state flags
            isClientReady = false;
            isInitializing = false;
            clientInfo = null;
            reconnectAttempts = 0;

            try {
                await whatsappClient.logout();
                console.log('✓ WhatsApp logout successful');
            } catch (logoutError) {
                console.warn('⚠️ Logout error (continuing anyway):', logoutError.message);
            }

            // Destroy the client
            try {
                await whatsappClient.destroy();
                console.log('✓ Client destroyed');
            } catch (destroyError) {
                console.warn('⚠️ Destroy error (continuing anyway):', destroyError.message);
            }

            whatsappClient = null;

            // IMPORTANT: Only delete session folder if user explicitly wants to re-scan QR
            // Comment out the session deletion to preserve the session
            console.log('💾 Session folder preserved for next login');

            // Uncomment below ONLY if you want to force QR scan on next login:
            /*
            const sessionPath = path.join(__dirname, '.wwebjs_auth');
            if (fs.existsSync(sessionPath)) {
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log('✓ Session folder deleted');
                } catch (deleteError) {
                    console.warn('⚠️ Could not delete session folder:', deleteError.message);
                }
            }
            */

            io.emit('whatsapp:logged_out', {
                message: 'Logged out successfully',
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, message: 'Logged out successfully' });

            // Reinitialize client for new QR
            setTimeout(() => {
                console.log('🔄 Reinitializing client after logout...');
                initializeWhatsAppClient();
            }, 3000);
        } else {
            res.status(400).json({ success: false, message: 'No active client' });
        }
    } catch (error) {
        console.error('❌ Logout error:', error);
        isInitializing = false; // Reset flag on error
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

// Update validation count
app.post('/api/stats/validation', (req, res) => {
    const { count } = req.body;
    if (count && typeof count === 'number' && count > 0) {
        stats.numbersValidated += count;
        console.log(`✓ Numbers validated counter updated: +${count} (total: ${stats.numbersValidated})`);
    }
    res.json({ success: true, numbersValidated: stats.numbersValidated });
});

// Get comprehensive dashboard statistics with campaign aggregation
app.get('/api/dashboard/stats', (req, res) => {
    try {
        // Aggregate campaign statistics
        const campaignStats = bulkCampaigns.reduce((acc, campaign) => {
            acc.totalSent += campaign.sent || 0;
            acc.totalFailed += campaign.failed || 0;
            acc.totalPending += campaign.pending || 0;

            if (campaign.status === 'active' || campaign.status === 'processing') {
                acc.activeCampaigns++;
            }
            if (campaign.status === 'completed') {
                acc.completedCampaigns++;
            }

            return acc;
        }, {
            totalSent: 0,
            totalFailed: 0,
            totalPending: 0,
            activeCampaigns: 0,
            completedCampaigns: 0
        });

        // Calculate numbers validated (total contacts from all campaigns)
        const totalContactsValidated = bulkCampaigns.reduce((total, campaign) => {
            return total + (campaign.contacts ? campaign.contacts.length : 0);
        }, 0);

        // Combine with existing stats
        const dashboardStats = {
            // Message statistics
            totalMessages: stats.totalMessages || 0,
            messagesReceived: stats.messagesReceived || 0,
            messagesSent: stats.messagesSent || 0,

            // Campaign statistics
            campaignMessagesSent: campaignStats.totalSent,
            campaignMessagesFailed: campaignStats.totalFailed,
            campaignMessagesPending: campaignStats.totalPending,
            activeCampaigns: campaignStats.activeCampaigns,
            completedCampaigns: campaignStats.completedCampaigns,
            totalCampaigns: bulkCampaigns.length,

            // Deals and validation
            dealsLocked: deals.length, // Use actual deals array length
            numbersValidated: Math.max(stats.numbersValidated || 0, totalContactsValidated),

            // Overall totals
            totalSent: (stats.messagesSent || 0) + campaignStats.totalSent,
            totalDeals: deals.length,

            // Campaign performance data for charts
            campaigns: bulkCampaigns.map(c => ({
                name: c.name,
                sent: c.sent || 0,
                failed: c.failed || 0,
                pending: c.pending || 0,
                status: c.status
            })),

            // Deal status breakdown
            dealsBreakdown: {
                new: deals.filter(d => d.status === 'new').length,
                pending: deals.filter(d => d.status === 'pending').length,
                completed: deals.filter(d => d.status === 'completed').length
            }
        };

        res.json({
            success: true,
            stats: dashboardStats
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get message history
app.get('/api/messages', (req, res) => {
    res.json({
        messages: messageHistory,
        total: messageHistory.length
    });
});

// Get deals
// Test endpoint to seed fake deals data
app.get('/api/deals', (req, res) => {
    const { status = 'all', page = 1, limit = 10 } = req.query;

    // Filter by status
    let filtered = status === 'all' ? deals : deals.filter(d => d.status === status);

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedDeals = filtered.slice(startIndex, startIndex + parseInt(limit));

    // Counters
    const totalDeals = deals.length;
    const completed = deals.filter(d => d.status === 'completed').length;
    const pending = deals.filter(d => d.status === 'pending' || d.status === 'new').length;

    res.json({
        success: true,
        deals: paginatedDeals,
        totalDeals,
        completed,
        pending,
        total: filtered.length,
        page: parseInt(page),
        totalPages: Math.ceil(filtered.length / parseInt(limit))
    });
});

// Toggle AI agent
app.post('/api/ai-agent/toggle', async (req, res) => {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: 'enabled must be a boolean'
        });
    }

    try {
        // Update in-memory state
        aiAgentEnabled = enabled;

        // Persist to database
        const { data, error } = await supabase
            .from('business_config')
            .update({
                is_active: enabled,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1)
            .select();

        if (error) {
            console.error('❌ Error updating AI agent status in database:', error);
            // Continue anyway - in-memory state is updated
        } else {
            console.log(`✓ AI agent status persisted to database: ${enabled}`);
        }

        console.log(`🤖 AI Agent ${enabled ? 'ENABLED' : 'DISABLED'}`);

        // Emit to all connected clients
        io.emit('ai-agent:status', { enabled: aiAgentEnabled });

        res.json({
            success: true,
            enabled: aiAgentEnabled
        });
    } catch (error) {
        console.error('❌ Exception toggling AI agent:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get AI agent status
app.get('/api/ai-agent/status', async (req, res) => {
    try {
        // Try to get status from database
        const { data, error } = await supabase
            .from('business_config')
            .select('is_active')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('⚠️ Error fetching AI agent status from database:', error);
            // Fall back to in-memory state
            return res.json({
                enabled: aiAgentEnabled
            });
        }

        // Sync in-memory state with database
        if (data && typeof data.is_active === 'boolean') {
            aiAgentEnabled = data.is_active;
        }

        res.json({
            enabled: aiAgentEnabled
        });
    } catch (error) {
        console.error('❌ Exception fetching AI agent status:', error);
        res.json({
            enabled: aiAgentEnabled
        });
    }
});

// Get business config (AI prompt)
app.get('/api/business-config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('business_config')
            .select('prompt_text')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('❌ Error fetching business config:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            prompt_text: data.prompt_text
        });
    } catch (error) {
        console.error('❌ Exception fetching business config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update business config (AI prompt)
app.post('/api/business-config', async (req, res) => {
    try {
        const { prompt_text } = req.body;

        if (!prompt_text) {
            return res.status(400).json({
                success: false,
                error: 'prompt_text is required'
            });
        }

        const { data, error } = await supabase
            .from('business_config')
            .update({
                prompt_text: prompt_text,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1)
            .select();

        if (error) {
            console.error('❌ Error updating business config:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        console.log('✓ Business config updated successfully');

        res.json({
            success: true,
            message: 'Business config updated successfully'
        });
    } catch (error) {
        console.error('❌ Exception updating business config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
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

// ===== PRODUCTS API ENDPOINTS =====

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching products:', error);

            // Check if it's a connection/network error
            if (error.message && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
                return res.status(503).json({
                    success: false,
                    error: 'Database connection unavailable',
                    hint: 'Check SUPABASE_CONNECTION_ERROR.md for troubleshooting'
                });
            }

            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            products: data || []
        });
    } catch (error) {
        console.error('❌ Exception fetching products:', error);

        // Handle DNS/network errors
        if (error.cause && (error.cause.code === 'ENOTFOUND' || error.cause.code === 'ECONNREFUSED')) {
            return res.status(503).json({
                success: false,
                error: 'Cannot connect to database - DNS or network error',
                hint: 'Run: node update-supabase-config.js <NEW_URL> <NEW_KEY>'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create a new product
app.post('/api/products', async (req, res) => {
    try {
        const { item_name, price_pkr } = req.body;

        if (!item_name || !price_pkr) {
            return res.status(400).json({
                success: false,
                error: 'item_name and price_pkr are required'
            });
        }

        if (parseFloat(price_pkr) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'price_pkr must be greater than 0'
            });
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                item_name: item_name.trim(),
                price_pkr: parseFloat(price_pkr)
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating product:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        console.log('✓ Product created:', data.item_name);

        res.json({
            success: true,
            product: data
        });
    } catch (error) {
        console.error('❌ Exception creating product:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update a product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { item_name, price_pkr } = req.body;

        if (!item_name || !price_pkr) {
            return res.status(400).json({
                success: false,
                error: 'item_name and price_pkr are required'
            });
        }

        if (parseFloat(price_pkr) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'price_pkr must be greater than 0'
            });
        }

        const { data, error } = await supabase
            .from('products')
            .update({
                item_name: item_name.trim(),
                price_pkr: parseFloat(price_pkr),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('❌ Error updating product:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        console.log('✓ Product updated:', data.item_name);

        res.json({
            success: true,
            product: data
        });
    } catch (error) {
        console.error('❌ Exception updating product:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('❌ Error deleting product:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        console.log('✓ Product deleted:', data.item_name);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('❌ Exception deleting product:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== MEDIA GALLERY API ENDPOINTS =====

// Configure multer for memory storage - Multi-file support
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max per file
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/jpg',
            'image/webp',
            'application/pdf',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, WebP, PDF, CSV, DOC, and DOCX files are allowed'));
        }
    }
});

// Upload media to Supabase Storage - Multi-file support
app.post('/api/media/upload', upload.array('files', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        const { tag } = req.body;
        if (!tag) {
            return res.status(400).json({
                success: false,
                error: 'Product tag is required'
            });
        }

        console.log(`📤 Uploading ${req.files.length} file(s) to Supabase Storage...`);

        const uploadedMedia = [];
        const errors = [];

        // Process each file
        for (const file of req.files) {
            try {
                // Generate unique filename
                const timestamp = Date.now();
                const randomId = Math.floor(Math.random() * 1000000);
                const fileExt = path.extname(file.originalname);
                const fileName = `${tag.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${randomId}${fileExt}`;
                const filePath = `product-images/${fileName}`;

                console.log(`  📎 Uploading ${file.originalname}...`);

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype,
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error(`  ❌ Failed to upload ${file.originalname}:`, uploadError.message);
                    errors.push({ filename: file.originalname, error: uploadError.message });
                    continue;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(filePath);

                const fileUrl = urlData.publicUrl;

                console.log(`  ✓ Uploaded to storage: ${fileUrl}`);

                // Save metadata to database
                const { data: dbData, error: dbError } = await supabase
                    .from('product_media')
                    .insert({
                        product_tag: tag,
                        image_url: fileUrl,
                        file_name: fileName,
                        file_size: file.size,
                        mime_type: file.mimetype
                    })
                    .select()
                    .single();

                if (dbError) {
                    console.error(`  ❌ Database insert error for ${file.originalname}:`, dbError.message);
                    // Try to delete the uploaded file
                    await supabase.storage.from('product-images').remove([filePath]);
                    errors.push({ filename: file.originalname, error: dbError.message });
                    continue;
                }

                console.log(`  ✓ Metadata saved to database`);
                uploadedMedia.push(dbData);

            } catch (fileError) {
                console.error(`  ❌ Exception processing ${file.originalname}:`, fileError.message);
                errors.push({ filename: file.originalname, error: fileError.message });
            }
        }

        console.log(`✅ Upload complete: ${uploadedMedia.length} succeeded, ${errors.length} failed`);

        res.json({
            success: true,
            uploaded: uploadedMedia.length,
            failed: errors.length,
            media: uploadedMedia,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('❌ Exception uploading media:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all media or filter by tag
app.get('/api/media', async (req, res) => {
    try {
        const { tag } = req.query;

        let query = supabase
            .from('product_media')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter by tag if provided
        if (tag) {
            query = query.ilike('product_tag', tag);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Error fetching media:', error);

            // Check if it's a connection/network error
            if (error.message && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
                return res.status(503).json({
                    success: false,
                    error: 'Database connection unavailable',
                    hint: 'Check SUPABASE_CONNECTION_ERROR.md for troubleshooting'
                });
            }

            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            media: data || []
        });
    } catch (error) {
        console.error('❌ Exception fetching media:', error);

        // Handle DNS/network errors
        if (error.cause && (error.cause.code === 'ENOTFOUND' || error.cause.code === 'ECONNREFUSED')) {
            return res.status(503).json({
                success: false,
                error: 'Cannot connect to database - DNS or network error',
                hint: 'Run: node update-supabase-config.js <NEW_URL> <NEW_KEY>'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete media
app.delete('/api/media/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get media info first
        const { data: media, error: fetchError } = await supabase
            .from('product_media')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !media) {
            return res.status(404).json({
                success: false,
                error: 'Media not found'
            });
        }

        // Delete from storage
        const filePath = `product-images/${media.file_name}`;
        const { error: storageError } = await supabase.storage
            .from('product-images')
            .remove([filePath]);

        if (storageError) {
            console.warn('⚠️ Failed to delete from storage:', storageError.message);
            // Continue anyway - database cleanup is more important
        }

        // Delete from database
        const { error: dbError } = await supabase
            .from('product_media')
            .delete()
            .eq('id', id);

        if (dbError) {
            console.error('❌ Error deleting media from database:', dbError);
            return res.status(500).json({
                success: false,
                error: dbError.message
            });
        }

        res.json({
            success: true,
            message: 'Media deleted successfully'
        });
    } catch (error) {
        console.error('❌ Exception deleting media:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== BULK SENDER API ROUTES =====

// Bulk sender storage
let bulkCampaigns = [];
let bulkBlacklist = [];
let bulkDNDSettings = { startTime: '23:00', endTime: '08:00' };
let campaignIdCounter = 1;

// Configure multer for bulk sender uploads
const bulkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type'));
    }
});

// Get all campaigns
app.get('/api/bulk/campaigns', (req, res) => {
    res.json({
        success: true,
        campaigns: bulkCampaigns
    });
});

// Get single campaign
app.get('/api/bulk/campaigns/:id', (req, res) => {
    const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));
    if (!campaign) {
        return res.status(404).json({
            success: false,
            message: 'Campaign not found'
        });
    }
    res.json({
        success: true,
        campaign
    });
});

// Create campaign
app.post('/api/bulk/campaigns', bulkUpload.array('media', 10), async (req, res) => {
    try {
        const { name, message, contacts } = req.body;

        console.log('📥 Campaign creation request received');
        console.log('   Name:', name);
        console.log('   Message length:', message?.length);
        console.log('   Contacts (raw type):', typeof contacts);

        if (!name || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name and message are required'
            });
        }

        if (!contacts) {
            return res.status(400).json({
                success: false,
                message: 'Contacts are required. Please upload a CSV/Excel file.'
            });
        }

        let contactsList;
        try {
            contactsList = JSON.parse(contacts);
            console.log('✓ Contacts parsed successfully');
            console.log('   Total contacts:', contactsList.length);

            if (contactsList.length > 0) {
                console.log('   Sample contact:', JSON.stringify(contactsList[0]));
            }
        } catch (parseError) {
            console.error('❌ Failed to parse contacts JSON:', parseError.message);
            console.error('   Raw contacts value:', contacts?.substring(0, 200));
            return res.status(400).json({
                success: false,
                message: 'Invalid contacts format: ' + parseError.message
            });
        }

        if (!Array.isArray(contactsList)) {
            console.error('❌ Contacts is not an array:', typeof contactsList);
            return res.status(400).json({
                success: false,
                message: 'Contacts must be an array'
            });
        }

        if (contactsList.length === 0) {
            console.error('❌ Contacts list is empty');
            return res.status(400).json({
                success: false,
                message: 'No contacts found. Please ensure your CSV/Excel file has valid phone numbers.'
            });
        }

        // Validate and clean contacts
        const validContacts = contactsList.filter(c => {
            if (!c || typeof c !== 'object') return false;
            const phone = String(c.phone || '').trim();
            return phone.length >= 7; // Minimum valid phone length
        });

        console.log(`✓ Valid contacts: ${validContacts.length} / ${contactsList.length}`);

        if (validContacts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid contacts found. Please check your file format.'
            });
        }

        const campaign = {
            id: campaignIdCounter++,
            name,
            message,
            contacts: validContacts,
            status: 'pending',
            sent: 0,
            failed: 0,
            pending: validContacts.length,
            created_at: new Date().toISOString(),
            media: req.files ? req.files.map(f => ({
                filename: f.originalname,
                size: f.size,
                mimetype: f.mimetype,
                buffer: f.buffer // Store the actual file buffer
            })) : []
        };

        bulkCampaigns.push(campaign);

        console.log(`✅ Campaign created: ID=${campaign.id}, Valid contacts=${validContacts.length}`);

        res.json({
            success: true,
            campaignId: campaign.id,
            message: 'Campaign created successfully',
            totalContacts: validContacts.length,
            skipped: contactsList.length - validContacts.length
        });
    } catch (error) {
        console.error('❌ Error creating campaign:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Start campaign
app.post('/api/bulk/campaigns/:id/start', async (req, res) => {
    try {
        const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Reset stop flag if starting
        campaign.stopRequested = false;

        // Check if WhatsApp is connected
        if (!isClientReady || !whatsappClient) {
            return res.status(503).json({
                success: false,
                message: 'WhatsApp is not connected. Please scan QR code first.'
            });
        }

        campaign.status = 'active';

        // Send response immediately
        res.json({
            success: true,
            message: 'Campaign started'
        });

        // Start sending messages in background
        (async () => {
            console.log(`\n🚀 Starting campaign: ${campaign.name}`);
            console.log(`📊 Total contacts: ${campaign.contacts.length}`);

            // Helper function to normalize phone numbers for comparison
            const normalizePhone = (phone) => {
                // Remove all non-numeric characters
                let normalized = phone.replace(/[^0-9]/g, '');
                // Remove leading + if present
                normalized = normalized.replace(/^\+/, '');
                return normalized;
            };

            // Helper function to check if number is blacklisted
            const isBlacklisted = (phone) => {
                const normalizedPhone = normalizePhone(phone);
                return bulkBlacklist.some(blacklisted => {
                    const normalizedBlacklisted = normalizePhone(blacklisted.phone);
                    return normalizedPhone === normalizedBlacklisted;
                });
            };

            let skipped = 0; // Track skipped contacts

            for (let i = 0; i < campaign.contacts.length; i++) {
                // CHECK FOR STOP FLAG
                if (campaign.stopRequested) {
                    console.log(`🛑 Campaign ${campaign.name} stopped by user.`);
                    campaign.status = 'stopped';
                    io.emit('bulk-campaign:stopped', {
                        campaignId: campaign.id,
                        sent: campaign.sent,
                        failed: campaign.failed,
                        skipped: skipped
                    });
                    return; // KILL THE LOOP
                }

                // CHECK FOR PAUSE STATE
                while (campaign.status === 'paused') {
                    console.log(`⏸️ Campaign ${campaign.name} is paused. Waiting...`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds

                    // Also check if stopped while paused
                    if (campaign.stopRequested) {
                        console.log(`🛑 Campaign ${campaign.name} stopped while paused.`);
                        campaign.status = 'stopped';
                        io.emit('bulk-campaign:stopped', {
                            campaignId: campaign.id,
                            sent: campaign.sent,
                            failed: campaign.failed,
                            skipped: skipped
                        });
                        return;
                    }
                }

                const contact = campaign.contacts[i];

                try {
                    // Check if number is blacklisted
                    if (isBlacklisted(contact.phone)) {
                        console.log(`⛔ Skipped (Blacklisted): ${contact.name} (${contact.phone})`);
                        skipped++;
                        campaign.pending = Math.max(0, (campaign.pending || 0) - 1);

                        // Emit progress update
                        io.emit('bulk-campaign:progress', {
                            campaignId: campaign.id,
                            sent: campaign.sent,
                            failed: campaign.failed,
                            pending: campaign.pending,
                            skipped: skipped
                        });

                        continue; // Skip this contact
                    }

                    // Format phone number (add @c.us if not present)
                    let phoneNumber = contact.phone.replace(/[^0-9]/g, '');

                    // Pakistani number sanitization: remove leading 0 and prefix with 92
                    if (phoneNumber.startsWith('0')) {
                        phoneNumber = '92' + phoneNumber.substring(1);
                    }

                    if (!phoneNumber.endsWith('@c.us')) {
                        phoneNumber = phoneNumber + '@c.us';
                    }

                    // Replace variables in message template
                    let personalizedMessage = campaign.message
                        .replace(/{name}/g, contact.name || 'there')
                        .replace(/{city}/g, contact.city || '')
                        .replace(/{tag}/g, contact.tag || '')
                        .replace(/{phone}/g, contact.phone || '');

                    // Send text message via WhatsApp
                    console.log(`📤 Sending to ${contact.name} (${contact.phone})...`);
                    await whatsappClient.sendMessage(phoneNumber, personalizedMessage);
                    console.log(`✅ Text message sent`);

                    // Send per-contact media files (custom_image, custom_doc from CSV)
                    const perContactMedia = [];
                    if (contact.custom_image) perContactMedia.push(contact.custom_image);
                    if (contact.custom_doc) perContactMedia.push(contact.custom_doc);

                    if (perContactMedia.length > 0) {
                        console.log(`📎 Sending ${perContactMedia.length} per-contact media file(s)...`);

                        for (const mediaPath of perContactMedia) {
                            try {
                                // Load file from disk
                                const fullPath = path.join(__dirname, mediaPath);
                                if (fs.existsSync(fullPath)) {
                                    const media = MessageMedia.fromFilePath(fullPath);
                                    await whatsappClient.sendMessage(phoneNumber, media);
                                    console.log(`✅ Sent per-contact media: ${path.basename(mediaPath)}`);

                                    // Small delay between media files
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                } else {
                                    console.warn(`⚠️ File not found: ${fullPath}`);
                                }
                            } catch (mediaError) {
                                console.error(`❌ Failed to send per-contact media ${mediaPath}:`, mediaError.message);
                            }
                        }
                    }

                    // Send global campaign media files (uploaded via dashboard)
                    if (campaign.media && campaign.media.length > 0) {
                        console.log(`📎 Sending ${campaign.media.length} global campaign media file(s)...`);

                        for (const mediaFile of campaign.media) {
                            try {
                                // Create MessageMedia from buffer
                                const media = new MessageMedia(
                                    mediaFile.mimetype,
                                    mediaFile.buffer.toString('base64'),
                                    mediaFile.filename
                                );

                                // Send media file
                                await whatsappClient.sendMessage(phoneNumber, media);
                                console.log(`✅ Sent global media: ${mediaFile.filename}`);

                                // Small delay between media files
                                await new Promise(resolve => setTimeout(resolve, 2000));

                            } catch (mediaError) {
                                console.error(`❌ Failed to send global media ${mediaFile.filename}:`, mediaError.message);
                            }
                        }
                    }

                    // Update campaign stats
                    campaign.sent++;
                    campaign.pending--;

                    console.log(`✅ Completed ${campaign.sent}/${campaign.contacts.length}`);

                    // Emit progress update
                    io.emit('bulk-campaign:progress', {
                        campaignId: campaign.id,
                        sent: campaign.sent,
                        failed: campaign.failed,
                        pending: campaign.pending
                    });

                    // Random delay between 8-15 seconds before next contact
                    const delay = Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000;
                    console.log(`⏳ Waiting ${delay/1000}s before next contact...`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                } catch (error) {
                    console.error(`❌ Failed to send to ${contact.name}:`, error.message);
                    campaign.failed++;
                    campaign.pending--;

                    // Emit progress update
                    io.emit('bulk-campaign:progress', {
                        campaignId: campaign.id,
                        sent: campaign.sent,
                        failed: campaign.failed,
                        pending: campaign.pending
                    });
                }
            }

            // Campaign completed
            campaign.status = 'completed';
            console.log(`\n✅ Campaign completed: ${campaign.name}`);
            console.log(`📊 Sent: ${campaign.sent}, Failed: ${campaign.failed}, Skipped (Blacklisted): ${skipped}`);

            io.emit('bulk-campaign:complete', {
                campaignId: campaign.id,
                sent: campaign.sent,
                failed: campaign.failed,
                skipped: skipped
            });

        })();

    } catch (error) {
        console.error('Error starting campaign:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Stop campaign (new alias as requested)
app.post('/stop-campaign/:id', (req, res) => {
    const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));
    if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    // Disallow if already finished, cancelled, or stopped
    const terminalStates = ['completed', 'stopped', 'cancelled'];
    if (terminalStates.includes(campaign.status)) {
        return res.status(400).json({ success: false, message: `Campaign cannot be stopped in state ${campaign.status}` });
    }
    // Signal the async loop to stop and mark status
    campaign.stopRequested = true;
    campaign.status = 'stopped';
    io.emit('bulk-campaign:stopped', { campaignId: campaign.id });
    res.json({ success: true, message: 'Campaign stopped' });
});

// Stop campaign (REST-compliant endpoint)
app.post('/api/bulk/campaigns/:id/stop', (req, res) => {
    const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));
    if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    const terminalStates = ['completed', 'stopped', 'cancelled'];
    if (terminalStates.includes(campaign.status)) {
        return res.status(400).json({ success: false, message: `Campaign cannot be stopped in state ${campaign.status}` });
    }
    campaign.stopRequested = true;
    campaign.status = 'stopped';
    console.log(`🛑 Campaign ${campaign.id} (${campaign.name}) stop requested`);
    io.emit('bulk-campaign:stopped', { campaignId: campaign.id });
    res.json({ success: true, message: 'Campaign stopped' });
});

// Pause campaign
app.post('/api/bulk/campaigns/:id/pause', (req, res) => {
    const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));
    if (!campaign) {
        return res.status(404).json({
            success: false,
            message: 'Campaign not found'
        });
    }

    if (campaign.status !== 'active') {
        return res.status(400).json({
            success: false,
            message: 'Only active campaigns can be paused'
        });
    }

    campaign.status = 'paused';
    io.emit('bulk-campaign:paused', { campaignId: campaign.id });

    res.json({
        success: true,
        message: 'Campaign paused'
    });
});

// Resume campaign
app.post('/api/bulk/campaigns/:id/resume', (req, res) => {
    const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));
    if (campaign) {
        campaign.status = 'active';
    }
    res.json({
        success: true,
        message: 'Campaign resumed'
    });
});

// Delete campaign
app.delete('/api/bulk/campaigns/:id', (req, res) => {
    const index = bulkCampaigns.findIndex(c => c.id === parseInt(req.params.id));
    if (index !== -1) {
        bulkCampaigns.splice(index, 1);
    }
    res.json({
        success: true,
        message: 'Campaign deleted'
    });
});

// Export campaign results
app.get('/api/bulk/campaigns/:id/export', (req, res) => {
    const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));
    if (!campaign) {
        return res.status(404).json({
            success: false,
            message: 'Campaign not found'
        });
    }

    // Generate CSV
    let csv = 'Name,Phone,Status\n';
    campaign.contacts.forEach(contact => {
        csv += `${contact.name},${contact.phone},Sent\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=campaign_${campaign.id}_results.csv`);
    res.send(csv);
});

// Get blacklist
app.get('/api/bulk/blacklist', (req, res) => {
    res.json({
        success: true,
        blacklist: bulkBlacklist
    });
});

// Add to blacklist
app.post('/api/bulk/blacklist', (req, res) => {
    const { phone, reason } = req.body;
    if (!phone) {
        return res.status(400).json({
            success: false,
            message: 'Phone number is required'
        });
    }
    bulkBlacklist.push({ phone, reason: reason || 'Manually added', added_at: new Date().toISOString() });
    res.json({
        success: true,
        message: 'Added to blacklist'
    });
});

// Remove from blacklist
app.delete('/api/bulk/blacklist/:phone', (req, res) => {
    const phone = decodeURIComponent(req.params.phone);
    const index = bulkBlacklist.findIndex(b => b.phone === phone);
    if (index !== -1) {
        bulkBlacklist.splice(index, 1);
    }
    res.json({
        success: true,
        message: 'Removed from blacklist'
    });
});

// Get WhatsApp groups
app.get('/api/bulk/groups', async (req, res) => {
    try {
        if (!isClientReady) {
            return res.json({
                success: false,
                message: 'WhatsApp not connected'
            });
        }

        const chats = await whatsappClient.getChats();
        const groups = chats.filter(chat => chat.isGroup).map(group => ({
            id: group.id._serialized,
            name: group.name,
            participantCount: group.participants ? group.participants.length : 0
        }));

        res.json({
            success: true,
            groups
        });
    } catch (error) {
        console.error('Error getting groups:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Extract group members
app.get('/api/bulk/groups/:id/members', async (req, res) => {
    try {
        if (!isClientReady || !whatsappClient) {
            return res.status(503).json({
                success: false,
                message: 'WhatsApp not connected. Please scan QR code first.'
            });
        }

        const groupId = decodeURIComponent(req.params.id);
        console.log(`📥 Extracting members from group: ${groupId}`);

        // Validate group ID format
        if (!groupId || groupId.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required'
            });
        }

        // Ensure group ID has proper format
        let formattedGroupId = groupId;
        if (!groupId.includes('@g.us')) {
            formattedGroupId = groupId + '@g.us';
        }

        console.log(`🔍 Fetching chat with ID: ${formattedGroupId}`);

        // Get the chat
        const chat = await whatsappClient.getChatById(formattedGroupId);

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Group not found. Please check the Group ID.'
            });
        }

        if (!chat.isGroup) {
            return res.status(400).json({
                success: false,
                message: 'This is not a group chat. Please provide a valid group ID.'
            });
        }

        console.log(`✓ Found group: ${chat.name} with ${chat.participants.length} members`);

        // Extract members with proper name resolution
        const members = [];
        for (const p of chat.participants) {
            try {
                let contactName = p.id.user; // Default to phone number

                // Try to get the contact's actual name
                try {
                    const contact = await whatsappClient.getContactById(p.id._serialized);
                    if (contact) {
                        // Priority: pushname > name > verifiedName > number
                        contactName = contact.pushname || contact.name || contact.verifiedName || contact.number || p.id.user;
                    }
                } catch (contactError) {
                    console.warn(`⚠️ Could not fetch contact details for ${p.id.user}:`, contactError.message);
                }

                members.push({
                    phone: p.id.user,
                    name: contactName,
                    isAdmin: p.isAdmin || false
                });
            } catch (err) {
                console.warn('⚠️ Error parsing participant:', err);
            }
        }

        console.log(`✅ Successfully extracted ${members.length} members from ${chat.name}`);

        res.json({
            success: true,
            groupName: chat.name,
            groupId: formattedGroupId,
            members: members,
            total: members.length
        });
    } catch (error) {
        console.error('❌ Error extracting group members:', error);

        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes('chat not found')) {
            errorMessage = 'Group not found. Make sure the Group ID is correct and you are a member of this group.';
        } else if (error.message.includes('not authorized')) {
            errorMessage = 'Not authorized to access this group. Make sure you are a member.';
        }

        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message
        });
    }
});

// WhatsApp status for bulk sender
app.get('/api/bulk/whatsapp/status', (req, res) => {
    res.json({
        success: true,
        connected: isClientReady,
        ready: isClientReady,
        hasQRCode: false,
        message: isClientReady ? 'WhatsApp connected' : 'WhatsApp not connected'
    });
});

// Get QR code for bulk sender
app.get('/api/bulk/whatsapp/qr', (req, res) => {
    res.json({
        success: false,
        message: 'QR code not available. Please connect WhatsApp from main dashboard.'
    });
});

// Get DND settings
app.get('/api/bulk/settings/dnd', (req, res) => {
    res.json({
        success: true,
        settings: bulkDNDSettings
    });
});

// Save DND settings
app.post('/api/bulk/settings/dnd', (req, res) => {
    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) {
        return res.status(400).json({
            success: false,
            message: 'Start time and end time are required'
        });
    }
    bulkDNDSettings = { startTime, endTime };
    res.json({
        success: true,
        message: 'DND settings saved',
        settings: bulkDNDSettings
    });
});

// ===== END BULK SENDER API ROUTES =====

// ===== SOCKET.IO CONNECTION =====
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Send current status immediately
    socket.emit('whatsapp:status', {
        connected: isClientReady,
        info: clientInfo,
        timestamp: new Date().toISOString()
    });

    // Send AI agent status immediately
    socket.emit('ai-agent:status', {
        enabled: aiAgentEnabled
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });

    // Handle manual reconnect request
    socket.on('whatsapp:reconnect', () => {
        console.log('🔄 Manual reconnect requested');

        // Prevent reconnect if already initializing
        if (isInitializing) {
            console.log('⚠️ Already initializing, ignoring reconnect request');
            socket.emit('whatsapp:error', {
                error: 'Client is already initializing',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Reset reconnect attempts for manual reconnect
        reconnectAttempts = 0;

        if (whatsappClient) {
            console.log('🗑️ Destroying existing client before reconnect...');
            whatsappClient.destroy()
                .then(() => {
                    whatsappClient = null;
                    isClientReady = false;
                    console.log('✓ Client destroyed, initializing new client...');
                    initializeWhatsAppClient();
                })
                .catch(err => {
                    console.error('⚠️ Error destroying client:', err.message);
                    whatsappClient = null;
                    isClientReady = false;
                    initializeWhatsAppClient();
                });
        } else {
            console.log('🔄 No existing client, initializing new one...');
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

const PORT = process.env.PORT || 3000;

// ===== START SERVER =====
server.listen(PORT, async () => {
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

    // Load AI Agent status from database
    try {
        console.log('📡 Loading AI Agent status from database...');
        const { data, error } = await supabase
            .from('business_config')
            .select('is_active')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('⚠️ Error loading AI agent status:', error.message);
            console.log('💡 Tip: Run add_agent_status_column.sql to add the is_active column');
            aiAgentEnabled = false;
        } else if (data && typeof data.is_active === 'boolean') {
            aiAgentEnabled = data.is_active;
            console.log(`✓ AI Agent status loaded: ${aiAgentEnabled ? 'ENABLED' : 'DISABLED'}`);
        } else {
            console.log('⚠️ No AI agent status found in database, defaulting to DISABLED');
            aiAgentEnabled = false;
        }
    } catch (error) {
        console.error('❌ Exception loading AI agent status:', error.message);
        aiAgentEnabled = false;
    }

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

    // Graceful Shutdown: Ensure browser closes
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down WhatsApp...');
        if (whatsappClient) {
            try {
                await whatsappClient.destroy();
                console.log('✅ WhatsApp client closed');
            } catch (err) {
                console.error('❌ Error closing WhatsApp client:', err);
            }
        }
        process.exit(0);
    });

    // Handle termination
    process.on('SIGTERM', async () => {
        console.log('\n\n👋 Shutting down WhatsApp...');
        if (whatsappClient) {
            try {
                await whatsappClient.destroy();
                console.log('✅ WhatsApp client closed');
            } catch (err) {
                console.error('❌ Error closing WhatsApp client:', err);
            }
        }
        process.exit(0);
    });

// Export for use in other modules
module.exports = {
    getWhatsAppClient,
    isWhatsAppReady,
    app,
    io
};
