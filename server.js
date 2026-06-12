// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const ExcelJS = require('exceljs');
const ws = require('ws'); // Required for Supabase realtime on Node.js < 22

// Security packages
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Baileys imports
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

// Import API routes
const campaignRoutes = require('./backend/routes/campaigns');

// Import bulk sender service
const { getInstance: getBulkSenderService } = require('./backend/services/bulkSenderService');

const app = express();

// ===== TRUST PROXY FOR HUGGING FACE SPACES =====
// Critical: HF Spaces runs behind a reverse proxy
// Without this, express-rate-limit throws ValidationError on first request
app.set('trust proxy', 1); // Trust 1 proxy hop (HF's proxy)

const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const activeLoops = require('./backend/utils/activeLoops');

// ===== SAFE JID WRAPPER FOR BAILEYS onWhatsApp() =====
/**
 * Safely normalizes and validates a JID before passing to Baileys onWhatsApp()
 * This prevents TypeError: jid?.endsWith is not a function
 *
 * @param {string} rawJid - Raw JID string (e.g., "923001234567@s.whatsapp.net")
 * @returns {string} - Normalized JID guaranteed to be a valid string
 * @throws {Error} - If JID cannot be normalized or is invalid
 */
function safeNormalizeJid(rawJid) {
    // Step 1: Validate input is a string
    if (typeof rawJid !== 'string') {
        throw new Error(`JID must be a string, got ${typeof rawJid}`);
    }

    // Step 2: Validate not empty
    if (!rawJid || rawJid.trim() === '') {
        throw new Error('JID cannot be empty');
    }

    // Step 2.5: Handle bare phone numbers (add @s.whatsapp.net if missing)
    let jidToNormalize = rawJid.trim();
    if (!jidToNormalize.includes('@')) {
        jidToNormalize = jidToNormalize + '@s.whatsapp.net';
    }

    // Step 3: Use Baileys' jidNormalizedUser to normalize the JID
    let normalizedJid;
    try {
        normalizedJid = jidNormalizedUser(jidToNormalize);
    } catch (normalizeError) {
        throw new Error(`JID normalization failed: ${normalizeError.message}`);
    }

    // Step 4: Validate normalized output is a string
    if (typeof normalizedJid !== 'string') {
        throw new Error(`Normalized JID is not a string (got ${typeof normalizedJid}), original: ${rawJid}`);
    }

    // Step 5: Validate normalized JID is not empty
    if (!normalizedJid || normalizedJid.trim() === '') {
        throw new Error(`Normalized JID is empty, original: ${rawJid}`);
    }

    // Step 6: Validate JID format (should contain @)
    if (!normalizedJid.includes('@')) {
        throw new Error(`Normalized JID has invalid format (missing @): ${normalizedJid}`);
    }

    console.log(`   ✅ JID normalized: "${rawJid}" → "${normalizedJid}"`);
    return normalizedJid;
}

// ===== TEST PROBE: Verify safeNormalizeJid works correctly =====
function testJidNormalization() {
    console.log('\n🧪 TESTING JID NORMALIZATION WRAPPER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const testCases = [
        { input: '923001234567@s.whatsapp.net', expected: 'success' },
        { input: '923001234567', expected: 'success' }, // Should normalize to include @s.whatsapp.net
        { input: '', expected: 'fail' },
        { input: null, expected: 'fail' },
        { input: undefined, expected: 'fail' },
        { input: 123456, expected: 'fail' },
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach((testCase, index) => {
        try {
            const result = safeNormalizeJid(testCase.input);
            if (testCase.expected === 'success') {
                console.log(`✅ Test ${index + 1} PASS: "${testCase.input}" → "${result}"`);
                passed++;
            } else {
                console.error(`❌ Test ${index + 1} FAIL: Expected error but got "${result}"`);
                failed++;
            }
        } catch (error) {
            if (testCase.expected === 'fail') {
                console.log(`✅ Test ${index + 1} PASS: Correctly threw error for "${testCase.input}"`);
                passed++;
            } else {
                console.error(`❌ Test ${index + 1} FAIL: Unexpected error: ${error.message}`);
                failed++;
            }
        }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🧪 TEST RESULTS: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        console.error('❌ TEST PROBE FAILED - JID normalization wrapper has issues!');
        return false;
    } else {
        console.log('✅ TEST PROBE PASSED - JID normalization wrapper is working correctly!\n');
        return true;
    }
}

// Run test probe on server startup
console.log('\n🔍 Running JID normalization test probe...');
const testResult = testJidNormalization();
if (!testResult) {
    console.error('⚠️  WARNING: JID normalization tests failed. Check safeNormalizeJid implementation.');
    console.error('⚠️  Server will continue but validation may have issues.\n');
} else {
    console.log('✅ JID normalization verified and ready.\n');
}

// ===== SUPABASE CLIENT =====
// Load from environment variables with FALLBACK for initial deployment
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';

// Warn if using fallback values
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn('⚠️  WARNING: Using default Supabase credentials (not secure for production!)');
    console.warn('   For production: Add SUPABASE_URL and SUPABASE_ANON_KEY as environment secrets');
    console.warn('   Hugging Face: Go to Space Settings → Repository secrets');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
        transport: ws // Required for Node.js < 22 (Hugging Face uses Node 20)
    }
});
console.log('✓ Supabase client initialized');
console.log(`   URL: ${SUPABASE_URL.substring(0, 30)}...`);

// ===== MULTI-USER WHATSAPP CLIENTS =====
// Each user gets their own isolated WhatsApp client
const whatsappClients = new Map(); // userId -> { client, isReady, clientInfo, isInitializing, reconnectAttempts, lastQRCode }
const MAX_RECONNECT_ATTEMPTS = 8; // Increased from 3 to 8 for better resilience

// ===== USER-SPECIFIC STATISTICS TRACKING =====
const userStats = new Map(); // userId -> stats object

// ===== USER-SPECIFIC MESSAGE HISTORY =====
const userMessageHistory = new Map(); // userId -> message array (for dashboard display)
const MAX_HISTORY = 100;

// ===== USER-SPECIFIC CONTACT MAPPING (FOR LID RESOLUTION) =====
const userContactMapping = new Map(); // userId -> Map(lid -> {phone, name, jid})

// ===== PERSISTENT CONTACT CACHE FILE =====
const CONTACT_CACHE_FILE = path.join(__dirname, 'contacts_cache.json');

// Load contact cache from file on startup
function loadContactCache() {
    try {
        if (fs.existsSync(CONTACT_CACHE_FILE)) {
            const rawData = fs.readFileSync(CONTACT_CACHE_FILE, 'utf8');
            const cacheData = JSON.parse(rawData);

            // Restore into userContactMapping
            for (const [userId, mappings] of Object.entries(cacheData)) {
                const userMap = new Map();
                for (const [jid, contactData] of Object.entries(mappings)) {
                    userMap.set(jid, contactData);
                }
                userContactMapping.set(userId, userMap);
            }

            console.log(`✓ Loaded contact cache from disk: ${Object.keys(cacheData).length} user(s)`);

            // Clean poisoned entries
            cleanPoisonedCache();
        } else {
            console.log(`⚠️ No contact cache file found - starting fresh`);
        }
    } catch (error) {
        console.error(`❌ Error loading contact cache:`, error.message);
    }
}

// Clean poisoned cache entries (where phone = LID digits)
function cleanPoisonedCache() {
    try {
        let cleanedCount = 0;

        for (const [userId, mapping] of userContactMapping.entries()) {
            const entriesToRemove = [];

            for (const [jid, contactData] of mapping.entries()) {
                const jidDigits = jid.split('@')[0].replace(/\D/g, '');
                const phone = contactData.phone;

                // Check if this is a poisoned entry:
                // 1. JID contains @lid
                // 2. Phone number is identical to LID digits
                // 3. Phone is longer than 15 digits (typical LID length)
                if (jid.includes('@lid') && phone === jidDigits && phone.length > 15) {
                    entriesToRemove.push(jid);
                    console.log(`   🧹 Removing poisoned entry: ${jid} -> ${phone} (phone = LID digits)`);
                    cleanedCount++;
                }

                // ADDITIONAL CHECK: Remove any entry where phone looks like a LID (super long number > 15 digits)
                // Even if JID doesn't explicitly have @lid, if phone is abnormally long, it's likely corrupted
                if (phone && phone.length > 15 && /^\d+$/.test(phone)) {
                    entriesToRemove.push(jid);
                    console.log(`   🧹 Removing abnormally long phone entry: ${jid} -> ${phone} (${phone.length} digits)`);
                    cleanedCount++;
                }
            }

            // Remove poisoned entries
            for (const jid of entriesToRemove) {
                mapping.delete(jid);
            }
        }

        if (cleanedCount > 0) {
            console.log(`✓ Cleaned ${cleanedCount} poisoned cache entries`);
            // Save cleaned cache back to disk
            saveContactCacheToDisk();
        } else {
            console.log(`✓ Cache is clean (no poisoned entries found)`);
        }
    } catch (error) {
        console.error(`❌ Error cleaning poisoned cache:`, error.message);
    }
}

// Save contact cache to file (persistent storage)
function saveContactCacheToDisk() {
    try {
        const cacheData = {};

        // Convert Map to plain object for JSON serialization
        for (const [userId, mappings] of userContactMapping.entries()) {
            cacheData[userId] = {};
            for (const [jid, contactData] of mappings.entries()) {
                cacheData[userId][jid] = contactData;
            }
        }

        fs.writeFileSync(CONTACT_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
        console.log(`💾 Contact cache saved to disk: ${Object.keys(cacheData).length} user(s)`);
    } catch (error) {
        console.error(`❌ Error saving contact cache:`, error.message);
    }
}

// ===== PER-CUSTOMER CONVERSATION HISTORY (for AI context) =====
const conversationHistory = new Map(); // userId_phoneNumber -> { messages: [], lastActive: timestamp }
const MAX_CONVERSATION_MESSAGES = 10; // Keep last 10 messages per conversation
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes - reset conversation after inactivity

// ===== USER-SPECIFIC DEALS TRACKING =====
const userDeals = new Map(); // userId -> deals array

// Helper functions for user data management
function getUserData(userId) {
    if (!whatsappClients.has(userId)) {
        whatsappClients.set(userId, {
            client: null,
            isReady: false,
            clientInfo: null,
            isInitializing: false,
            reconnectAttempts: 0,
            lastQRCode: null  // Cache last QR code for immediate re-emission
        });
    }
    return whatsappClients.get(userId);
}

function getUserStats(userId) {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            totalMessages: 0,
            messagesReceived: 0,
            messagesSent: 0,
            dealsLocked: 0,
            numbersValidated: 0,
            activeCampaigns: 0
        });
    }
    return userStats.get(userId);
}

function getUserMessages(userId) {
    if (!userMessageHistory.has(userId)) {
        userMessageHistory.set(userId, []);
    }
    return userMessageHistory.get(userId);
}

function getUserContactMapping(userId) {
    if (!userContactMapping.has(userId)) {
        userContactMapping.set(userId, new Map());
    }
    return userContactMapping.get(userId);
}

// Helper function to save contact mapping (LID -> Real Phone/Name)
function saveContactMapping(userId, contact) {
    try {
        const mapping = getUserContactMapping(userId);
        let saved = false;

        // Extract JID (could be @lid or @s.whatsapp.net)
        const jid = contact.id || contact.jid;
        if (!jid) return;

        // Extract the numeric part from the JID
        const jidDigits = jid.split('@')[0].replace(/\D/g, '');

        // Extract phone number from JID
        let phone = null;
        let realJid = null;

        // Check if contact has a linked phone number (this is the key for LID resolution)
        if (contact.lid && contact.id) {
            // This contact has a LID, and Baileys gives us the mapping
            const lidJid = contact.lid;
            const lidDigits = lidJid.split('@')[0].replace(/\D/g, '');
            const realJidValue = contact.id;

            // Extract phone from the real JID
            if (realJidValue.includes('@s.whatsapp.net') || realJidValue.includes('@c.us')) {
                phone = realJidValue.split('@')[0].replace(/\D/g, '');
                realJid = realJidValue;

                // CRITICAL VALIDATION: Only save if phone is different from LID digits
                // and is a reasonable phone number length (7-15 digits)
                if (phone !== lidDigits && phone.length >= 7 && phone.length <= 15) {
                    // Store mapping: LID -> Real Phone
                    mapping.set(lidJid, {
                        phone: phone,
                        name: contact.notify || contact.verifiedName || contact.name || 'Customer',
                        realJid: realJid,
                        lastUpdated: Date.now()
                    });

                    console.log(`✓ Contact mapping saved: ${lidJid} -> ${phone} (${contact.notify || 'No name'})`);
                    saved = true;
                } else {
                    console.log(`⚠️ Skipped invalid mapping: LID ${lidDigits} -> phone ${phone} (same or invalid)`);
                }
            }
        }

        // Also store the contact by its main JID (for both @lid and @s.whatsapp.net)
        if (jid) {
            const phoneFromJid = jid.split('@')[0].replace(/\D/g, '');
            const isLid = jid.includes('@lid');

            // Only save non-LID JIDs or short LID numbers (< 15 digits)
            if (!isLid || phoneFromJid.length < 15) {
                // For non-LID, use the JID phone; for LID, use the resolved phone if we have it
                const finalPhone = realJid ? phone : phoneFromJid;

                // Validate: Don't save if phone looks like LID digits
                if (finalPhone && finalPhone.length >= 7 && finalPhone.length <= 15) {
                    mapping.set(jid, {
                        phone: finalPhone,
                        name: contact.notify || contact.verifiedName || contact.name || 'Customer',
                        realJid: realJid || jid,
                        lastUpdated: Date.now()
                    });
                    saved = true;
                }
            }
        }

        // CRITICAL: Save to disk immediately after updating memory
        if (saved) {
            saveContactCacheToDisk();
        }

    } catch (error) {
        console.error(`❌ Error saving contact mapping:`, error.message);
    }
}

// Helper functions for per-customer conversation history
function getConversationKey(userId, phoneNumber) {
    // Create unique key for each customer conversation
    return `${userId}_${phoneNumber}`;
}

function getConversationHistory(userId, phoneNumber) {
    const key = getConversationKey(userId, phoneNumber);
    const now = Date.now();

    if (!conversationHistory.has(key)) {
        conversationHistory.set(key, {
            messages: [],
            lastActive: now
        });
        return conversationHistory.get(key);
    }

    const conversation = conversationHistory.get(key);

    // Reset conversation if timeout exceeded
    if (now - conversation.lastActive > CONVERSATION_TIMEOUT) {
        console.log(`🔄 Resetting conversation for ${phoneNumber} (timeout exceeded)`);
        conversation.messages = [];
    }

    conversation.lastActive = now;
    return conversation;
}

function addToConversationHistory(userId, phoneNumber, role, content) {
    const conversation = getConversationHistory(userId, phoneNumber);

    // Add message to conversation
    conversation.messages.push({ role, content });

    // Keep only last N messages (sliding window)
    if (conversation.messages.length > MAX_CONVERSATION_MESSAGES) {
        conversation.messages.shift();
    }
}

function clearConversationHistory(userId, phoneNumber) {
    const key = getConversationKey(userId, phoneNumber);
    if (conversationHistory.has(key)) {
        conversationHistory.delete(key);
        console.log(`🗑️ Cleared conversation history for ${phoneNumber}`);
        return true;
    }
    return false;
}

// Clean AI response - remove system artifacts
function cleanAIResponse(response) {
    if (!response) return '';

    let cleaned = response.trim();

    // Remove common prefixes that AI might add
    const prefixesToRemove = [
        /^Assistant:\s*/i,
        /^AI:\s*/i,
        /^Bot:\s*/i,
        /^Response:\s*/i,
        /^\[.*?\]:\s*/,  // Remove [anything]: prefix
    ];

    for (const prefix of prefixesToRemove) {
        cleaned = cleaned.replace(prefix, '');
    }

    // Remove any leaked system instructions (common patterns)
    const systemLeakPatterns = [
        /You are a .* assistant\.?/gi,
        /CRITICAL RULES:.*$/gis,
        /\*\*IMPORTANT:\*\*.*$/gis,
        /━━━━━━━+/g,  // Remove separator lines
    ];

    for (const pattern of systemLeakPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    return cleaned;
}

function getUserDeals(userId) {
    if (!userDeals.has(userId)) {
        userDeals.set(userId, []);
    }
    return userDeals.get(userId);
}

// ===== AI AGENT CONFIGURATION =====
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// AI Agent enabled state
let aiAgentEnabled = false;

// Keywords for deal detection - REMOVED (legacy detection removed, only explicit buying intent triggers deals)
// const DEAL_KEYWORDS = ['price', 'cost', 'buy', 'purchase', 'interested', 'quote', 'order', 'deal', 'package', 'service'];

// ===== MIDDLEWARE =====

// Helmet - Additional security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now (would need custom config for Socket.IO)
    crossOriginEmbedderPolicy: false // Allow external resources
}));

