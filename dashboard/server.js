// ⚠️ WARNING: This file has NOT been updated for multi-user isolation
// If this server is used, it needs the same updates as the main server.js:
// 1. Replace global whatsappClient with Map-based per-user clients
// 2. Add Socket.IO authentication with userId
// 3. Scope all data (stats, messages, deals) per user
// 4. Use io.to(userId).emit() instead of io.emit()
// See: server.js for the updated multi-user implementation

// Currently, dashboard.html connects to port 3000 (main server.js), not this file.
// This file may be legacy code or for a separate standalone dashboard instance.

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

// ===== GLOBAL WHATSAPP CLIENT (NEEDS MULTI-USER ISOLATION) =====
let whatsappClient = null;
let isClientReady = false;
let clientInfo = null;

// ===== STATISTICS TRACKING (NEEDS MULTI-USER ISOLATION) =====
let stats = {
    totalMessages: 0,
    messagesReceived: 0,
    messagesSent: 0,
    dealsLocked: 0,
    numbersValidated: 0,
    activeCampaigns: 0
};

// ===== MESSAGE HISTORY (NEEDS MULTI-USER ISOLATION) =====
let messageHistory = [];
const MAX_HISTORY = 100;

// ===== DEALS TRACKING (NEEDS MULTI-USER ISOLATION) =====
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

// REST OF THE FILE OMITTED - NEEDS MULTI-USER ISOLATION UPDATES
// See main server.js for reference implementation

console.log('⚠️ WARNING: This dashboard/server.js file has not been updated for multi-user isolation');
console.log('⚠️ If you need to use this server, please apply the same multi-user patterns from server.js');
