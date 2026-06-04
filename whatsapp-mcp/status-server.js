import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Enable JSON body parsing
app.use(express.json());

// Enable CORS for dashboard
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Status endpoint
// Initialize WhatsApp client for group operations
import WhatsAppClient from './whatsapp-client.js';
const waClient = new WhatsAppClient();
waClient.initialize().catch(err => console.error('WhatsApp client init error:', err));
app.get('/status', (req, res) => {
    try {
        // Read deals.json
        const dealsPath = path.join(__dirname, 'deals.json');
        let deals = [];

        if (fs.existsSync(dealsPath)) {
            const dealsData = fs.readFileSync(dealsPath, 'utf8');
            deals = JSON.parse(dealsData);
        }

        // Calculate statistics
        const totalDeals = deals.length;
        const pendingDeals = deals.filter(d => d.status === 'pending').length;
        const completedDeals = deals.filter(d => d.status === 'completed').length;

        // Count today's deals
        const today = new Date().toISOString().split('T')[0];
        const todayDeals = deals.filter(d => {
            const dealDate = new Date(d.dateTime).toISOString().split('T')[0];
            return dealDate === today;
        }).length;

        // Check if agent is online by looking for .wwebjs_auth folder
        const authPath = path.join(__dirname, '.wwebjs_auth');
        const agentOnline = fs.existsSync(authPath);

        // Count messages replied (total deals for now)
        const messagesReplied = totalDeals;

        // BUG FIX 3: Read validator CSV files from correct path
        let validCount = 0;
        let invalidCount = 0;

        // Path to whatsapptool root folder (parent of whatsapp-mcp)
        const rootPath = path.join(__dirname, '..');
        const validCsvPath = path.join(rootPath, 'valid.csv');
        const invalidCsvPath = path.join(rootPath, 'invalid.csv');

        try {
            if (fs.existsSync(validCsvPath)) {
                const validData = fs.readFileSync(validCsvPath, 'utf8');
                const validLines = validData.split('\n').filter(line => line.trim());
                validCount = Math.max(0, validLines.length - 1); // Subtract header row
            }
        } catch (error) {
            console.log('valid.csv not found or empty');
        }

        try {
            if (fs.existsSync(invalidCsvPath)) {
                const invalidData = fs.readFileSync(invalidCsvPath, 'utf8');
                const invalidLines = invalidData.split('\n').filter(line => line.trim());
                invalidCount = Math.max(0, invalidLines.length - 1); // Subtract header row
            }
        } catch (error) {
            console.log('invalid.csv not found or empty');
        }

        const numbersValidated = validCount + invalidCount;

        res.json({
            agent_online: agentOnline,
            total_deals: totalDeals,
            pending_deals: pendingDeals,
            completed_deals: completedDeals,
            today_deals: todayDeals,
            messages_replied: messagesReplied,
            numbers_validated: numbersValidated,
            valid_numbers: validCount,
            invalid_numbers: invalidCount
        });
    } catch (error) {
        console.error('Error reading deals:', error);
        res.json({
            agent_online: false,
            total_deals: 0,
            pending_deals: 0,
            completed_deals: 0,
            today_deals: 0,
            messages_replied: 0,
            numbers_validated: 0,
            valid_numbers: 0,
            invalid_numbers: 0
        });
    }
});

// Deals endpoint - return full deals list
app.get('/deals', (req, res) => {
    try {
        const dealsPath = path.join(__dirname, 'deals.json');

        if (fs.existsSync(dealsPath)) {
            const dealsData = fs.readFileSync(dealsPath, 'utf8');
            const deals = JSON.parse(dealsData);
            res.json(deals);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error reading deals:', error);
        res.json([]);
    }
});

// Start agent endpoint
app.post('/start', (req, res) => {
    try {
        console.log('📱 Start agent request received');
        // In a real implementation, this would start the WhatsApp agent process
        // For now, we'll just acknowledge the request
        res.json({
            success: true,
            message: 'Agent start command received',
            agent_online: true
        });
    } catch (error) {
        console.error('Error starting agent:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start agent',
            error: error.message
        });
    }
});

// Stop agent endpoint
app.post('/stop', (req, res) => {
    try {
        console.log('🛑 Stop agent request received');
        // In a real implementation, this would stop the WhatsApp agent process
        // For now, we'll just acknowledge the request
        res.json({
            success: true,
            message: 'Agent stop command received',
            agent_online: false
        });
    } catch (error) {
        console.error('Error stopping agent:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop agent',
            error: error.message
        });
    }
});

// New Group endpoints
app.get('/groups', async (req, res) => {
  try {
    const groups = await waClient.getAllGroups();
    res.json(groups);
  } catch (e) {
    console.error('Error fetching groups:', e);
    res.status(500).json({error: e.message});
  }
});

app.get('/group-members/:groupId', async (req, res) => {
  try {
    let groupId = req.params.groupId;

    // Fix ID Logic: If groupId is a name, find the JID
    if (!groupId.endsWith('@g.us')) {
      const groups = await waClient.getAllGroups();
      const group = groups.find(g =>
        g.name.toLowerCase() === groupId.toLowerCase() || g.id === groupId
      );
      if (group) {
        groupId = group.id;
      }
    }

    // Debug Logs: Print the final JID
    console.log(`Final Group JID: ${groupId}`);

    const members = await waClient.getGroupMembers(groupId);
    // Transform to name/phone if needed
    const formatted = members.map(p => {
      const userId = p.id ? p.id.split('@')[0] : null;
      return { name: userId, phone: userId };
    });
    res.json(formatted);
  } catch (e) {
    console.error('Error fetching group members:', e);
    res.status(500).json({error: e.message});
  }
});

app.listen(PORT, () => {
    console.log(`📊 Status server running on http://localhost:${PORT}`);
    console.log(`📍 Endpoints:`);
    console.log(`   - GET /status - Dashboard statistics`);
    console.log(`   - GET /deals - Full deals list`);
});