// Security Headers Middleware (Custom)
app.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS protection in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Enforce HTTPS in production (max-age: 1 year)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
});

// ===== RATE LIMITING =====

// General API rate limiter (100 requests per minute per IP)
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    // Fix for HF Spaces: Disable X-Forwarded-For validation error
    validate: {
        xForwardedForHeader: false,
    },
});

// Strict rate limiter for authentication endpoints (5 requests per minute)
const authLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Fix for HF Spaces: Disable X-Forwarded-For validation error
    validate: {
        xForwardedForHeader: false,
    },
});

// Apply rate limiters
app.use('/api/', apiLimiter); // Apply to all API routes
app.use('/api/auth/', authLimiter); // Stricter limit for auth routes

console.log('✓ Rate limiting enabled (API: 100/min, Auth: 5/min)');

// ===== INPUT VALIDATION & SANITIZATION =====

// Sanitization helper functions
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    // Remove potential XSS vectors
    return str
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
        .trim();
};

const sanitizeNumber = (num) => {
    const parsed = parseFloat(num);
    return isNaN(parsed) ? 0 : parsed;
};

const sanitizePhone = (phone) => {
    if (!phone) return '';
    // Only allow digits, +, and whitespace
    return String(phone).replace(/[^\d+\s]/g, '').trim();
};

// Validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

console.log('✓ Security headers and rate limiting middleware enabled');

app.use(express.json());
app.use(express.static(__dirname));

// ===== SUPPRESS CHROME DEVTOOLS 404 ERROR =====
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.status(204).send(); // No Content - suppresses Chrome DevTools error
});

// ===== HEALTH CHECK ENDPOINT FOR HUGGING FACE =====
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
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

