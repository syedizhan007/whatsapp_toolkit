const express = require('express');
const cors = require('cors');
const CampaignManager = require('./campaign-manager');
const chalk = require('chalk');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Global campaign manager instance
let campaignManager = null;
let isInitialized = false;

// Initialize campaign manager
async function initialize() {
    if (isInitialized) return;

    console.log(chalk.blue('🔄 Initializing Bulk Sender API Server...'));
    campaignManager = new CampaignManager();

    // Initialize in background - don't block server startup
    campaignManager.initialize().then(() => {
        isInitialized = true;
        console.log(chalk.green('✓ Campaign Manager initialized'));
    }).catch(error => {
        console.error(chalk.red('❌ Failed to initialize Campaign Manager:'), error);
    });
}

// API Endpoints

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        initialized: isInitialized,
        timestamp: new Date().toISOString()
    });
});

// Get all campaigns
app.get('/api/campaign/list', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ success: false, error: 'Server not initialized' });
        }

        const campaigns = campaignManager.getCampaigns();
        res.json({
            success: true,
            campaigns: campaigns.map(c => ({
                id: c.id,
                name: c.name,
                status: c.status,
                created: c.created_at,
                sent: c.sent_count,
                failed: c.failed_count,
                pending: c.pending_count,
                total: c.total_contacts
            }))
        });
    } catch (error) {
        console.error('Error listing campaigns:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get campaign status
app.get('/api/campaign/status/:id', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ success: false, error: 'Server not initialized' });
        }

        const campaign = campaignManager.db.getCampaign(req.params.id);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        res.json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                message: campaign.message,
                created: campaign.created_at,
                sent: campaign.sent_count,
                failed: campaign.failed_count,
                pending: campaign.pending_count,
                total: campaign.total_contacts
            }
        });
    } catch (error) {
        console.error('Error getting campaign status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new campaign
app.post('/api/campaign/create', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ success: false, error: 'Server not initialized' });
        }

        const { name, message, contacts } = req.body;

        if (!name || !message || !contacts || !Array.isArray(contacts)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, message, contacts (array)'
            });
        }

        // Create campaign
        const campaignId = await campaignManager.createCampaign(name, message, contacts);

        console.log(chalk.green(`✓ Campaign created: ${name} (ID: ${campaignId})`));

        res.json({
            success: true,
            campaignId: campaignId,
            message: 'Campaign created successfully'
        });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start campaign
app.post('/api/campaign/start/:id', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ success: false, error: 'Server not initialized' });
        }

        const campaignId = parseInt(req.params.id);

        // Check if campaign exists
        const campaign = campaignManager.db.getCampaign(campaignId);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        // Start campaign in background
        console.log(chalk.blue(`▶️  Starting campaign: ${campaign.name}`));

        // Start campaign asynchronously
        campaignManager.startCampaign(campaignId).catch(error => {
            console.error(chalk.red(`Error in campaign ${campaignId}:`), error);
        });

        res.json({
            success: true,
            message: `Campaign "${campaign.name}" started successfully`
        });
    } catch (error) {
        console.error('Error starting campaign:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stop campaign
app.post('/api/campaign/stop/:id', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ success: false, error: 'Server not initialized' });
        }

        const campaignId = parseInt(req.params.id);

        // Check if campaign exists
        const campaign = campaignManager.db.getCampaign(campaignId);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        // Pause campaign
        campaignManager.pauseCampaign();

        console.log(chalk.yellow(`⏸️  Stopped campaign: ${campaign.name}`));

        res.json({
            success: true,
            message: `Campaign "${campaign.name}" stopped successfully`
        });
    } catch (error) {
        console.error('Error stopping campaign:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete campaign
app.delete('/api/campaign/:id', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ success: false, error: 'Server not initialized' });
        }

        const campaignId = parseInt(req.params.id);

        campaignManager.deleteCampaign(campaignId);

        console.log(chalk.red(`🗑️  Deleted campaign ID: ${campaignId}`));

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
async function startServer() {
    try {
        // Initialize campaign manager first
        await initialize();

        // Start Express server
        app.listen(PORT, () => {
            console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║     WhatsApp Bulk Sender API Server                   ║
║     REST API for Campaign Management                  ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
            `));
            console.log(chalk.green(`🚀 API Server running on: http://localhost:${PORT}`));
            console.log(chalk.blue(`📡 API Endpoints:`));
            console.log(`   - GET  /api/health`);
            console.log(`   - GET  /api/campaign/list`);
            console.log(`   - GET  /api/campaign/status/:id`);
            console.log(`   - POST /api/campaign/create`);
            console.log(`   - POST /api/campaign/start/:id`);
            console.log(`   - POST /api/campaign/stop/:id`);
            console.log(`   - DELETE /api/campaign/:id`);
            console.log('');
            console.log(chalk.yellow('Press Ctrl+C to stop the server'));
            console.log('');
        });
    } catch (error) {
        console.error(chalk.red('❌ Failed to start server:'), error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n👋 Shutting down server...'));

    if (campaignManager) {
        await campaignManager.destroy();
    }

    console.log(chalk.green('✅ Server stopped'));
    process.exit(0);
});

// Start the server
startServer();