// ===== WHATSAPP CLIENT INITIALIZATION (BAILEYS) =====
async function initializeWhatsAppClient(userId) {
    if (!userId) {
        console.error('❌ Cannot initialize WhatsApp client without userId');
        return;
    }

    const userData = getUserData(userId);

    // Prevent multiple simultaneous initializations
    if (userData.isInitializing) {
        console.log(`⚠️ Client for user ${userId} is already initializing, skipping...`);
        return;
    }

    if (userData.client && userData.isReady) {
        console.log(`⚠️ Client for user ${userId} is already ready, skipping initialization...`);
        return;
    }

    userData.isInitializing = true;
    console.log(`🔄 Initializing Baileys WhatsApp client for user: ${userId}`);

    // User-specific session path (Baileys uses multi-file auth)
    const sessionPath = path.join(__dirname, '.baileys_auth', userId);

    // Create session directory if it doesn't exist
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
        console.log(`📁 Created session folder for user ${userId}`);
    }

    try {
        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // Get latest Baileys version
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📱 Using WhatsApp Web v${version.join('.')}`);

        // Create socket
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }), // Disable logs
            browser: ['WhatsApp Toolkit', 'Chrome', '122.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true
        });

        userData.client = sock;
        userData.isInitializing = false;

        // ===== EVENT: Connection Update =====
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR Code
            if (qr) {
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`📱 QR CODE GENERATED FOR USER: ${userId}`);
                console.log(`   Timestamp: ${new Date().toISOString()}`);

                try {
                    const qrDataUrl = await qrcode.toDataURL(qr);
                    console.log(`✓ QR converted to Data URL (length: ${qrDataUrl.length})`);

                    // Cache QR code
                    userData.lastQRCode = {
                        qr: qrDataUrl,
                        timestamp: new Date().toISOString()
                    };

                    // Emit to user's room
                    console.log(`📡 EMITTING whatsapp:qr TO ROOM: ${userId}`);
                    io.to(userId).emit('whatsapp:qr', {
                        qr: qrDataUrl,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`✅ QR Code successfully emitted to user ${userId}`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                } catch (error) {
                    console.error(`❌ Error generating QR code for user ${userId}:`, error.message);
                    io.to(userId).emit('whatsapp:error', {
                        error: 'Failed to generate QR code: ' + error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Handle connection state
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                    : true;

                console.log(`🔌 Connection closed for user ${userId}. Reconnect:`, shouldReconnect);

                userData.isReady = false;
                userData.clientInfo = null;

                io.to(userId).emit('whatsapp:disconnected', {
                    reason: lastDisconnect?.error?.message || 'Unknown',
                    timestamp: new Date().toISOString()
                });

                if (shouldReconnect && userData.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    userData.reconnectAttempts++;
                    console.log(`⏳ Attempting reconnect for user ${userId} (${userData.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in 10 seconds...`);

                    setTimeout(() => {
                        console.log(`🔄 Re-initializing client for user ${userId} after disconnect...`);
                        initializeWhatsAppClient(userId);
                    }, 10000);
                } else if (!shouldReconnect) {
                    console.log(`🚪 User ${userId} logged out. Cleaning session...`);
                    userData.client = null;
                }
            } else if (connection === 'open') {
                console.log(`✅ WhatsApp client is CONNECTED for user ${userId}!`);
                userData.isReady = true;
                userData.reconnectAttempts = 0;

                try {
                    // Get client info
                    const info = sock.user;
                    userData.clientInfo = {
                        name: info.name || 'User',
                        number: info.id.split(':')[0],
                        platform: 'baileys',
                        profilePicUrl: null
                    };

                    console.log(`📋 Client info for user ${userId}:`, {
                        name: userData.clientInfo.name,
                        number: userData.clientInfo.number
                    });

                    // Try to get profile picture
                    try {
                        const ppUrl = await sock.profilePictureUrl(info.id, 'image');
                        userData.clientInfo.profilePicUrl = ppUrl;
                        console.log('✅ Profile picture URL obtained');
                    } catch (ppError) {
                        console.log('⚠️ Could not fetch profile picture');
                    }

                    // Emit ready status
                    io.to(userId).emit('whatsapp:ready', {
                        status: 'connected',
                        info: userData.clientInfo,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`✓ Client ready event emitted to user ${userId}`);
                } catch (error) {
                    console.error(`❌ Error in ready event for user ${userId}:`, error);
                    io.to(userId).emit('whatsapp:error', {
                        error: 'Failed to get client info: ' + error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });

        // ===== EVENT: Credentials Update =====
        sock.ev.on('creds.update', saveCreds);

        // ===== EVENT: Contacts Upsert (NEW CONTACTS DISCOVERED) =====
        sock.ev.on('contacts.upsert', (contacts) => {
            console.log(`📇 Contacts upsert for user ${userId}: ${contacts.length} contact(s)`);

            for (const contact of contacts) {
                saveContactMapping(userId, contact);
            }
        });

        // ===== EVENT: Contacts Update (EXISTING CONTACTS UPDATED) =====
        sock.ev.on('contacts.update', (contacts) => {
            console.log(`📇 Contacts update for user ${userId}: ${contacts.length} contact(s)`);

            for (const contact of contacts) {
                saveContactMapping(userId, contact);
            }
        });

        // ===== UNIVERSAL PHONE NUMBER EXTRACTOR (GROUP EXTRACTOR STYLE) =====
        function extractPhoneFromMessage(msg, fromJid) {
            // Try ALL possible fields where Baileys might store the real phone number
            const candidateFields = [
                msg.key?.participant,           // Group messages or forwarded
                msg.participant,                // Direct participant field
                msg.key?.remoteJidAlt,          // Alternative JID (documented in some Baileys versions)
                msg.senderPn,                   // Sender phone number field
                msg.key?.senderPn,              // Sender PN in key
                msg.message?.extendedTextMessage?.contextInfo?.participant, // Reply context
                msg.message?.extendedTextMessage?.contextInfo?.remoteJid,   // Message context
                fromJid                         // Final fallback to remoteJid
            ];

            for (const field of candidateFields) {
                if (!field) continue;

                // Clean the field: strip @s.whatsapp.net, @c.us, @lid, @g.us
                const cleaned = String(field).split('@')[0].replace(/\D/g, '');

                // Validate: Must be 7-15 digits (valid international phone number)
                if (cleaned.length >= 7 && cleaned.length <= 15) {
                    console.log(`   ✅ Extracted real phone from field: ${cleaned} (source: ${field})`);
                    return cleaned;
                }
            }

            // If all fields failed, return null (will trigger fallback)
            console.log(`   ⚠️ No valid phone found in any field`);
            return null;
        }

        // ===== ROBUST CONTACT RESOLVER WITH UNIVERSAL EXTRACTION =====
        async function resolveContactInfo(userId, fromJid, msg = null) {
            try {
                console.log(`🔍 Resolving contact from JID: ${fromJid}`);

                let resolvedName = 'Customer';
                let resolvedPhone = null;
                let found = false;
                const isLidJid = fromJid.includes('@lid');

                // STEP 1: Check msg.pushName FIRST (most reliable for direct chats)
                if (msg?.pushName && msg.pushName.trim()) {
                    resolvedName = msg.pushName.trim();
                    console.log(`   ✅ Name from msg.pushName: ${resolvedName}`);
                }

                // STEP 2: UNIVERSAL PHONE EXTRACTION - Try ALL possible fields
                if (msg) {
                    const extractedPhone = extractPhoneFromMessage(msg, fromJid);
                    if (extractedPhone) {
                        resolvedPhone = extractedPhone;
                        found = true;
                        console.log(`   ✅ Universal extraction successful: ${resolvedPhone}`);
                    }
                }

                // STEP 3: Check our contact mapping cache (fast path)
                if (!found) {
                    const mapping = getUserContactMapping(userId);
                    if (mapping.has(fromJid)) {
                        const contactData = mapping.get(fromJid);
                        const cachedPhone = contactData.phone;

                        // CRITICAL VALIDATION: Check if cached phone is actually just the LID digits (poisoned entry)
                        const jidDigits = fromJid.split('@')[0].replace(/\D/g, '');
                        const isPoisoned = isLidJid && cachedPhone === jidDigits && cachedPhone.length > 15;

                        if (isPoisoned) {
                            // POISONED CACHE DETECTED - Delete immediately and force refresh
                            console.log(`   ⚠️ POISONED CACHE DETECTED: ${fromJid} -> ${cachedPhone} (phone = LID digits)`);
                            console.log(`   🧹 Deleting poisoned entry and forcing onWhatsApp() lookup...`);
                            mapping.delete(fromJid);
                            saveContactCacheToDisk();
                            // DO NOT set found = true, let it fall through to onWhatsApp()
                        } else {
                            // Cache entry is valid
                            resolvedPhone = cachedPhone;
                            if (contactData.name && contactData.name !== 'Customer') {
                                resolvedName = contactData.name;
                            }
                            found = true;
                            console.log(`   ✅ Found in contact mapping cache: ${resolvedName} | ${resolvedPhone}`);
                        }
                    }
                }

                // STEP 4: For non-LID JIDs, extract phone directly
                if (!found && !isLidJid) {
                    const directPhone = fromJid.split('@')[0].replace(/\D/g, '');
                    if (directPhone.length >= 7 && directPhone.length <= 15) {
                        resolvedPhone = directPhone;
                        found = true;
                        console.log(`   ✓ Phone extracted from non-LID JID: ${resolvedPhone}`);
                    }
                }

                // STEP 5: FALLBACK FOR UNRESOLVABLE LIDs - USE PUSHNAME + TAG
                // CRITICAL: Do NOT block messages - always return a usable identifier
                if (!found && isLidJid) {
                    // Create a unique identifier using pushName
                    const safeName = resolvedName.replace(/[^a-zA-Z0-9]/g, '_');
                    const lidDigits = fromJid.split('@')[0].replace(/\D/g, '');
                    const shortLid = lidDigits.substring(lidDigits.length - 8); // Last 8 digits for uniqueness

                    resolvedPhone = `${safeName}_LID_${shortLid}`;
                    found = true;
                    console.log(`   ⚠️ LID FALLBACK: Using tagged identifier: ${resolvedPhone}`);
                    console.log(`   → Message will be processed normally with this identifier`);
                }

                // Final validation
                if (!resolvedPhone) {
                    // Absolute fallback - should rarely happen now
                    const timestamp = Date.now().toString().substring(0, 10);
                    resolvedPhone = `Unknown_${timestamp}`;
                    console.log(`⚠️ EMERGENCY FALLBACK → Using: ${resolvedPhone}`);
                }

                console.log(`✅ RESOLVED → Name: "${resolvedName}", Phone: "${resolvedPhone}"`);

                return { name: resolvedName, phone: resolvedPhone };

            } catch (error) {
                console.error(`   ❌ Error in resolveContactInfo: ${error.message}`);

                // Emergency fallback: NEVER return null phone
                const safeName = (msg?.pushName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
                const timestamp = Date.now().toString().substring(0, 10);
                return {
                    name: msg?.pushName || 'Customer',
                    phone: `${safeName}_${timestamp}`
                };
            }
        }

        // ===== EVENT: Messages =====
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                if (!msg.message || msg.key.fromMe) continue;

                try {
                    // Extract message text from Baileys format
                    const messageText = msg.message.conversation ||
                                       msg.message.extendedTextMessage?.text ||
                                       msg.message.imageMessage?.caption ||
                                       '';

                    if (!messageText) continue;

                    // CRITICAL: Define messageTextLower for all downstream checks
                    const messageTextLower = messageText.toLowerCase();

                    const from = msg.key.remoteJid;
                    const timestamp = msg.messageTimestamp;
                    const messageId = msg.key.id;

                    // DEBUG: If this is a LID message, dump the ENTIRE structure to find real phone fields
                    if (from.includes('@lid')) {
                        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('📋 FULL LID MESSAGE STRUCTURE DUMP:');
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('msg.key:', JSON.stringify(msg.key, null, 2));
                        console.log('msg.pushName:', msg.pushName);
                        console.log('msg.verifiedBizName:', msg.verifiedBizName);
                        console.log('msg.participant:', msg.participant);
                        console.log('msg.messageTimestamp:', msg.messageTimestamp);
                        console.log('\nChecking for alternative phone fields:');
                        console.log('  msg.key.remoteJidAlt:', msg.key.remoteJidAlt);
                        console.log('  msg.senderPn:', msg.senderPn);
                        console.log('  msg.key.senderPn:', msg.key.senderPn);
                        console.log('  msg.key.participant:', msg.key.participant);
                        console.log('  msg.key.sender:', msg.key.sender);
                        console.log('\nMessage contextInfo:');
                        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                        if (contextInfo) {
                            console.log('  contextInfo.participant:', contextInfo.participant);
                            console.log('  contextInfo.remoteJid:', contextInfo.remoteJid);
                            console.log('  contextInfo.quotedParticipant:', contextInfo.quotedParticipant);
                        }
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                    }

                    // ===== RESOLVE CONTACT INFO IMMEDIATELY (BEFORE ANY LOGGING) =====
                    const contactInfo = await resolveContactInfo(userId, from, msg);
                    const resolvedName = contactInfo.name;
                    const resolvedPhone = contactInfo.phone;

                    // ===== LOG WITH RESOLVED INFO (NOT RAW JID) =====
                    // NOTE: resolvedPhone is now ALWAYS set (fallback to tagged identifier if needed)
                    console.log(`📨 ← ${resolvedName} (${resolvedPhone}): ${messageText.substring(0, 50)}`);

                    // Update user-specific statistics
                    const stats = getUserStats(userId);
                    stats.totalMessages++;
                    stats.messagesReceived++;

                    // Add to user-specific message history (use resolved phone)
                    const messageData = {
                        id: messageId,
                        from: resolvedPhone,           // FORCED: Use resolved phone, not raw JID
                        fromName: resolvedName,         // FORCED: Use resolved name
                        fromJid: from,                  // Keep original JID for reference
                        body: messageText,
                        timestamp: timestamp,
                        type: 'received',
                        isGroup: from.includes('@g.us')
                    };

                    const userMessages = getUserMessages(userId);
                    userMessages.unshift(messageData);
                    if (userMessages.length > MAX_HISTORY) {
                        userMessages.pop();
                    }

                    // Emit to this user only - GUARANTEED clean data
                    console.log(`📤 Emitting message to dashboard: from=${resolvedPhone}, name=${resolvedName}`);
                    io.to(userId).emit('message:received', messageData);
                    io.to(userId).emit('stats:update', stats);

                    // Skip group messages, newsletters, and broadcasts for AI agent
                    // NOTE: We DO respond to @lid (linked devices like WhatsApp Web) because those are real users
                    if (from.includes('@g.us') || from.includes('@newsletter') || from.includes('@broadcast')) {
                        console.log('⏭️ Skipping group message, newsletter, or broadcast');
                        continue;
                    }

                    // Check if AI agent is enabled
                    if (!aiAgentEnabled) {
                        console.log('🤖 AI Agent is disabled');
                        continue;
                    }

                    // REMOVED LEGACY DEAL DETECTION - Only explicit buying intent triggers deals (see below after AI response)

                    // ===== CHECK FOR PHOTO REQUESTS =====
                    const photoKeywords = ['pic', 'pix', 'photo', 'image', 'dikhao', 'dikha', 'dekh'];
                    const isPhotoRequest = photoKeywords.some(keyword => messageTextLower.includes(keyword));

                    if (isPhotoRequest) {
                        console.log('📸 Photo request detected');

                        try {
                            let productTag = null;

                            // Get all available tags from database (user-specific)
                            const { data: allMedia, error: mediaError } = await supabase
                                .from('product_media')
                                .select('product_tag')
                                .eq('user_id', userId);

                            if (!mediaError && allMedia && allMedia.length > 0) {
                                const uniqueTags = [...new Set(allMedia.map(m => m.product_tag.toLowerCase()))];

                                // Check if message contains any product tag
                                for (const tag of uniqueTags) {
                                    if (messageTextLower.includes(tag.toLowerCase())) {
                                        productTag = tag;
                                        console.log(`✓ Detected product tag: ${productTag}`);
                                        break;
                                    }
                                }
                            }

                            // Fetch images based on filter (user-specific)
                            let query = supabase
                                .from('product_media')
                                .select('*')
                                .eq('user_id', userId)
                                .order('created_at', { ascending: false });

                            if (productTag) {
                                query = query.ilike('product_tag', productTag);
                            }

                            const { data: mediaItems, error: fetchError } = await query;

                            if (fetchError) {
                                console.error('⚠️ Error fetching media:', fetchError.message);
                            } else if (mediaItems && mediaItems.length > 0) {
                                console.log(`📤 Found ${mediaItems.length} images to send`);

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

                                imagesToSend = imagesToSend.slice(0, 5);

                                // Send images using Baileys
                                for (const mediaItem of imagesToSend) {
                                    try {
                                        console.log(`📤 Sending image: ${mediaItem.product_tag} - ${mediaItem.image_url}`);

                                        await sock.sendMessage(from, {
                                            image: { url: mediaItem.image_url },
                                            caption: `${mediaItem.product_tag}`
                                        });

                                        stats.messagesSent++;
                                        console.log(`✅ Image sent: ${mediaItem.product_tag}`);

                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                    } catch (sendError) {
                                        console.error(`❌ Error sending image ${mediaItem.product_tag}:`, sendError.message);
                                    }
                                }

                                // Send simple confirmation message (generic for SaaS)
                                const confirmMsg = productTag
                                    ? `Here are the ${productTag} images`
                                    : `Images sent`;

                                await sock.sendMessage(from, { text: confirmMsg });
                                stats.messagesSent++;

                                io.to(userId).emit('stats:update', stats);

                                console.log('✅ Photo request handled successfully');
                                continue;
                            } else {
                                console.log('⚠️ No images found in database');
                            }
                        } catch (photoError) {
                            console.error('❌ Error handling photo request:', photoError.message);
                        }
                    }

                    // ===== AI AGENT PROCESSING =====
                    // Contact already resolved at the top: resolvedName, resolvedPhone

                    // ===== CHECK IF AI SHOULD BE MUTED (ONLY FOR CONFIRMED DEALS) =====
                    console.log('🔍 Checking if deal already exists for this customer...');

                    // EXPANDED BYPASS: Allow informational questions even if deal exists
                    const informationalKeywords = [
                        // Greetings
                        'hi', 'hello', 'hey', 'kase ho', 'kaisay ho', 'kya hal', 'assalam', 'salam',
                        // Questions about business/products
                        'price', 'kitna', 'kya rate', 'cost', 'how much', 'kitne ka', 'rate kya',
                        'available', 'mil sakta', 'hai', 'milega', 'stock', 'colors', 'size',
                        // General inquiries
                        'tell me', 'batao', 'info', 'details', 'kya hai', 'what is'
                    ];
                    const isInformationalQuery = informationalKeywords.some(keyword =>
                        messageText.toLowerCase().includes(keyword)
                    );

                    if (isInformationalQuery) {
                        console.log('💡 Informational query detected - AI will respond even if deal exists');
                    } else {
                        try {
                            const { data: existingDeal, error: dealCheckError } = await supabase
                                .from('deal_tracker')
                                .select('id, status, created_at')
                                .eq('user_id', userId)
                                .eq('customer_phone', resolvedPhone)
                                .in('status', ['new'])
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();

                            if (!dealCheckError && existingDeal) {
                                console.log(`🔇 [AI MUTED] Deal #${existingDeal.id} already tracked for ${resolvedPhone} (status: ${existingDeal.status})`);
                                console.log(`   Human handover required - AI will not respond.`);

                                // Skip AI response entirely - customer needs human attention
                                continue;
                            } else {
                                console.log(`✅ No active deal found - AI can respond`);
                            }
                        } catch (dealCheckDbError) {
                            console.error(`⚠️ Error checking for existing deals: ${dealCheckDbError.message}`);
                            // Continue anyway - don't block AI on database errors
                        }
                    }

                    // ===== AI CAN RESPOND - BUILD PROMPT =====
                    console.log('🤖 Preparing AI response...');

                    // ===== BUILD SYSTEM PROMPT - PAKISTANI SALESMAN =====
                    // LAYER 1: Core identity and safety rules
                    let systemPrompt = `You are a human Pakistani salesman chatting with customers on WhatsApp.

CRITICAL BEHAVIORAL RULES:
1. NEVER use prefixes like "Assistant:", "AI:", "Bot:" - you are human
2. Answer ONLY what is asked - be direct and concise (1-2 sentences max)
3. STRICTLY mirror the customer's language:
   - If they write in Roman Urdu, reply in Roman Urdu
   - If they write in English, reply in English
   - NEVER mix languages in a single response
4. NEVER confirm orders, process payments, or promise delivery - you cannot do these
5. Use ONLY the exact prices from the product list below - no negotiation, no ranges
6. If asked about something not in your products, say you don't have it

ANTI-NONSENSE & TOXIC GUARDRAILS:
- If customer sends gibberish, nonsense ("ulta seedha"), or toxic/abusive messages, respond with ONE brief sentence acknowledging you didn't understand, then STOP responding to further nonsense
- DO NOT argue, lecture, or send long replies to trolls or time-wasters
- Keep conversations professional and product-focused
- If customer is wasting time, politely disengage with a short "Let me know if you need anything" and stop

ANSWER QUESTIONS FREELY:
- Price inquiries ("kitna hai", "how much", "rate kya hai") are normal questions - answer them directly
- Business/product questions should ALWAYS be answered, even for returning customers
- Stay helpful and informative about your products and services

`;

                    // LAYER 2: User's business instructions (from dashboard) - DYNAMIC PER USER
                    try {
                        console.log(`📡 Fetching business instructions for user ${userId}...`);
                        const { data, error } = await supabase
                            .from('business_config')
                            .select('prompt_text, payment_details')
                            .eq('user_id', userId)
                            .limit(1)
                            .maybeSingle();

                        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                            console.error('⚠️ Supabase error fetching business config:', error.message);
                        } else if (data && data.prompt_text) {
                            systemPrompt += `\nYOUR BUSINESS:\n${data.prompt_text}\n`;
                            console.log(`✓ Loaded business instructions for user ${userId}`);

                            // Add payment details ONLY if they exist
                            if (data.payment_details && data.payment_details.trim() !== '') {
                                systemPrompt += `\nPAYMENT DETAILS (only share if customer asks for payment info):\n${data.payment_details}\n`;
                                console.log(`✓ Payment details available for user ${userId}`);
                            }
                        } else {
                            console.warn(`⚠️ No business instructions found for user ${userId}`);
                            systemPrompt += '\nYou are a general salesman. Introduce your products when asked.\n';
                        }
                    } catch (dbError) {
                        console.error('⚠️ Exception fetching business config:', dbError.message);
                    }

                    // LAYER 3: Product list (dynamic from database) - FILTERED BY USER
                    try {
                        console.log(`📡 Fetching products for user ${userId}...`);
                        const { data: products, error: productsError } = await supabase
                            .from('products')
                            .select('item_name, price_pkr')
                            .eq('user_id', userId)
                            .order('item_name', { ascending: true });

                        if (productsError) {
                            console.error('⚠️ Error fetching products:', productsError.message);
                        } else if (products && products.length > 0) {
                            const productsList = products.map(p => {
                                const price = parseFloat(p.price_pkr);
                                return `${p.item_name} = PKR ${price.toFixed(0)}`;
                            }).join('\n');

                            systemPrompt += `\nYOUR PRODUCTS (exact prices, non-negotiable):\n${productsList}\n`;
                            console.log(`✓ Loaded ${products.length} products for user ${userId}`);
                        } else {
                            console.warn(`⚠️ No products found for user ${userId}`);
                            systemPrompt += '\nNo products configured yet.\n';
                        }
                    } catch (productsDbError) {
                        console.error('⚠️ Exception fetching products:', productsDbError.message);
                    }

                    // Get conversation history for this customer (use resolved phone)
                    const conversation = getConversationHistory(userId, resolvedPhone);

                    // Add current user message to conversation history
                    addToConversationHistory(userId, resolvedPhone, 'user', messageText);

                    // Build messages array for GROQ API
                    // System prompt stays separate, conversation history follows
                    const messages = [
                        { role: 'system', content: systemPrompt }
                    ];

                    // Add conversation history (this maintains context)
                    for (const msg of conversation.messages) {
                        messages.push({
                            role: msg.role,
                            content: msg.content
                        });
                    }

                    console.log(`💬 Sending ${conversation.messages.length} messages to GROQ (including current)`);

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
                                messages: messages,
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

                        // Get raw AI response
                        const rawReply = data.choices[0].message.content;

                        // Clean the response (remove system instructions, prefixes, etc.)
                        aiReply = cleanAIResponse(rawReply);

                        console.log('✅ AI response generated and cleaned');

                        // Add AI response to conversation history (use resolved phone)
                        addToConversationHistory(userId, resolvedPhone, 'assistant', aiReply);

                    } catch (apiError) {
                        console.error('❌ GROQ API error:', apiError.message);
                        io.to(userId).emit('error', {
                            type: 'groq_api',
                            error: apiError.message,
                            timestamp: new Date().toISOString()
                        });
                        continue;
                    }

                    // Send AI reply using Baileys
                    try {
                        await sock.sendMessage(from, { text: aiReply });
                        stats.messagesSent++;

                        // Add to message history
                        const replyData = {
                            id: Date.now().toString(),
                            from: 'me',
                            to: from,
                            body: aiReply,
                            timestamp: Date.now(),
                            type: 'sent'
                        };

                        const userMessages = getUserMessages(userId);
                        userMessages.unshift(replyData);
                        if (userMessages.length > MAX_HISTORY) {
                            userMessages.pop();
                        }

                        io.to(userId).emit('message:sent', replyData);
                        io.to(userId).emit('stats:update', stats);

                        console.log('✅ AI reply sent successfully');

                        // ===== DEAL INTENT DETECTION (STRICT BUYING SIGNALS ONLY) =====
                        // ONLY trigger when customer explicitly confirms they want to buy
                        const buyingIntents = [
                            // Explicit confirmations
                            'done', 'confirmed', 'final', 'deal done', 'ok done', 'okay done',
                            // Urdu confirmations
                            'ho gaya', 'hogaya', 'theek', 'thik', 'chalega',
                            // Direct purchase commands
                            'pack kar do', 'pack kardo', 'pack kerdo', 'parcel kar do',
                            'send kar do', 'send kardo', 'bhej do', 'bhejdo',
                            'deliver kar do', 'delivery', 'book kar do', 'book kardo',
                            // Commitment phrases
                            'me lelo ga', 'mai lelo ga', 'lelo ga', 'le lunga', 'le loon ga',
                            'mangwa do', 'mangwao', 'order kar do', 'order kardo',
                            // Payment-related (strong buying signal)
                            'payment karu', 'payment', 'pay kar', 'bill', 'invoice'
                        ];

                        const messageTextLower = messageText.toLowerCase();

                        // Match only if intent is present and message is not a question
                        const isQuestion = messageTextLower.includes('?') ||
                                          messageTextLower.includes('kya') ||
                                          messageTextLower.includes('how') ||
                                          messageTextLower.includes('kitna') ||
                                          messageTextLower.includes('kaise');

                        const intentDetected = buyingIntents.find(intent =>
                            messageTextLower.includes(intent)
                        );

                        if (intentDetected && !isQuestion) {
                            console.log(`💰 DEAL INTENT DETECTED: "${intentDetected}"`);
                            console.log(`   Customer: ${resolvedName} | Phone: ${resolvedPhone}`);
                            console.log(`   Message: "${messageText}"`);

                            // SAFETY CHECK: Never save deals with null phone numbers
                            if (resolvedPhone === null) {
                                console.log(`⛔ DEAL BLOCKED: Cannot save deal with null phone number`);
                                console.log(`   → This is an unresolved LID contact`);
                            } else {
                                // Save to deal_tracker table with RESOLVED contact info
                                try {
                                    const { data: dealData, error: dealError } = await supabase
                                        .from('deal_tracker')
                                        .insert({
                                            user_id: userId,
                                            customer_phone: resolvedPhone,
                                            customer_name: resolvedName,
                                            message_text: messageText,
                                            intent_detected: intentDetected,
                                            status: 'new'
                                        })
                                        .select()
                                        .single();

                                    if (dealError) {
                                        console.error('⚠️ Failed to save deal to database:', dealError.message);
                                    } else {
                                        console.log(`✅ Deal saved to database - ID: ${dealData.id}`);
                                        console.log(`   → AI will be MUTED for non-informational messages from ${resolvedPhone}`);

                                        // Update in-memory stats
                                        stats.dealsLocked++;

                                        // FIXED: Emit deal notification with DATABASE COLUMN NAMES
                                        io.to(userId).emit('deal:new', {
                                            id: dealData.id,
                                            customer_phone: resolvedPhone,     // FIXED: Use database column name
                                            customer_name: resolvedName,       // FIXED: Use database column name
                                            message_text: messageText,         // FIXED: Use database column name
                                            created_at: dealData.created_at,   // FIXED: Use database column name
                                            status: 'new',
                                            intent_detected: intentDetected    // FIXED: Use database column name
                                        });

                                        io.to(userId).emit('stats:update', stats);
                                    }
                                } catch (dealDbError) {
                                    console.error('❌ Exception saving deal:', dealDbError.message);
                                }
                            }
                        } else if (intentDetected && isQuestion) {
                            console.log(`⏭️ Buying keyword detected but message is a question - not treating as deal`);
                            console.log(`   Message: "${messageText}"`);
                        }

                    } catch (sendError) {
                        console.error('❌ Error sending message:', sendError.message);
                        io.to(userId).emit('error', {
                            type: 'send_message',
                            error: sendError.message,
                            timestamp: new Date().toISOString()
                        });
                    }

                } catch (error) {
                    console.error('❌ Critical error in message handler:', error);
                    io.to(userId).emit('error', {
                        type: 'message_handler',
                        error: error.message,
                        stack: error.stack,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });

    } catch (error) {
        console.error(`❌ Failed to initialize Baileys client for user ${userId}:`, error.message);
        userData.isInitializing = false;
        userData.isReady = false;

        // Emit error to user
        io.to(userId).emit('whatsapp:error', {
            error: 'Failed to initialize WhatsApp: ' + error.message,
            timestamp: new Date().toISOString(),
            canRetry: true
        });

        // Attempt reconnect if under max attempts
        if (userData.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            userData.reconnectAttempts++;
            const retryDelay = Math.min(10000 + (userData.reconnectAttempts * 5000), 30000);

            console.log(`⏳ Will retry initialization for user ${userId} (attempt ${userData.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${retryDelay/1000}s...`);

            setTimeout(() => {
                console.log(`🔄 Retrying initialization for user ${userId}...`);
                initializeWhatsAppClient(userId);
            }, retryDelay);
        } else {
            console.log(`❌ Max initialization attempts (${MAX_RECONNECT_ATTEMPTS}) reached for user ${userId}. Manual reconnect required.`);
            io.to(userId).emit('whatsapp:error', {
                error: 'Connection failed after multiple attempts. Please click "Reconnect" to try again.',
                timestamp: new Date().toISOString(),
                canRetry: true,
                maxAttemptsReached: true
            });
        }
    }
}

// ===== API ENDPOINTS =====

// Configuration endpoint for client-side Supabase initialization
app.get('/api/config', (req, res) => {
    try {
        // Only expose public configuration (anon key is safe to expose)
        res.json({
            success: true,
            supabaseUrl: SUPABASE_URL,
            supabaseAnonKey: SUPABASE_KEY
        });
    } catch (error) {
        console.error('❌ Error serving config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load configuration'
        });
    }
});

// Mount campaign routes
app.use('/api/campaigns', campaignRoutes);

// Temporary test route
app.get('/api/test', (req, res) => res.send('API Working'));

// Get WhatsApp connection status
app.get('/api/whatsapp/status', (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                connected: false,
                info: null,
                timestamp: new Date().toISOString(),
                error: 'userId parameter is required'
            });
        }

        const userData = getUserData(userId);

        res.status(200).json({
            success: true,
            connected: userData.isReady,
            info: userData.clientInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error in /api/whatsapp/status:', error);
        res.status(500).json({
            success: false,
            connected: false,
            info: null,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Verify and force-check WhatsApp connection state
app.post('/api/whatsapp/verify-connection', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                connected: false,
                message: 'userId is required'
            });
        }

        console.log(`🔍 Verifying connection for user ${userId}...`);

        const userData = getUserData(userId);

        // Check if client exists
        if (!userData.client) {
            console.log(`   ❌ No client found for user ${userId}`);
            return res.json({
                success: false,
                connected: false,
                message: 'WhatsApp client not initialized',
                action: 'reconnect'
            });
        }

        // Check if marked as ready
        if (!userData.isReady) {
            console.log(`   ⚠️ Client exists but not marked as ready for user ${userId}`);
            return res.json({
                success: false,
                connected: false,
                message: 'WhatsApp not connected',
                action: 'reconnect'
            });
        }

        // Try to actively verify connection by checking user info
        try {
            const info = userData.client.user;

            if (!info || !info.id) {
                console.log(`   ❌ No user info available - connection lost for user ${userId}`);

                // Mark as disconnected
                userData.isReady = false;

                // Emit disconnection event
                io.to(userId).emit('whatsapp:disconnected', {
                    reason: 'Connection verification failed',
                    timestamp: new Date().toISOString()
                });

                return res.json({
                    success: false,
                    connected: false,
                    message: 'Connection lost - verification failed',
                    action: 'reconnect'
                });
            }

            console.log(`   ✅ Connection verified for user ${userId}`);
            return res.json({
                success: true,
                connected: true,
                message: 'Connection active',
                info: {
                    id: info.id,
                    name: info.name || info.notify || 'User'
                }
            });

        } catch (verifyError) {
            console.error(`   ❌ Connection verification failed for user ${userId}:`, verifyError.message);

            // Mark as disconnected
            userData.isReady = false;

            // Emit disconnection event
            io.to(userId).emit('whatsapp:disconnected', {
                reason: 'Connection verification error',
                timestamp: new Date().toISOString()
            });

            return res.json({
                success: false,
                connected: false,
                message: 'Connection verification error',
                error: verifyError.message,
                action: 'reconnect'
            });
        }

    } catch (error) {
        console.error('❌ Error in verify-connection:', error);
        res.status(500).json({
            success: false,
            connected: false,
            message: error.message,
            action: 'reconnect'
        });
    }
});

// Force reconnect WhatsApp client
app.post('/api/whatsapp/reconnect', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'userId is required'
            });
        }

        console.log(`🔄 Force reconnect requested for user ${userId}...`);

        const userData = getUserData(userId);

        // If client exists and is ready, no need to reconnect
        if (userData.client && userData.isReady) {
            console.log(`   ✓ Client already connected for user ${userId}`);
            return res.json({
                success: true,
                message: 'Already connected'
            });
        }

        // If client exists but not ready, try to destroy it first
        if (userData.client) {
            console.log(`   🗑️ Destroying existing client for user ${userId}...`);
            try {
                await userData.client.end();
            } catch (err) {
                console.warn(`   ⚠️ Error ending client:`, err.message);
            }
            userData.client = null;
        }

        // Reset reconnect attempts
        userData.reconnectAttempts = 0;
        userData.isReady = false;
        userData.isInitializing = false;

        // Reinitialize the client
        console.log(`   🚀 Reinitializing WhatsApp client for user ${userId}...`);
        await initializeWhatsAppClient(userId);

        res.json({
            success: true,
            message: 'Reconnection initiated'
        });

    } catch (error) {
        console.error('❌ Error in reconnect:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Logout from WhatsApp
app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'userId is required'
            });
        }

        const userData = getUserData(userId);

        if (userData.client) {
            console.log(`🚪 Logging out from WhatsApp for user ${userId}...`);

            // Reset all state flags
            userData.isReady = false;
            userData.isInitializing = false;
            userData.clientInfo = null;
            userData.reconnectAttempts = 0;

            try {
                await userData.client.logout();
                console.log(`✓ WhatsApp logout successful for user ${userId}`);
            } catch (logoutError) {
                console.warn(`⚠️ Logout error for user ${userId} (continuing anyway):`, logoutError.message);
            }

            // Destroy the client
            try {
                await userData.client.destroy();
                console.log(`✓ Client destroyed for user ${userId}`);
            } catch (destroyError) {
                console.warn(`⚠️ Destroy error for user ${userId} (continuing anyway):`, destroyError.message);
            }

            userData.client = null;

            // COMPLETE MEMORY CLEANUP: Remove user from the whatsappClients map
            whatsappClients.delete(userId);
            console.log(`🗑️ User ${userId} completely removed from server memory`);

            console.log(`💾 Session folder preserved for user ${userId} for next login`);

            io.to(userId).emit('whatsapp:logged_out', {
                message: 'Logged out successfully',
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, message: 'Logged out successfully' });

            // Reinitialize client for new QR
            setTimeout(() => {
                console.log(`🔄 Reinitializing client after logout for user ${userId}...`);
                initializeWhatsAppClient(userId);
            }, 3000);
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
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(401).json({
                available: false,
                message: 'userId parameter is required'
            });
        }

        const userData = getUserData(userId);

        if (userData.isReady && userData.client) {
            res.json({
                available: true,
                info: userData.clientInfo
            });
        } else {
            res.status(503).json({
                available: false,
                message: 'WhatsApp client not ready'
            });
        }
    } catch (error) {
        console.error('❌ Error in /api/whatsapp/client:', error);
        res.status(500).json({
            available: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Send a test message
app.post('/api/whatsapp/send-message',
    // Validation rules
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('number').notEmpty().matches(/^[\d+\s-]+$/).withMessage('Invalid phone number'),
        body('message').notEmpty().isString().trim().isLength({ max: 4096 }).withMessage('Message too long (max 4096 chars)')
    ],
    validateRequest,
    async (req, res) => {
    try {
        let { number, message, userId } = req.body;

        // Sanitize inputs
        number = sanitizePhone(number);
        message = sanitizeString(message);

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'userId is required'
            });
        }

        const userData = getUserData(userId);

        if (!userData.isReady || !userData.client) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client not ready'
            });
        }

        if (!number || !message) {
            return res.status(400).json({
                success: false,
                error: 'Number and message are required'
            });
        }

        // Format number for Baileys (use @s.whatsapp.net for regular chats)
        const chatId = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;

        // Send message using Baileys syntax
        await userData.client.sendMessage(chatId, { text: message });

        // Update user-specific statistics
        const stats = getUserStats(userId);
        stats.messagesSent++;

        // Add to user-specific message history
        const messageData = {
            id: Date.now().toString(),
            from: 'me',
            to: chatId,
            body: message,
            timestamp: Date.now(),
            type: 'sent'
        };

        const userMessages = getUserMessages(userId);
        userMessages.unshift(messageData);
        if (userMessages.length > MAX_HISTORY) {
            userMessages.pop();
        }

        // Emit to this user only
        io.to(userId).emit('message:sent', messageData);
        io.to(userId).emit('stats:update', stats);

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

// Get statistics (aggregate across all users or specific user)
app.get('/api/stats', (req, res) => {
    const { userId } = req.query;

    if (userId) {
        // Return user-specific stats
        const stats = getUserStats(userId);
        res.json(stats);
    } else {
        // Aggregate stats across all users
        const aggregatedStats = {
            totalMessages: 0,
            messagesReceived: 0,
            messagesSent: 0,
            dealsLocked: 0,
            numbersValidated: 0,
            activeCampaigns: 0
        };

        for (const [, stats] of userStats) {
            aggregatedStats.totalMessages += stats.totalMessages || 0;
            aggregatedStats.messagesReceived += stats.messagesReceived || 0;
            aggregatedStats.messagesSent += stats.messagesSent || 0;
            aggregatedStats.dealsLocked += stats.dealsLocked || 0;
            aggregatedStats.numbersValidated += stats.numbersValidated || 0;
            aggregatedStats.activeCampaigns += stats.activeCampaigns || 0;
        }

        res.json(aggregatedStats);
    }
});

// Update validation count
app.post('/api/stats/validation', (req, res) => {
    const { count, userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required'
        });
    }

    const stats = getUserStats(userId);

    if (count && typeof count === 'number' && count > 0) {
        stats.numbersValidated += count;
        console.log(`✓ Numbers validated for user ${userId}: +${count} (total: ${stats.numbersValidated})`);
    }

    res.json({ success: true, numbersValidated: stats.numbersValidated });
});

// Get comprehensive dashboard statistics with campaign aggregation
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { userId } = req.query;

        // Get user-specific or aggregated stats
        let stats;
        let deals = [];

        if (userId) {
            stats = getUserStats(userId);

            // Query actual deals from database instead of in-memory Map
            const { data: dealsData, error: dealsError } = await supabase
                .from('deal_tracker')
                .select('*')
                .eq('user_id', userId);

            if (!dealsError && dealsData) {
                deals = dealsData;
            } else if (dealsError) {
                console.error('❌ Error fetching deals for dashboard:', dealsError.message);
            }
        } else {
            // Aggregate across all users
            stats = {
                totalMessages: 0,
                messagesReceived: 0,
                messagesSent: 0,
                dealsLocked: 0,
                numbersValidated: 0,
                activeCampaigns: 0
            };

            // Query all deals from database
            const { data: allDealsData, error: allDealsError } = await supabase
                .from('deal_tracker')
                .select('*');

            if (!allDealsError && allDealsData) {
                deals = allDealsData;
            } else if (allDealsError) {
                console.error('❌ Error fetching all deals for dashboard:', allDealsError.message);
            }

            for (const [, userStat] of userStats) {
                stats.totalMessages += userStat.totalMessages || 0;
                stats.messagesReceived += userStat.messagesReceived || 0;
                stats.messagesSent += userStat.messagesSent || 0;
                // Don't use in-memory dealsLocked anymore, use database count
                stats.numbersValidated += userStat.numbersValidated || 0;
                stats.activeCampaigns += userStat.activeCampaigns || 0;
            }
        }

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
    const { userId } = req.query;

    if (userId) {
        // Return user-specific message history
        const messageHistory = getUserMessages(userId);
        res.json({
            messages: messageHistory,
            total: messageHistory.length
        });
    } else {
        // Aggregate message history across all users
        const allMessages = [];
        for (const [, userMessages] of userMessageHistory) {
            allMessages.push(...userMessages);
        }

        // Sort by timestamp (most recent first)
        allMessages.sort((a, b) => b.timestamp - a.timestamp);

        res.json({
            messages: allMessages.slice(0, MAX_HISTORY), // Limit to MAX_HISTORY
            total: allMessages.length
        });
    }
});

// Clear conversation history for a specific customer
app.post('/api/conversation/clear', (req, res) => {
    const { userId, phoneNumber } = req.body;

    if (!userId || !phoneNumber) {
        return res.status(400).json({
            success: false,
            error: 'userId and phoneNumber are required'
        });
    }

    const cleared = clearConversationHistory(userId, phoneNumber);

    res.json({
        success: true,
        cleared: cleared,
        message: cleared ? 'Conversation history cleared' : 'No conversation history found'
    });
});

// Clear all conversation histories for a user (nuclear option)
app.post('/api/conversation/clear-all', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required'
        });
    }

    let clearedCount = 0;
    const keysToDelete = [];

    // Find all conversations for this user
    for (const key of conversationHistory.keys()) {
        if (key.startsWith(`${userId}_`)) {
            keysToDelete.push(key);
        }
    }

    // Delete them
    for (const key of keysToDelete) {
        conversationHistory.delete(key);
        clearedCount++;
    }

    console.log(`🗑️ Cleared ${clearedCount} conversations for user ${userId}`);

    res.json({
        success: true,
        clearedCount: clearedCount,
        message: `Cleared ${clearedCount} conversation(s)`
    });
});

// ===== CONTACT MAPPING API ENDPOINTS =====

// Get contact mappings for debugging
app.get('/api/contacts/mappings', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required'
        });
    }

    const mapping = getUserContactMapping(userId);
    const mappingsArray = [];

    for (const [jid, contactData] of mapping.entries()) {
        mappingsArray.push({
            jid: jid,
            phone: contactData.phone,
            name: contactData.name,
            realJid: contactData.realJid,
            lastUpdated: new Date(contactData.lastUpdated).toISOString()
        });
    }

    res.json({
        success: true,
        count: mappingsArray.length,
        mappings: mappingsArray
    });
});

// Manually trigger contact sync (force reload from Baileys)
app.post('/api/contacts/sync', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        const userData = getUserData(userId);

        if (!userData.isReady || !userData.client) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client not ready'
            });
        }

        console.log(`🔄 Manual contact sync requested for user ${userId}`);

        // Access the Baileys contact store
        const sock = userData.client;
        let syncedCount = 0;

        if (sock.store?.contacts) {
            for (const [jid, contact] of Object.entries(sock.store.contacts)) {
                saveContactMapping(userId, { ...contact, id: jid, jid: jid });
                syncedCount++;
            }
        }

        console.log(`✅ Synced ${syncedCount} contacts for user ${userId}`);

        res.json({
            success: true,
            message: `Synced ${syncedCount} contacts`,
            count: syncedCount
        });

    } catch (error) {
        console.error('❌ Error syncing contacts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear contact mappings for a user
app.delete('/api/contacts/mappings', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required'
        });
    }

    const mapping = getUserContactMapping(userId);
    const count = mapping.size;
    mapping.clear();

    console.log(`🗑️ Cleared ${count} contact mappings for user ${userId}`);

    res.json({
        success: true,
        message: `Cleared ${count} contact mapping(s)`,
        count: count
    });
});

// Get deals
app.get('/api/deals', (req, res) => {
    const { status = 'all', page = 1, limit = 10, userId } = req.query;

    // Get user-specific or aggregated deals
    let deals;
    if (userId) {
        deals = getUserDeals(userId);
    } else {
        // Aggregate deals across all users
        deals = [];
        for (const [, userDealsArray] of userDeals) {
            deals.push(...userDealsArray);
        }
    }

    // Filter by status
    let filtered = status === 'all' ? deals : deals.filter(d => d.status === status);

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedDeals = filtered.slice(startIndex, startIndex + parseInt(limit));

    // Counters
    const totalDeals = deals.length;
    const completed = deals.filter(d => d.status === 'completed').length;
    const newDeals = deals.filter(d => d.status === 'new').length;

    res.json({
        success: true,
        deals: paginatedDeals,
        totalDeals,
        completed,
        newDeals,
        total: filtered.length,
        page: parseInt(page),
        totalPages: Math.ceil(filtered.length / parseInt(limit))
    });
});

// NEW: Update deal status or phone - MULTI-TENANT
app.put('/api/deals/tracked/:id',
    // Validation rules
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('status').optional().isIn(['new', 'completed', 'cancelled']).withMessage('Invalid status'),
        body('customer_phone').optional().custom(value => {
            if (value && !/^[\d+\s-]+$/.test(value)) {
                throw new Error('Invalid phone number format');
            }
            return true;
        })
    ],
    validateRequest,
    async (req, res) => {
    try {
        const { id } = req.params;
        let { status, customer_phone, userId } = req.body;

        // Sanitize inputs
        if (customer_phone) {
            customer_phone = sanitizePhone(customer_phone);
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        // Build update object based on what's provided
        const updateData = {
            updated_at: new Date().toISOString()
        };

        // Add status if provided
        if (status) {
            // Validate status
            const validStatuses = ['new', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }
            updateData.status = status;
        }

        // Add customer_phone if provided
        if (customer_phone) {
            updateData.customer_phone = customer_phone;
        }

        // Must have at least one field to update
        if (!status && !customer_phone) {
            return res.status(400).json({
                success: false,
                error: 'Either status or customer_phone is required'
            });
        }

        const { data, error } = await supabase
            .from('deal_tracker')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', userId) // Security: only update if owned by this user
            .select()
            .single();

        if (error) {
            console.error('❌ Error updating deal status:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Deal not found or access denied'
            });
        }

        // Log what was updated
        const updates = [];
        if (status) updates.push(`status → ${status}`);
        if (customer_phone) updates.push(`phone → ${customer_phone}`);
        console.log(`✓ Deal #${id} updated for user ${userId}: ${updates.join(', ')}`);

        res.json({
            success: true,
            message: `Deal updated successfully`,
            deal: data
        });

    } catch (error) {
        console.error('❌ Exception updating deal status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// NEW: Delete deal - MULTI-TENANT
app.delete('/api/deals/tracked/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        console.log(`🗑️ DELETE request received - Deal ID: ${id}, User ID: ${userId}`);

        if (!userId) {
            console.error('❌ Missing userId in query parameter');
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        // Convert ID to integer (deal IDs are bigint/integer in database)
        const dealId = parseInt(id, 10);
        if (isNaN(dealId)) {
            console.error(`❌ Invalid deal ID format: ${id}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid deal ID format'
            });
        }

        console.log(`📡 Attempting to delete deal #${dealId} for user ${userId}...`);

        const { error } = await supabase
            .from('deal_tracker')
            .delete()
            .eq('id', dealId)
            .eq('user_id', userId); // Security: only delete if owned by this user

        if (error) {
            console.error('❌ Supabase error deleting deal:');
            console.error('   Error code:', error.code);
            console.error('   Error message:', error.message);
            console.error('   Error details:', JSON.stringify(error, null, 2));
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        console.log(`✅ Deal #${dealId} deleted successfully for user ${userId}`);

        res.json({
            success: true,
            message: 'Deal deleted successfully'
        });

    } catch (error) {
        console.error('❌ Exception in delete deal route:');
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// NEW: Get deals from database (deal_tracker table) - MULTI-TENANT
app.get('/api/deals/tracked', async (req, res) => {
    try {
        const { status = 'all', page = 1, limit = 50, userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        let query = supabase
            .from('deal_tracker')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // Filter by status if not 'all'
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('❌ Error fetching tracked deals:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        // Count by status
        const { data: allDeals } = await supabase
            .from('deal_tracker')
            .select('status')
            .eq('user_id', userId);

        const statusCounts = {
            new: allDeals?.filter(d => d.status === 'new').length || 0,
            completed: allDeals?.filter(d => d.status === 'completed').length || 0,
            cancelled: allDeals?.filter(d => d.status === 'cancelled').length || 0
        };

        res.json({
            success: true,
            deals: data || [],
            total: count || 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil((count || 0) / parseInt(limit)),
            statusCounts
        });

    } catch (error) {
        console.error('❌ Exception fetching tracked deals:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
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
            .limit(1)
            .select()
            .maybeSingle();

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
        // Try to get status from database (limit to 1 row to avoid PGRST116 error)
        const { data, error } = await supabase
            .from('business_config')
            .select('is_active')
            .limit(1)
            .maybeSingle();

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

// Get business config (AI prompt) - MULTI-TENANT
app.get('/api/business-config', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        const { data, error } = await supabase
            .from('business_config')
            .select('prompt_text, payment_details')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('❌ Error fetching business config:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            prompt_text: data?.prompt_text || '',
            payment_details: data?.payment_details || ''
        });
    } catch (error) {
        console.error('❌ Exception fetching business config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update business config (AI prompt) - MULTI-TENANT
app.post('/api/business-config',
    // Validation rules
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('prompt_text').optional().isString().trim().isLength({ max: 5000 }).withMessage('Prompt text too long (max 5000 chars)'),
        body('payment_details').optional().isString().trim().isLength({ max: 1000 }).withMessage('Payment details too long (max 1000 chars)')
    ],
    validateRequest,
    async (req, res) => {
    try {
        let { userId, prompt_text, payment_details } = req.body;

        // Sanitize inputs
        if (prompt_text) {
            prompt_text = sanitizeString(prompt_text);
        }
        if (payment_details) {
            payment_details = sanitizeString(payment_details);
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        if (!prompt_text) {
            return res.status(400).json({
                success: false,
                error: 'prompt_text is required'
            });
        }

        // Check if user config exists
        const { data: existing, error: checkError } = await supabase
            .from('business_config')
            .select('user_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

        let result;
        if (existing) {
            // Update existing config
            const { data, error } = await supabase
                .from('business_config')
                .update({
                    prompt_text: prompt_text,
                    payment_details: payment_details || null,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select();

            result = { data, error };
        } else {
            // Insert new config
            const { data, error } = await supabase
                .from('business_config')
                .insert({
                    user_id: userId,
                    prompt_text: prompt_text,
                    payment_details: payment_details || null,
                    is_active: false
                })
                .select();

            result = { data, error };
        }

        if (result.error) {
            console.error('❌ Error updating business config:', result.error);
            return res.status(500).json({
                success: false,
                error: result.error.message
            });
        }

        console.log(`✓ Business config updated successfully for user ${userId}`);

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
        const { numbers, message, delay, userId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'userId is required'
            });
        }

        const userData = getUserData(userId);

        if (!userData.isReady || !userData.client) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client not ready'
            });
        }

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
            const stats = getUserStats(userId);
            const userMessages = getUserMessages(userId);

            for (const number of numbers) {
                try {
                    const chatId = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
                    await userData.client.sendMessage(chatId, { text: message });

                    sent++;
                    stats.messagesSent++;

                    // Add to user-specific message history
                    const messageData = {
                        id: Date.now().toString(),
                        from: 'me',
                        to: chatId,
                        body: message,
                        timestamp: Date.now(),
                        type: 'sent'
                    };

                    userMessages.unshift(messageData);
                    if (userMessages.length > MAX_HISTORY) {
                        userMessages.pop();
                    }

                    // Emit progress to this user only
                    io.to(userId).emit('bulk-send:progress', {
                        sent,
                        failed,
                        total: numbers.length,
                        current: number
                    });

                    io.to(userId).emit('message:sent', messageData);
                    io.to(userId).emit('stats:update', stats);

                    console.log(`✅ Bulk send: ${sent}/${numbers.length} - ${number}`);

                    // Wait before next message
                    if (sent < numbers.length) {
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }

                } catch (error) {
                    failed++;
                    console.error(`❌ Bulk send failed for ${number}:`, error.message);

                    io.to(userId).emit('bulk-send:progress', {
                        sent,
                        failed,
                        total: numbers.length,
                        current: number,
                        error: error.message
                    });
                }
            }

            // Emit completion to this user only
            io.to(userId).emit('bulk-send:complete', {
                sent,
                failed,
                total: numbers.length
            });

            console.log(`✅ Bulk send complete for user ${userId}: ${sent} sent, ${failed} failed`);

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

// Get all products - MULTI-TENANT
app.get('/api/products', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', userId)
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

// Create a new product - MULTI-TENANT
app.post('/api/products',
    // Validation rules
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('item_name').notEmpty().trim().isLength({ min: 1, max: 200 }).withMessage('Product name must be 1-200 characters'),
        body('price_pkr').notEmpty().isFloat({ min: 0 }).withMessage('Price must be a positive number')
    ],
    validateRequest,
    async (req, res) => {
    try {
        let { item_name, price_pkr, userId } = req.body;

        // Sanitize inputs
        item_name = sanitizeString(item_name);
        price_pkr = sanitizeNumber(price_pkr);

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

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
                user_id: userId,
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

        console.log(`✓ Product created for user ${userId}:`, data.item_name);

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

// Update a product - MULTI-TENANT
app.put('/api/products/:id',
    // Validation rules
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('item_name').notEmpty().trim().isLength({ min: 1, max: 200 }).withMessage('Product name must be 1-200 characters'),
        body('price_pkr').notEmpty().isFloat({ min: 0 }).withMessage('Price must be a positive number')
    ],
    validateRequest,
    async (req, res) => {
    try {
        const { id } = req.params;
        let { item_name, price_pkr, userId } = req.body;

        // Sanitize inputs
        item_name = sanitizeString(item_name);
        price_pkr = sanitizeNumber(price_pkr);

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

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
            .eq('user_id', userId) // Security: only update if owned by this user
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
                error: 'Product not found or access denied'
            });
        }

        console.log(`✓ Product updated for user ${userId}:`, data.item_name);

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

// Delete a product - MULTI-TENANT
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        const { data, error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('user_id', userId) // Security: only delete if owned by this user
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
                error: 'Product not found or access denied'
            });
        }

        console.log(`✓ Product deleted for user ${userId}:`, data.item_name);

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

// Upload media to Supabase Storage - Multi-file support - MULTI-TENANT
app.post('/api/media/upload', upload.array('files', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        const { tag, userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        if (!tag) {
            return res.status(400).json({
                success: false,
                error: 'Product tag is required'
            });
        }

        console.log(`📤 Uploading ${req.files.length} file(s) for user ${userId}...`);

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

                // Save metadata to database with userId
                const { data: dbData, error: dbError } = await supabase
                    .from('product_media')
                    .insert({
                        user_id: userId,
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

                console.log(`  ✓ Metadata saved to database for user ${userId}`);
                uploadedMedia.push(dbData);

            } catch (fileError) {
                console.error(`  ❌ Exception processing ${file.originalname}:`, fileError.message);
                errors.push({ filename: file.originalname, error: fileError.message });
            }
        }

        console.log(`✅ Upload complete for user ${userId}: ${uploadedMedia.length} succeeded, ${errors.length} failed`);

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

// Get all media or filter by tag - MULTI-TENANT
app.get('/api/media', async (req, res) => {
    try {
        const { tag, userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        let query = supabase
            .from('product_media')
            .select('*')
            .eq('user_id', userId)
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

// Delete media - MULTI-TENANT
app.delete('/api/media/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        // Get media info first (check ownership)
        const { data: media, error: fetchError } = await supabase
            .from('product_media')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId) // Security: only fetch if owned by this user
            .single();

        if (fetchError || !media) {
            return res.status(404).json({
                success: false,
                error: 'Media not found or access denied'
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
            .eq('id', id)
            .eq('user_id', userId); // Security: double-check ownership

        if (dbError) {
            console.error('❌ Error deleting media from database:', dbError);
            return res.status(500).json({
                success: false,
                error: dbError.message
            });
        }

        console.log(`✓ Media deleted for user ${userId}`);

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
// NOTE: Blacklist is now stored in Supabase 'blacklist' table (multi-tenant, normalized to last 10 digits)
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
        console.log('   Message type:', typeof message);
        console.log('   Message length:', message?.length);
        console.log('   Contacts (raw type):', typeof contacts);

        if (!name || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name and message are required'
            });
        }

        // Parse message - could be single string or JSON array of templates
        let messageTemplates;
        try {
            // Try parsing as JSON (array of templates)
            const parsed = JSON.parse(message);
            if (Array.isArray(parsed)) {
                messageTemplates = parsed;
                console.log(`🔄 Template rotation enabled: ${messageTemplates.length} templates`);
            } else {
                messageTemplates = message; // Single template
            }
        } catch {
            // Not JSON, treat as single template string
            messageTemplates = message;
            console.log('✓ Single message template');
        }

        // Validate templates
        if (Array.isArray(messageTemplates)) {
            if (messageTemplates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one message template is required'
                });
            }
            // Validate each template is non-empty
            const validTemplates = messageTemplates.filter(t => t && typeof t === 'string' && t.trim().length > 0);
            if (validTemplates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one valid message template is required'
                });
            }
            messageTemplates = validTemplates; // Use only valid templates
        } else if (!messageTemplates || messageTemplates.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message template cannot be empty'
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
            message: messageTemplates, // Store templates (string or array)
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
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'userId is required'
            });
        }

        const campaign = bulkCampaigns.find(c => c.id === parseInt(req.params.id));

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Store userId in campaign for later use
        campaign.userId = userId;

        // Reset stop flag if starting
        campaign.stopRequested = false;

        // Get user-specific WhatsApp client
        const userData = getUserData(userId);

        // Check if WhatsApp is connected
        if (!userData.isReady || !userData.client) {
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
            console.log(`\n🚀 Starting campaign: ${campaign.name} for user ${userId}`);
            console.log(`📊 Total contacts: ${campaign.contacts.length}`);

            // Get user data for this campaign
            const userData = getUserData(campaign.userId);

            // Verify client is still ready
            if (!userData.isReady || !userData.client) {
                console.error(`❌ WhatsApp client not ready for user ${campaign.userId} during campaign execution`);
                campaign.status = 'failed';
                io.emit('bulk-campaign:error', {
                    campaignId: campaign.id,
                    error: 'WhatsApp client disconnected'
                });
                return;
            }

            // Helper function to normalize phone numbers for FOOLPROOF comparison
            // Extracts last 10 digits to handle all formats: 03318851184, 923318851184, +923318851184, etc.
            const normalizePhone = (phone) => {
                if (!phone) return '';

                // Convert to string and remove all non-numeric characters
                let normalized = String(phone).replace(/[^0-9]/g, '');

                // Extract last 10 digits (Pakistani mobile numbers are 10 digits after country code)
                // This ensures "03318851184" -> "3318851184" and "923318851184" -> "3318851184"
                if (normalized.length >= 10) {
                    normalized = normalized.slice(-10);
                }

                return normalized;
            };

            // ===== FETCH AND NORMALIZE BLACKLIST (BULLETPROOF) =====
            console.log(`📋 Fetching blacklist for user ${campaign.userId}...`);
            let blacklistedNumbers = []; // Array of clean 10-digit strings

            try {
                const { data: blacklistData, error: blacklistError } = await supabase
                    .from('blacklist')
                    .select('phone')
                    .eq('user_id', campaign.userId);

                if (blacklistError) {
                    console.error('⚠️ Error fetching blacklist:', blacklistError.message);
                } else if (blacklistData && blacklistData.length > 0) {
                    // CRITICAL: Flatten and normalize to last 10 digits
                    blacklistedNumbers = blacklistData
                        .map(entry => {
                            if (!entry.phone) return null;
                            // Extract digits only, then take last 10
                            const digitsOnly = String(entry.phone).replace(/\D/g, '');
                            const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
                            return last10;
                        })
                        .filter(num => num && num.length === 10); // Only keep valid 10-digit numbers

                    console.log(`✅ Loaded ${blacklistedNumbers.length} blacklisted numbers for user ${campaign.userId}`);
                    console.log(`📋 Blacklist (10-digit normalized):`, blacklistedNumbers);
                } else {
                    console.log(`✅ No blacklisted numbers found for user ${campaign.userId}`);
                }
            } catch (blacklistFetchError) {
                console.error('❌ Exception fetching blacklist:', blacklistFetchError.message);
            }

            console.log(`\n🚀 CAMPAIGN LOOP STARTING`);
            console.log(`📊 Total contacts to process: ${campaign.contacts.length}`);
            console.log(`📋 Blacklist entries loaded: ${blacklistedNumbers.length} numbers`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            for (let i = 0; i < campaign.contacts.length; i++) {
                console.log(`\n[${i + 1}/${campaign.contacts.length}] Processing contact...`);

                // CHECK FOR STOP FLAG
                if (campaign.stopRequested) {
                    console.log(`🛑 Campaign ${campaign.name} stopped by user.`);
                    campaign.status = 'stopped';
                    io.emit('bulk-campaign:stopped', {
                        campaignId: campaign.id,
                        sent: campaign.sent,
                        failed: campaign.failed
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
                            failed: campaign.failed
                        });
                        return;
                    }
                }

                const contact = campaign.contacts[i];

                console.log(`👤 Contact: ${contact.name} (${contact.phone})`);

                try {
                    // ===== CRITICAL BLACKLIST CHECK - EXPLICIT 10-DIGIT NORMALIZATION =====
                    console.log(`🔍 Checking if blacklisted...`);

                    // Normalize contact phone to last 10 digits
                    const contactPhoneDigitsOnly = String(contact.phone).replace(/\D/g, '');
                    const contactPhoneNormalized = contactPhoneDigitsOnly.length >= 10
                        ? contactPhoneDigitsOnly.slice(-10)
                        : contactPhoneDigitsOnly;

                    console.log(`   📞 Original: "${contact.phone}"`);
                    console.log(`   🔢 Digits only: "${contactPhoneDigitsOnly}"`);
                    console.log(`   ✂️  Last 10 digits: "${contactPhoneNormalized}"`);
                    console.log(`   📋 Blacklist array: [${blacklistedNumbers.join(', ')}]`);

                    // Check if this normalized number is in the blacklist
                    const isBlacklisted = blacklistedNumbers.includes(contactPhoneNormalized);
                    console.log(`   🎯 Match found: ${isBlacklisted}`);

                    if (isBlacklisted) {
                        console.log(`\n❌ [BLACKLIST BLOCKED] ${contact.name} (${contact.phone})`);
                        console.log(`   → Normalized: ${contactPhoneNormalized}`);
                        console.log(`   → Reason: Number is blacklisted\n`);

                        // Mark contact as failed (for Excel export)
                        contact.status = 'failed';
                        contact.error = 'Blacklisted Number';

                        // Update campaign stats
                        campaign.failed++;
                        campaign.pending--;

                        // Emit progress update (user-specific)
                        io.to(campaign.userId).emit('campaign-update', {
                            campaignId: campaign.id,
                            sent: campaign.sent,
                            failed: campaign.failed,
                            pending: campaign.pending,
                            status: campaign.status,
                            contactName: contact.name,
                            contactPhone: contact.phone,
                            contactStatus: 'failed',
                            error: 'Blacklisted Number',
                            timestamp: new Date().toISOString()
                        });

                        console.log(`⏭️  Continuing to next contact...\n`);
                        // Skip message sending
                        continue;
                    }

                    console.log(`✅ Not blacklisted - proceeding with message send...\n`);

                    // Format phone number for Baileys (use @s.whatsapp.net)
                    let phoneNumber = contact.phone.replace(/[^0-9]/g, '');

                    // Pakistani number sanitization: remove leading 0 and prefix with 92
                    if (phoneNumber.startsWith('0')) {
                        phoneNumber = '92' + phoneNumber.substring(1);
                    }

                    // Baileys uses @s.whatsapp.net for regular chats
                    const jid = phoneNumber + '@s.whatsapp.net';

                    // Template rotation: pick random template if array, otherwise use string
                    let selectedTemplate;
                    if (Array.isArray(campaign.message)) {
                        // Pick random template from array
                        selectedTemplate = campaign.message[Math.floor(Math.random() * campaign.message.length)];
                        console.log(`🔄 Template rotation: Selected template ${campaign.message.indexOf(selectedTemplate) + 1}/${campaign.message.length}`);
                    } else {
                        // Single template string
                        selectedTemplate = campaign.message;
                    }

                    // Replace variables in message template
                    let personalizedMessage = selectedTemplate
                        .replace(/{name}/g, contact.name || 'there')
                        .replace(/{city}/g, contact.city || '')
                        .replace(/{tag}/g, contact.tag || '')
                        .replace(/{phone}/g, contact.phone || '');

                    // Send text message via Baileys
                    console.log(`📤 Sending to ${contact.name} (${contact.phone})...`);
                    await userData.client.sendMessage(jid, { text: personalizedMessage });
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
                                    // Read file as buffer
                                    const fileBuffer = fs.readFileSync(fullPath);
                                    const fileExt = path.extname(mediaPath).toLowerCase();

                                    // Determine message type based on extension
                                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt)) {
                                        await userData.client.sendMessage(jid, {
                                            image: fileBuffer,
                                            caption: ''
                                        });
                                    } else if (['.pdf', '.doc', '.docx', '.txt'].includes(fileExt)) {
                                        await userData.client.sendMessage(jid, {
                                            document: fileBuffer,
                                            fileName: path.basename(mediaPath),
                                            mimetype: 'application/octet-stream'
                                        });
                                    } else {
                                        await userData.client.sendMessage(jid, {
                                            document: fileBuffer,
                                            fileName: path.basename(mediaPath),
                                            mimetype: 'application/octet-stream'
                                        });
                                    }
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
                                // Use Baileys syntax to send media from buffer
                                const isImage = mediaFile.mimetype && mediaFile.mimetype.startsWith('image/');

                                if (isImage) {
                                    await userData.client.sendMessage(jid, {
                                        image: mediaFile.buffer,
                                        caption: ''
                                    });
                                } else {
                                    await userData.client.sendMessage(jid, {
                                        document: mediaFile.buffer,
                                        fileName: mediaFile.filename,
                                        mimetype: mediaFile.mimetype || 'application/octet-stream'
                                    });
                                }

                                console.log(`✅ Sent global media: ${mediaFile.filename}`);

                                // Small delay between media files
                                await new Promise(resolve => setTimeout(resolve, 2000));

                            } catch (mediaError) {
                                console.error(`❌ Failed to send global media ${mediaFile.filename}:`, mediaError.message);
                            }
                        }
                    }

                    // Mark contact as sent (for Excel export)
                    contact.status = 'sent';
                    contact.error = null;

                    // Update campaign stats
                    campaign.sent++;
                    campaign.pending--;

                    console.log(`✅ Completed ${campaign.sent}/${campaign.contacts.length}`);

                    // Emit progress update (user-specific)
                    io.to(campaign.userId).emit('campaign-update', {
                        campaignId: campaign.id,
                        sent: campaign.sent,
                        failed: campaign.failed,
                        pending: campaign.pending,
                        status: campaign.status,
                        contactName: contact.name,
                        contactPhone: contact.phone,
                        contactStatus: 'sent',
                        error: null,
                        timestamp: new Date().toISOString()
                    });

                    // Random delay between 8-15 seconds before next contact
                    const delay = Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000;
                    console.log(`⏳ Waiting ${delay/1000}s before next contact...`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                } catch (error) {
                    console.error(`❌ Failed to send to ${contact.name}:`, error.message);

                    // Mark contact as failed (for Excel export)
                    contact.status = 'failed';
                    contact.error = error.message || 'Send failed';

                    // Update campaign stats
                    campaign.failed++;
                    campaign.pending--;

                    // Emit progress update (user-specific)
                    io.to(campaign.userId).emit('campaign-update', {
                        campaignId: campaign.id,
                        sent: campaign.sent,
                        failed: campaign.failed,
                        pending: campaign.pending,
                        status: campaign.status,
                        contactName: contact.name,
                        contactPhone: contact.phone,
                        contactStatus: 'failed',
                        error: error.message || 'Send failed',
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Campaign completed
            campaign.status = 'completed';
            console.log(`\n✅ Campaign completed: ${campaign.name}`);
            console.log(`📊 Final Stats: Sent: ${campaign.sent}, Failed: ${campaign.failed}`);
            console.log(`   → Total contacts: ${campaign.contacts.length}`);
            console.log(`   → Success rate: ${((campaign.sent / campaign.contacts.length) * 100).toFixed(1)}%`);

            io.to(campaign.userId).emit('campaign-update', {
                campaignId: campaign.id,
                sent: campaign.sent,
                failed: campaign.failed,
                pending: 0,
                status: 'completed',
                timestamp: new Date().toISOString()
            });

            io.to(campaign.userId).emit('bulk-campaign:complete', {
                campaignId: campaign.id,
                sent: campaign.sent,
                failed: campaign.failed
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

    // Generate CSV with actual contact status
    let csv = 'Name,Phone,Status,Error\n';
    campaign.contacts.forEach(contact => {
        const status = contact.status || 'pending';
        const error = contact.error || '';
        // Escape commas in error messages for CSV
        const errorEscaped = error.replace(/,/g, ';');
        csv += `${contact.name},${contact.phone},${status},${errorEscaped}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=campaign_${campaign.id}_results.csv`);
    res.send(csv);
});

// Get blacklist - MULTI-TENANT with Supabase
app.get('/api/bulk/blacklist', async (req, res) => {
    console.log('📥 [BLACKLIST GET] Received request:', { query: req.query });

    try {
        const { userId } = req.query;

        // SAFEGUARD: Validate userId
        if (!userId) {
            console.error('❌ [BLACKLIST GET] Missing userId parameter');
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        console.log(`📋 [BLACKLIST GET] Fetching blacklist for user: ${userId}`);

        // Fetch from Supabase
        const { data, error: fetchError } = await supabase
            .from('blacklist')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('❌ [BLACKLIST GET] Database fetch error:', fetchError);
            console.error('   Error code:', fetchError.code);
            console.error('   Error message:', fetchError.message);
            console.error('   Error details:', JSON.stringify(fetchError, null, 2));
            return res.status(500).json({
                success: false,
                error: `Failed to fetch blacklist: ${fetchError.message}`
            });
        }

        // Success - return data (empty array if no results)
        const blacklistData = data || [];
        console.log(`✅ [BLACKLIST GET] Successfully fetched ${blacklistData.length} blacklist entries`);

        res.json({
            success: true,
            blacklist: blacklistData
        });
    } catch (error) {
        console.error('❌ [BLACKLIST GET ERROR] Unhandled exception:');
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);

        // Only send response if not already sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
});

// Add to blacklist - MULTI-TENANT with Supabase and normalization
app.post('/api/bulk/blacklist',
    // Validation rules
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('phone').notEmpty().withMessage('Phone number is required')
            .matches(/^[\d+\s-]+$/).withMessage('Invalid phone number format'),
        body('reason').optional().isString().trim().isLength({ max: 200 }).withMessage('Reason too long (max 200 chars)')
    ],
    validateRequest,
    async (req, res) => {
    console.log('📥 [BLACKLIST POST] Received request:', { body: req.body });

    try {
        let { phone, reason, userId } = req.body;

        // Sanitize inputs
        phone = sanitizePhone(phone);
        if (reason) {
            reason = sanitizeString(reason);
        }

        // SAFEGUARD: Validate userId
        if (!userId) {
            console.error('❌ [BLACKLIST POST] Missing userId');
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        // SAFEGUARD: Validate phone
        if (!phone || phone === '') {
            console.error('❌ [BLACKLIST POST] Missing phone number');
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // SAFEGUARD: Normalize phone with type checking
        let normalizedPhone = '';
        try {
            normalizedPhone = String(phone).replace(/[^0-9]/g, '');
            if (!normalizedPhone) {
                throw new Error('Phone number contains no digits');
            }
        } catch (normError) {
            console.error('❌ [BLACKLIST POST] Normalization failed:', normError);
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }

        const last10Digits = normalizedPhone.length >= 10 ? normalizedPhone.slice(-10) : normalizedPhone;

        console.log(`📋 [BLACKLIST POST] Adding to blacklist: "${phone}" -> normalized: "${last10Digits}"`);

        // Check if already blacklisted
        console.log(`🔍 [BLACKLIST POST] Checking for existing entry...`);
        const { data: existing, error: checkError } = await supabase
            .from('blacklist')
            .select('id')
            .eq('user_id', userId)
            .eq('phone', last10Digits)
            .maybeSingle();

        if (checkError) {
            console.error('❌ [BLACKLIST POST] Database check error:', checkError);
            console.error('   Error code:', checkError.code);
            console.error('   Error message:', checkError.message);
            console.error('   Error details:', JSON.stringify(checkError, null, 2));
            return res.status(500).json({
                success: false,
                error: `Database error: ${checkError.message}`
            });
        }

        if (existing) {
            console.log(`⚠️ [BLACKLIST POST] Number already blacklisted: ${last10Digits}`);
            return res.status(400).json({
                success: false,
                error: 'Number already blacklisted'
            });
        }

        // Insert into Supabase
        console.log(`💾 [BLACKLIST POST] Inserting into database...`);
        const { data, error: insertError } = await supabase
            .from('blacklist')
            .insert({
                user_id: userId,
                phone: last10Digits,
                reason: reason || 'Manually added'
            })
            .select();

        if (insertError) {
            console.error('❌ [BLACKLIST POST] Database insert error:', insertError);
            console.error('   Error code:', insertError.code);
            console.error('   Error message:', insertError.message);
            console.error('   Error details:', JSON.stringify(insertError, null, 2));
            return res.status(500).json({
                success: false,
                error: `Failed to add to blacklist: ${insertError.message}`
            });
        }

        if (!data || data.length === 0) {
            console.error('❌ [BLACKLIST POST] Insert succeeded but no data returned');
            return res.status(500).json({
                success: false,
                error: 'Insert succeeded but no data returned'
            });
        }

        console.log(`✅ [BLACKLIST POST] Successfully added to blacklist: ${last10Digits}`);

        res.json({
            success: true,
            message: 'Added to blacklist',
            entry: data[0]
        });
    } catch (error) {
        console.error('❌ [BLACKLIST POST ERROR] Unhandled exception:');
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);

        // Only send response if not already sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
});

// Remove from blacklist - MULTI-TENANT with Supabase
app.delete('/api/bulk/blacklist/:phone', async (req, res) => {
    console.log('📥 [BLACKLIST DELETE] Received request:', { params: req.params, query: req.query });

    try {
        const { userId } = req.query;
        const phone = decodeURIComponent(req.params.phone);

        // SAFEGUARD: Validate userId
        if (!userId) {
            console.error('❌ [BLACKLIST DELETE] Missing userId');
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        // SAFEGUARD: Validate phone
        if (!phone || phone === '') {
            console.error('❌ [BLACKLIST DELETE] Missing phone parameter');
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // SAFEGUARD: Normalize phone with type checking
        let normalizedPhone = '';
        try {
            normalizedPhone = String(phone).replace(/[^0-9]/g, '');
            if (!normalizedPhone) {
                throw new Error('Phone number contains no digits');
            }
        } catch (normError) {
            console.error('❌ [BLACKLIST DELETE] Normalization failed:', normError);
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }

        const last10Digits = normalizedPhone.length >= 10 ? normalizedPhone.slice(-10) : normalizedPhone;

        console.log(`🗑️ [BLACKLIST DELETE] Removing from blacklist: "${phone}" -> normalized: "${last10Digits}"`);

        // Delete from Supabase
        const { error: deleteError } = await supabase
            .from('blacklist')
            .delete()
            .eq('user_id', userId)
            .eq('phone', last10Digits);

        if (deleteError) {
            console.error('❌ [BLACKLIST DELETE] Database delete error:', deleteError);
            console.error('   Error code:', deleteError.code);
            console.error('   Error message:', deleteError.message);
            console.error('   Error details:', JSON.stringify(deleteError, null, 2));
            return res.status(500).json({
                success: false,
                error: `Failed to remove from blacklist: ${deleteError.message}`
            });
        }

        console.log(`✅ [BLACKLIST DELETE] Successfully removed from blacklist: ${last10Digits}`);

        res.json({
            success: true,
            message: 'Removed from blacklist'
        });
    } catch (error) {
        console.error('❌ [BLACKLIST DELETE ERROR] Unhandled exception:');
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);

        // Only send response if not already sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }
});

// Get WhatsApp groups using Baileys
app.get('/api/bulk/groups', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'userId is required'
            });
        }

        const userData = getUserData(userId);

        if (!userData.isReady || !userData.client) {
            return res.json({
                success: false,
                message: 'WhatsApp not connected'
            });
        }

        console.log(`📥 Fetching groups for user ${userId} using Baileys...`);

        // Use Baileys method to fetch all participating groups
        const groupsResponse = await userData.client.groupFetchAllParticipating();

        const groups = [];

        // Iterate over the groups object
        for (const [jid, group] of Object.entries(groupsResponse)) {
            groups.push({
                id: jid,
                name: group.subject || 'Unnamed Group',
                participantCount: group.participants ? group.participants.length : 0
            });
        }

        console.log(`✅ Found ${groups.length} groups for user ${userId}`);

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

// Extract group members using Baileys and export as Excel
app.get('/api/bulk/groups/:id/members', async (req, res) => {
    try {
        const { userId, excludeAdmins } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'userId is required'
            });
        }

        const userData = getUserData(userId);

        if (!userData.isReady || !userData.client) {
            return res.status(503).json({
                success: false,
                message: 'WhatsApp not connected. Please scan QR code first.'
            });
        }

        const groupId = decodeURIComponent(req.params.id);
        console.log(`📥 Extracting members from group: ${groupId} for user ${userId}`);
        if (excludeAdmins === 'true') {
            console.log(`⚙️ Admin exclusion enabled - will filter out group admins`);
        }

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

        console.log(`🔍 Fetching group metadata with ID: ${formattedGroupId}`);

        // Fetch group metadata using Baileys
        const groupMetadata = await userData.client.groupMetadata(formattedGroupId);

        if (!groupMetadata) {
            return res.status(404).json({
                success: false,
                message: 'Group not found. Please check the Group ID.'
            });
        }

        console.log(`✓ Found group: ${groupMetadata.subject} with ${groupMetadata.participants.length} members`);

        // DEBUG: Log raw participants data to see what Baileys returns
        console.log('\n📋 RAW PARTICIPANTS DATA:');
        console.log(JSON.stringify(groupMetadata.participants, null, 2));
        console.log('');

        // Extract members with clean data
        const members = [];
        const sock = userData.client;
        const shouldExcludeAdmins = excludeAdmins === 'true';
        let skippedAdmins = 0;
        let skippedInvalid = 0;

        // CLEAN PARTICIPANT EXTRACTION LOOP
        for (let i = 0; i < groupMetadata.participants.length; i++) {
            const participant = groupMetadata.participants[i];

            try {
                // 1. Extract the raw JID safely - CHECK phoneNumber FIRST (new WhatsApp structure)
                const participantJid = participant.phoneNumber || participant.id || participant.jid;

                if (!participantJid) {
                    console.log(`   ⚠️ [${i}] Skipped: No JID`);
                    skippedInvalid++;
                    continue;
                }

                // 2. POSITIVE FILTERING: Only keep real WhatsApp phone numbers
                // Accept: @s.whatsapp.net or @c.us (these are real phone numbers)
                // Reject: @lid (linked devices), @broadcast, anything else
                const isRealPhoneNumber = participantJid.includes('@s.whatsapp.net') || participantJid.includes('@c.us');

                if (!isRealPhoneNumber) {
                    console.log(`   ⏭️ [${i}] Skipped non-phone JID: ${participantJid}`);
                    skippedInvalid++;
                    continue;
                }

                // 3. Clean phone number to digits only
                const phoneClean = participantJid.split('@')[0].replace(/\D/g, '');
                if (!phoneClean) {
                    console.log(`   ⚠️ [${i}] Skipped: No phone after cleaning from ${participantJid}`);
                    skippedInvalid++;
                    continue;
                }

                // 4. Determine Admin Status (strictly lowercase 'yes' or 'no')
                let adminStatus = 'no';
                if (participant.admin === 'admin' || participant.admin === 'superadmin' || participant.isAdmin === true) {
                    adminStatus = 'yes';
                }

                // 5. Skip admins if exclusion enabled
                if (shouldExcludeAdmins && adminStatus === 'yes') {
                    console.log(`   ⏭️ [${i}] Skipped admin: ${phoneClean}`);
                    skippedAdmins++;
                    continue;
                }

                // 6. Resolve Name (try multiple sources, default to 'WhatsApp User')
                let displayName = null;

                // Try participant object first (notify is the pushName)
                displayName = participant.notify || participant.name;

                // Try Baileys contact store if still not found
                if (!displayName && sock.store?.contacts?.[participantJid]) {
                    displayName = sock.store.contacts[participantJid].pushName ||
                                 sock.store.contacts[participantJid].name ||
                                 sock.store.contacts[participantJid].notify;
                }

                // Final fallback to 'WhatsApp User' for professional Excel export
                if (!displayName) {
                    displayName = 'WhatsApp User';
                }

                // 7. Add to members array
                members.push({
                    name: displayName,
                    phone: phoneClean,
                    isAdmin: adminStatus
                });

                console.log(`   ✅ [${i}] Added: ${displayName} | ${phoneClean} | Admin: ${adminStatus}`);

            } catch (participantError) {
                console.error(`   ❌ Error processing participant at index ${i}:`, participantError.message);
                skippedInvalid++;
                continue;
            }
        }

        console.log(`\n📊 EXTRACTION COMPLETE:`);
        console.log(`   Total participants in group: ${groupMetadata.participants.length}`);
        console.log(`   Valid phone numbers extracted: ${members.length}`);
        console.log(`   Admins skipped: ${skippedAdmins}`);
        console.log(`   Invalid/linked devices skipped: ${skippedInvalid}`);

        // IMPORTANT: Return 200 OK even if empty - don't crash frontend
        if (members.length === 0) {
            console.log('⚠️ No real WhatsApp phone numbers found');
            return res.status(200).json({
                success: true,
                data: [],
                message: 'WhatsApp has hidden the real numbers in this group. Only linked devices were found.'
            });
        }

        if (shouldExcludeAdmins && skippedAdmins > 0) {
            console.log(`✅ Excluded ${skippedAdmins} admin(s) from export`);
        }

        console.log(`✅ Successfully extracted ${members.length} members from ${groupMetadata.subject}`);

        // CREATE EXCEL FILE USING EXCELJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Group Members');

        // Define columns
        worksheet.columns = [
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Phone', key: 'phone', width: 20 },
            { header: 'IsAdmin', key: 'isAdmin', width: 10 }
        ];

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        // Add data rows with explicit TEXT formatting for phone column
        members.forEach((member) => {
            const row = worksheet.addRow({
                name: member.name,
                phone: member.phone,
                isAdmin: member.isAdmin
            });

            // CRITICAL: Set Phone column (column 2) to TEXT format
            row.getCell(2).numFmt = '@'; // '@' = TEXT format in Excel
            row.getCell(2).value = member.phone; // Ensure it's set as string
        });

        // SAVE FILE TO EXACT WINDOWS PATH: C:\Users\kk\Desktop\whatsapptool\zero____members.xlsx
        const savePath = 'C:\\Users\\kk\\Desktop\\whatsapptool\\zero____members.xlsx';
        const saveDir = path.dirname(savePath);

        // Ensure directory exists
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
            console.log(`📁 Created directory: ${saveDir}`);
        }

        // Write file to disk
        try {
            await workbook.xlsx.writeFile(savePath);
            console.log(`💾 Excel file saved to: ${savePath}`);
        } catch (saveError) {
            console.error(`⚠️ Error saving file to disk: ${saveError.message}`);
            // Continue anyway - streaming response will still work
        }

        // Generate Excel file buffer for streaming response
        const buffer = await workbook.xlsx.writeBuffer();

        // Set response headers for Excel file download
        const sanitizedGroupName = groupMetadata.subject.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${sanitizedGroupName}_members.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);

        console.log(`📤 Sending Excel file to browser: ${filename} (${buffer.length} bytes)`);

        // Send the Excel file to browser
        res.send(buffer);

    } catch (error) {
        console.error('❌ Error extracting group members:', error);

        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes('not-authorized') || error.message.includes('forbidden')) {
            errorMessage = 'Not authorized to access this group. Make sure you are a member.';
        } else if (error.message.includes('item-not-found') || error.message.includes('not found')) {
            errorMessage = 'Group not found. Make sure the Group ID is correct and you are a member of this group.';
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
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                connected: false,
                ready: false,
                hasQRCode: false,
                message: 'Authentication required. userId is missing.',
                error: 'userId parameter is required'
            });
        }

        // Get user-specific WhatsApp client data
        const userData = getUserData(userId);

        res.status(200).json({
            success: true,
            connected: userData.isReady,
            ready: userData.isReady,
            hasQRCode: false,
            message: userData.isReady ? 'WhatsApp connected' : 'WhatsApp not connected'
        });
    } catch (error) {
        console.error('❌ Error in /api/bulk/whatsapp/status:', error);
        // ALWAYS return JSON, never let it throw HTML
        res.status(500).json({
            success: false,
            connected: false,
            ready: false,
            hasQRCode: false,
            message: 'Internal server error',
            error: error.message
        });
    }
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

// ===== LIVE WHATSAPP NUMBER VALIDATOR =====
// Bulk validate WhatsApp numbers with rate limiting
app.post('/api/validator/bulk-validate', bulkUpload.single('file'), async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'userId is required'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        console.log(`📋 Bulk validation request from user ${userId}`);
        console.log(`   File: ${req.file.originalname} (${req.file.size} bytes)`);

        // Get user's WhatsApp client
        const userData = getUserData(userId);
        if (!userData.isReady || !userData.client) {
            return res.status(503).json({
                success: false,
                message: 'WhatsApp is not connected. Please scan QR code first.'
            });
        }

        // Parse file (CSV or Excel)
        let numbers = [];
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        if (fileExt === '.csv') {
            // Parse CSV
            const csvContent = req.file.buffer.toString('utf-8');
            const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

            // Skip header if present
            const startIndex = lines[0].toLowerCase().includes('phone') || lines[0].toLowerCase().includes('number') ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    // Extract first column (phone number)
                    const parts = line.split(',');
                    const phone = parts[0].replace(/[^0-9]/g, '');
                    if (phone.length >= 7) {
                        numbers.push(phone);
                    }
                }
            }
        } else if (fileExt === '.xlsx' || fileExt === '.xls') {
            // Parse Excel using XLSX library
            const XLSX = require('xlsx');
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Skip header if present
            const startIndex = data[0] && (String(data[0][0]).toLowerCase().includes('phone') || String(data[0][0]).toLowerCase().includes('number')) ? 1 : 0;

            for (let i = startIndex; i < data.length; i++) {
                if (data[i] && data[i][0]) {
                    const phone = String(data[i][0]).replace(/[^0-9]/g, '');
                    if (phone.length >= 7) {
                        numbers.push(phone);
                    }
                }
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid file format. Please upload CSV or Excel file.'
            });
        }

        // Remove duplicates
        numbers = [...new Set(numbers)];

        console.log(`✓ Parsed ${numbers.length} unique numbers from file`);

        if (numbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid phone numbers found in file'
            });
        }

        // Send immediate response
        res.json({
            success: true,
            message: 'Validation started',
            totalNumbers: numbers.length
        });

        // Start validation in background
        (async () => {
            console.log(`\n🚀 Starting bulk validation for user ${userId}`);
            console.log(`📊 Total numbers to validate: ${numbers.length}`);
            console.log(`🔌 WhatsApp Client Status: ${userData.isReady ? 'READY' : 'NOT READY'}`);
            console.log(`👤 WhatsApp User: ${userData.clientInfo?.name || 'Unknown'}`);

            let processed = 0;
            let valid = 0;
            let invalid = 0;
            const validNumbers = [];
            const invalidNumbers = [];

            for (let i = 0; i < numbers.length; i++) {
                const number = numbers[i];
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${i + 1}/${numbers.length}] Validating Number`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`📱 Raw Input: "${number}"`);

                try {
                    // ===== STEP 1: NORMALIZE PHONE NUMBER =====
                    console.log(`\n🔧 NORMALIZATION STARTED`);
                    let formattedNumber = number;

                    // Remove all non-numeric characters
                    formattedNumber = formattedNumber.replace(/[^0-9]/g, '');
                    console.log(`   Step 1 - Digits Only: "${formattedNumber}"`);

                    // Pakistani number handling: remove leading 0, add 92
                    if (formattedNumber.startsWith('0')) {
                        formattedNumber = '92' + formattedNumber.substring(1);
                        console.log(`   Step 2 - Pakistani Format Applied: "${formattedNumber}"`);
                    }

                    // Ensure country code (default to Pakistan if 10 digits)
                    if (formattedNumber.length === 10 && !formattedNumber.startsWith('92')) {
                        formattedNumber = '92' + formattedNumber;
                        console.log(`   Step 3 - Country Code Added: "${formattedNumber}"`);
                    }

                    // Validation: Check if normalized number has valid length (11-15 digits)
                    if (formattedNumber.length < 11 || formattedNumber.length > 15) {
                        console.log(`   ❌ Invalid length: ${formattedNumber.length} digits (expected 11-15)`);
                        throw new Error(`Invalid phone number length: ${formattedNumber.length} digits`);
                    }

                    // Create international format with '+' prefix (for display/logging only)
                    const internationalNumber = '+' + formattedNumber;
                    console.log(`   Step 4 - International Format: "${internationalNumber}"`);
                    console.log(`✅ NORMALIZATION COMPLETE\n`);

                    // ===== STEP 2: CREATE WHATSAPP JID =====
                    console.log(`🎯 JID CREATION`);
                    // Create JID for Baileys (WhatsApp uses @s.whatsapp.net for regular numbers)
                    // IMPORTANT: JID does NOT include '+' prefix - just digits + domain
                    const jid = formattedNumber + '@s.whatsapp.net';
                    console.log(`   JID: "${jid}"`);
                    console.log(`   Format: [DIGITS]@s.whatsapp.net (no '+' prefix)\n`);

                    // ===== STEP 3: VERIFY CLIENT STATE =====
                    console.log(`🔍 CLIENT STATE VERIFICATION`);
                    console.log(`   userData.client exists: ${!!userData.client}`);
                    console.log(`   userData.isReady: ${userData.isReady} ⬅️ CRITICAL STATUS`);
                    console.log(`   userData.isInitializing: ${userData.isInitializing}`);

                    if (!userData.client) {
                        console.error(`   ❌ userData.client is NULL - no WhatsApp client instance`);
                        throw new Error('WhatsApp client is null');
                    }

                    if (!userData.isReady) {
                        console.error(`   ❌ userData.isReady is FALSE - client not ready`);
                        throw new Error('WhatsApp client not ready');
                    }

                    console.log(`   ✅ Client is ready and available`);
                    console.log(`   Client User ID: ${userData.client.user?.id || 'Unknown'}`);
                    console.log(`   Client User Name: ${userData.client.user?.name || 'Unknown'}\n`);

                    // ===== STEP 4: CALL BAILEYS API (WITH RETRY LOGIC - UP TO 2 RETRIES) =====
                    const MAX_RETRIES = 2;
                    let retryCount = 0;
                    let result = null;
                    let lastError = null;
                    let isLibraryInternalError = false;

                    // ===== CRITICAL: Validate JID is a string before calling API =====
                    console.log(`🔒 JID TYPE VALIDATION`);
                    console.log(`   JID value: "${jid}"`);
                    console.log(`   JID type: ${typeof jid}`);
                    console.log(`   JID is string: ${typeof jid === 'string'}`);

                    if (typeof jid !== 'string') {
                        console.error(`   ❌ CRITICAL: JID is not a string! Type: ${typeof jid}`);
                        throw new Error(`Invalid JID type: expected string, got ${typeof jid}`);
                    }

                    if (!jid || jid.trim() === '') {
                        console.error(`   ❌ CRITICAL: JID is empty or whitespace-only!`);
                        throw new Error('JID is empty');
                    }

                    console.log(`   ✅ JID type validation passed\n`);

                    while (retryCount <= MAX_RETRIES && !result && !isLibraryInternalError) {
                        try {
                            const attemptNum = retryCount + 1;
                            console.log(`📡 BAILEYS API CALL (ATTEMPT ${attemptNum}/${MAX_RETRIES + 1})`);
                            console.log(`   Method: userData.client.onWhatsApp()`);
                            console.log(`   Parameter: ${jid} (normalized JID string)`);
                            console.log(`   Calling API...`);

                            // ===== ROBUST TRY-CATCH: Wrap onWhatsApp call to catch library internal errors =====
                            let apiResult = null;
                            try {
                                // ===== STEP 1: Normalize JID using Baileys utility =====
                                const normalizedJid = safeNormalizeJid(jid);

                                // ===== STEP 2: Call onWhatsApp with normalized JID =====
                                // Check if number is on WhatsApp using Baileys
                                // FIXED: onWhatsApp() expects a string JID, not an array
                                const startTime = Date.now();
                                apiResult = await userData.client.onWhatsApp(normalizedJid);
                                const duration = Date.now() - startTime;

                                console.log(`   ✅ API call completed in ${duration}ms`);
                                console.log(`   Response received: ${!!apiResult}`);
                                console.log(`   Response type: ${typeof apiResult}`);
                                console.log(`   Is array: ${Array.isArray(apiResult)}`);
                                console.log(`   Array length: ${apiResult?.length || 0}`);

                                result = apiResult;

                                if (result && result.length > 0) {
                                    console.log(`   First result: exists=${result[0]?.exists}`);
                                }

                            } catch (internalError) {
                                // ===== HANDLE BAILEYS LIBRARY INTERNAL ERRORS =====
                                console.error(`\n⚠️  BAILEYS LIBRARY INTERNAL ERROR DETECTED`);
                                console.error(`   Error Type: ${internalError.constructor.name}`);
                                console.error(`   Error Message: ${internalError.message}`);

                                // Check if it's a TypeError (jid?.endsWith is not a function, etc.)
                                if (internalError instanceof TypeError) {
                                    console.error(`   🔴 TypeError detected - likely Baileys internal bug`);
                                    console.error(`   Common causes:`);
                                    console.error(`     - jid?.endsWith is not a function`);
                                    console.error(`     - Unexpected data type passed to internal function`);
                                    console.error(`     - Baileys library version incompatibility`);
                                    console.error(`\n   Full Error Stack:`);
                                    console.error(`   ${internalError.stack}`);

                                    // Mark as library internal error and skip retries
                                    isLibraryInternalError = true;
                                    lastError = internalError;

                                    console.error(`\n   ⚠️  Marking number as 'Unknown' due to library internal error`);
                                    console.error(`   This number will NOT be retried to avoid repeated crashes\n`);
                                    break; // Exit retry loop immediately
                                }

                                // For non-TypeError errors, treat as regular API error and retry
                                throw internalError;
                            }

                            // If exists=false on first attempt, try one more time after 500ms
                            if (attemptNum === 1 && result && result.length > 0 && result[0].exists === false) {
                                console.log(`⚠️  RETRY TRIGGERED - First attempt returned exists=false`);
                                console.log(`   Waiting 500ms for socket to stabilize...`);
                                await new Promise(resolve => setTimeout(resolve, 500));

                                console.log(`📡 BAILEYS API CALL (ATTEMPT 2 - SOCKET STABILIZATION RETRY)`);
                                console.log(`   userData.isReady: ${userData.isReady} ⬅️ RE-CHECKING STATUS`);

                                if (!userData.isReady) {
                                    throw new Error('WhatsApp client disconnected during retry');
                                }

                                console.log(`   Calling API again...`);
                                const startTime2 = Date.now();

                                // ===== WRAP SOCKET STABILIZATION RETRY IN TRY-CATCH =====
                                try {
                                    // Normalize JID before retry attempt
                                    const normalizedJidRetry = safeNormalizeJid(jid);
                                    result = await userData.client.onWhatsApp(normalizedJidRetry);
                                } catch (retryInternalError) {
                                    if (retryInternalError instanceof TypeError) {
                                        console.error(`   🔴 TypeError on socket stabilization retry - marking as library error`);
                                        isLibraryInternalError = true;
                                        lastError = retryInternalError;
                                        break;
                                    }
                                    throw retryInternalError;
                                }

                                const duration2 = Date.now() - startTime2;

                                console.log(`   ✅ Socket stabilization retry completed in ${duration2}ms`);
                                console.log(`   Retry result: exists=${result?.[0]?.exists}\n`);
                            } else {
                                console.log(`✓ Attempt ${attemptNum} succeeded\n`);
                            }

                            // Success - break out of retry loop
                            break;

                        } catch (apiError) {
                            lastError = apiError;
                            retryCount++;

                            console.error(`❌ API CALL FAILED (Attempt ${retryCount}/${MAX_RETRIES + 1})`);
                            console.error(`   Error Type: ${apiError.constructor.name}`);
                            console.error(`   Error Message: ${apiError.message}`);
                            console.error(`   Error Code: ${apiError.code || 'N/A'}`);

                            // Log full error object for debugging
                            console.error(`   Full Error Object:`, JSON.stringify({
                                name: apiError.name,
                                message: apiError.message,
                                code: apiError.code,
                                statusCode: apiError.statusCode,
                                data: apiError.data
                            }, null, 2));

                            if (retryCount <= MAX_RETRIES) {
                                const retryDelay = retryCount * 1000; // 1s, 2s for retries
                                console.log(`   ⏳ Waiting ${retryDelay}ms before retry ${retryCount}...\n`);
                                await new Promise(resolve => setTimeout(resolve, retryDelay));
                            } else {
                                console.error(`   ❌ Max retries (${MAX_RETRIES}) exhausted. Marking as error.\n`);
                            }
                        }
                    }

                    // ===== STEP 5: PARSE RAW RESPONSE =====
                    if (result) {
                        console.log(`📦 RAW API RESPONSE ANALYSIS`);
                        console.log(`   Response received: ${!!result}`);
                        console.log(`   Response type: ${typeof result}`);
                        console.log(`   Is array: ${Array.isArray(result)}`);
                        console.log(`   Array length: ${result?.length || 0}`);
                        console.log(`\n   Full Response Object:`);
                        console.log(`   ${JSON.stringify(result, null, 2)}`);

                        if (result && Array.isArray(result) && result.length > 0) {
                            console.log(`\n   First Element Details:`);
                            console.log(`   - Type: ${typeof result[0]}`);
                            console.log(`   - Keys: ${Object.keys(result[0] || {}).join(', ')}`);
                            console.log(`   - result[0].exists: ${result[0].exists}`);
                            console.log(`   - result[0].jid: ${result[0].jid}`);
                            console.log(`   - result[0].jid type: ${typeof result[0].jid}`);
                        } else {
                            console.log(`\n   ⚠️  Empty or invalid response structure`);
                        }
                    }

                    // ===== STEP 6: VALIDATE AND CATEGORIZE =====
                    console.log(`\n🎯 VALIDATION DECISION`);

                    // PRIORITY 1: Handle Baileys library internal errors (TypeError)
                    if (isLibraryInternalError && lastError) {
                        console.log(`   ⚠️  UNKNOWN - Baileys library internal error`);
                        console.log(`   - Error Type: ${lastError.constructor.name}`);
                        console.log(`   - Error Message: ${lastError.message}`);
                        console.log(`   - Original: ${number}`);
                        console.log(`   - Normalized: ${formattedNumber}`);
                        console.log(`   - Status: Marked as UNKNOWN (not retried to prevent crashes)`);

                        invalid++;
                        invalidNumbers.push({
                            phone: number,
                            formatted: formattedNumber,
                            international: internationalNumber,
                            status: 'unknown',
                            errorCategory: 'Library Internal Error',
                            reason: `Baileys TypeError: ${lastError.message}`,
                            technicalDetails: 'This is likely a bug in the Baileys library or version incompatibility'
                        });

                    // PRIORITY 2: STRICT VALIDATION - Only mark as valid if API explicitly returns exists=true
                    } else if (result && Array.isArray(result) && result.length > 0 && result[0].exists === true) {
                        console.log(`   ✅ VALID - Number is registered on WhatsApp`);
                        console.log(`   - Original: ${number}`);
                        console.log(`   - Normalized: ${formattedNumber}`);
                        console.log(`   - International: ${internationalNumber}`);
                        console.log(`   - JID: ${result[0].jid}`);

                        valid++;
                        validNumbers.push({
                            phone: number,
                            formatted: formattedNumber,
                            international: internationalNumber,
                            status: 'valid',
                            jid: result[0].jid
                        });
                    } else if (!result && lastError) {
                        // API call failed after all retries - categorize the error
                        let errorCategory = 'API Error';
                        let errorReason = lastError.message;

                        // Categorize common error types
                        if (lastError.message.includes('rate') || lastError.message.includes('429')) {
                            errorCategory = 'Rate Limiting';
                            errorReason = 'Too many requests - rate limited by WhatsApp';
                        } else if (lastError.message.includes('timeout') || lastError.message.includes('ETIMEDOUT')) {
                            errorCategory = 'Timeout';
                            errorReason = 'API request timed out';
                        } else if (lastError.message.includes('network') || lastError.message.includes('ENOTFOUND')) {
                            errorCategory = 'Network Error';
                            errorReason = 'Network connection issue';
                        } else if (lastError.message.includes('client') || lastError.message.includes('disconnected')) {
                            errorCategory = 'Client Error';
                            errorReason = 'WhatsApp client disconnected';
                        }

                        console.log(`   ❌ ERROR - API call failed after ${MAX_RETRIES} retries`);
                        console.log(`   - Category: ${errorCategory}`);
                        console.log(`   - Reason: ${errorReason}`);
                        console.log(`   - Original: ${number}`);
                        console.log(`   - Normalized: ${formattedNumber}`);

                        invalid++;
                        invalidNumbers.push({
                            phone: number,
                            formatted: formattedNumber,
                            international: internationalNumber,
                            status: 'error',
                            errorCategory: errorCategory,
                            reason: errorReason
                        });
                    } else {
                        // API returned a response but exists=false or invalid structure
                        const reason = !result ? 'No response from API'
                                     : !Array.isArray(result) ? 'Response is not an array'
                                     : result.length === 0 ? 'Empty array returned'
                                     : result[0].exists === false ? 'Not registered on WhatsApp'
                                     : result[0].exists === undefined ? 'Missing exists field in response'
                                     : 'Unknown reason';

                        console.log(`   ❌ INVALID - Number not on WhatsApp`);
                        console.log(`   - Reason: ${reason}`);
                        console.log(`   - Original: ${number}`);
                        console.log(`   - Normalized: ${formattedNumber}`);

                        invalid++;
                        invalidNumbers.push({
                            phone: number,
                            formatted: formattedNumber,
                            international: internationalNumber,
                            status: 'invalid',
                            reason: reason
                        });
                    }

                } catch (error) {
                    // Catch normalization errors or other pre-API errors
                    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.error(`❌ PRE-VALIDATION ERROR for ${number}`);
                    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.error(`Error Type: ${error.constructor.name}`);
                    console.error(`Error Message: ${error.message}`);
                    console.error(`Error Stack:`, error.stack);

                    invalid++;
                    invalidNumbers.push({
                        phone: number,
                        status: 'error',
                        errorCategory: 'Format Error',
                        reason: error.message
                    });
                }

                processed++;

                // Emit progress update via Socket.IO
                io.to(userId).emit('validator:progress', {
                    processed,
                    valid,
                    invalid,
                    total: numbers.length,
                    currentNumber: number,
                    timestamp: new Date().toISOString()
                });

                // Random delay between 8-15 seconds to avoid bans
                if (i < numbers.length - 1) {
                    const delay = Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000;
                    console.log(`   ⏳ Waiting ${(delay / 1000).toFixed(1)}s before next validation...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            console.log(`\n✅ Validation complete for user ${userId}`);
            console.log(`📊 Results: Valid=${valid}, Invalid=${invalid}, Total=${numbers.length}`);

            // Emit completion event with results
            io.to(userId).emit('validator:complete', {
                processed,
                valid,
                invalid,
                total: numbers.length,
                validNumbers,
                invalidNumbers,
                timestamp: new Date().toISOString()
            });

        })();

    } catch (error) {
        console.error('❌ Error in bulk validation:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== END BULK SENDER API ROUTES =====

// ===== SOCKET.IO CONNECTION WITH AUTHENTICATION =====
io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
        console.error('❌ Socket connection rejected: No userId provided');
        socket.emit('whatsapp:error', {
            error: 'Authentication required. Please refresh the page.',
            timestamp: new Date().toISOString()
        });
        socket.disconnect();
        return;
    }

    console.log(`🔌 Client connected: ${socket.id} for user: ${userId}`);

    // Join user-specific room for targeted emissions
    socket.join(userId);
    console.log(`✓ Socket ${socket.id} joined room: ${userId}`);

    // Get user-specific data
    const userData = getUserData(userId);
    const stats = getUserStats(userId);

    // IMMEDIATE RE-EMISSION: If QR code is cached, send it immediately
    if (userData.lastQRCode && !userData.isReady) {
        console.log(`📤 Re-emitting cached QR code to newly connected socket for user ${userId}`);
        socket.emit('whatsapp:qr', userData.lastQRCode);
    }

    // IMMEDIATE STATUS EMISSION: Send current WhatsApp status
    socket.emit('whatsapp:status', {
        connected: userData.isReady,
        info: userData.clientInfo,
        timestamp: new Date().toISOString()
    });

    // If connected and ready, send ready status immediately
    if (userData.isReady && userData.clientInfo) {
        console.log(`✓ User ${userId} already connected - sending ready status`);
        socket.emit('whatsapp:ready', {
            status: 'connected',
            info: userData.clientInfo,
            timestamp: new Date().toISOString()
        });
    }

    // FORCE WhatsApp client initialization for authenticated Supabase userIds
    // Only initialize if no client exists and not already initializing
    if (!userData.client && !userData.isInitializing) {
        console.log(`🔄 Force-initializing WhatsApp client for authenticated user: ${userId}`);
        initializeWhatsAppClient(userId);
    } else if (userData.isInitializing) {
        console.log(`⏳ WhatsApp client already initializing for user ${userId}`);
    } else if (userData.client && !userData.isReady) {
        console.log(`⏳ WhatsApp client exists but not ready yet for user ${userId}`);
    }

    // Send AI agent status (currently global, can be per-user in future)
    socket.emit('ai-agent:status', {
        enabled: aiAgentEnabled
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id} for user: ${userId}`);
    });

    // Handle manual reconnect request
    socket.on('whatsapp:reconnect', () => {
        console.log(`🔄 Manual reconnect requested for user ${userId}`);

        // Prevent reconnect if already initializing
        if (userData.isInitializing) {
            console.log(`⚠️ Already initializing for user ${userId}, ignoring reconnect request`);
            socket.emit('whatsapp:error', {
                error: 'Client is already initializing',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Reset reconnect attempts for manual reconnect
        userData.reconnectAttempts = 0;

        if (userData.client) {
            console.log(`🗑️ Destroying existing client for user ${userId} before reconnect...`);
            userData.client.destroy()
                .then(() => {
                    userData.client = null;
                    userData.isReady = false;
                    console.log(`✓ Client destroyed for user ${userId}, initializing new client...`);
                    initializeWhatsAppClient(userId);
                })
                .catch(err => {
                    console.error(`⚠️ Error destroying client for user ${userId}:`, err.message);
                    userData.client = null;
                    userData.isReady = false;
                    initializeWhatsAppClient(userId);
                });
        } else {
            console.log(`🔄 No existing client for user ${userId}, initializing new one...`);
            initializeWhatsAppClient(userId);
        }
    });
});

// ===== EXPORT CLIENT FOR OTHER MODULES =====
function getWhatsAppClient(userId) {
    if (!userId) {
        console.warn('⚠️ getWhatsAppClient called without userId');
        return null;
    }
    const userData = getUserData(userId);
    if (userData.isReady && userData.client) {
        return userData.client;
    }
    return null;
}

function isWhatsAppReady(userId) {
    if (!userId) return false;
    const userData = getUserData(userId);
    return userData.isReady;
}

const PORT = process.env.PORT || 7860;

// ===== LOAD CONTACT CACHE ON STARTUP =====
console.log('📂 Loading contact cache from disk...');
loadContactCache();

// ===== START SERVER =====
server.listen(PORT, '0.0.0.0', async () => {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║     WhatsApp Toolkit Dashboard Server                 ║');
    console.log('║     with WhatsApp Web Integration                     ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server is successfully running on port ${PORT} and listening on 0.0.0.0`);
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
            .limit(1)
            .maybeSingle();

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

    // Note: WhatsApp clients are initialized per-user when they connect via Socket.IO
    console.log('✓ Multi-user WhatsApp client system ready');
    console.log('💡 Clients will be initialized when users connect to the dashboard');

    // Initialize bulk sender service with WhatsApp clients and Socket.IO
    const bulkSenderService = getBulkSenderService();
    bulkSenderService.initialize(whatsappClients, io);
    console.log('✓ Bulk Sender Service initialized and connected to Baileys clients');

    // Initialize whatsapp service for other backend modules
    const whatsappService = require('./backend/services/whatsappService');
    whatsappService.initialize(whatsappClients, io);
    console.log('✓ WhatsApp Service initialized and accessible to backend modules');
});

// Handle server errors (non-fatal for HF deployment)
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use`);
        console.error('   Please stop the other server or use a different port');
    } else {
        console.error('❌ Server error:', error);
    }
    // Don't exit - let HF handle the restart
    console.log('⚠️ Server error logged but continuing...');
});

    // Graceful Shutdown disabled for Hugging Face
    // SIGINT can be triggered by HF health checks
    /*
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down WhatsApp clients...');

        // Destroy all user clients
        for (const [userId, userData] of whatsappClients.entries()) {
            if (userData.client) {
                try {
                    console.log(`🗑️ Destroying client for user ${userId}...`);
                    await userData.client.destroy();
                    console.log(`✅ Client closed for user ${userId}`);
                } catch (err) {
                    console.error(`❌ Error closing client for user ${userId}:`, err);
                }
            }
        }

        console.log('✅ All WhatsApp clients closed');
        process.exit(0);
    });
    */

    // Handle termination (disabled for Hugging Face deployment)
    // SIGTERM can be triggered by HF health checks, causing premature shutdowns
    // Uncomment only if you need graceful shutdown in production
    /*
    process.on('SIGTERM', async () => {
        console.log('\n\n👋 Shutting down WhatsApp clients...');

        // Destroy all user clients
        for (const [userId, userData] of whatsappClients.entries()) {
            if (userData.client) {
                try {
                    console.log(`🗑️ Destroying client for user ${userId}...`);
                    await userData.client.destroy();
                    console.log(`✅ Client closed for user ${userId}`);
                } catch (err) {
                    console.error(`❌ Error closing client for user ${userId}:`, err);
                }
            }
        }

        console.log('✅ All WhatsApp clients closed');
        process.exit(0);
    });
    */

    // Error handlers to prevent crashes
    process.on('uncaughtException', (err) => {
        console.error('⚠️ Uncaught Exception:', err);
        // Don't exit - keep server running
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('⚠️ Unhandled Rejection at', promise, 'reason:', reason);
        // Don't exit - keep server running
    });

    console.log('✅ Error handlers configured to keep server alive');

// Export for use in other modules
module.exports = {
    getWhatsAppClient,
    isWhatsAppReady,
    whatsappClients,
    io,
    app
};
