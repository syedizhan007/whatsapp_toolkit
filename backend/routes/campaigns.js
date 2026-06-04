const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const campaignService = require('../services/campaignService');
const { broadcastUpdate } = require('../utils/websocket');

const router = express.Router();

// TEMPORARY: Authentication disabled for testing
// TODO: Re-enable after testing
// router.use(authenticateToken);

// GET /api/campaigns - List all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await campaignService.getAllCampaigns();
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get campaigns'
    });
  }
});

// POST /api/campaigns - Create new campaign
router.post('/', async (req, res) => {
  try {
    const { name, message, delay_min, delay_max, batch_size, batch_delay } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        success: false,
        message: 'Campaign name and message are required'
      });
    }

    const campaign = campaignService.createCampaign({
      name,
      message,
      delay_min,
      delay_max,
      batch_size,
      batch_delay
    });

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create campaign'
    });
  }
});

// GET /api/campaigns/:id - Get campaign details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = campaignService.getCampaignById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get campaign'
    });
  }
});

// POST /api/campaigns/:id/contacts - Upload contacts CSV
router.post('/:id/contacts', upload.single('csvFile'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file required'
      });
    }

    const result = await campaignService.uploadContacts(id, req.file.path);

    res.json({
      success: true,
      message: `${result.count} contacts uploaded successfully`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload contacts'
    });
  }
});

// PUT /api/campaigns/:id/start - Start campaign
router.put('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await campaignService.startCampaign(id);

    broadcastUpdate('campaign:started', { campaignId: id });

    res.json({
      success: true,
      message: 'Campaign started',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start campaign'
    });
  }
});

// PUT /api/campaigns/:id/pause - Pause campaign
router.put('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await campaignService.pauseCampaign(id);

    broadcastUpdate('campaign:paused', { campaignId: id });

    res.json({
      success: true,
      message: 'Campaign paused',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to pause campaign'
    });
  }
});

// PUT /api/campaigns/:id/resume - Resume campaign
router.put('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await campaignService.resumeCampaign(id);

    broadcastUpdate('campaign:resumed', { campaignId: id });

    res.json({
      success: true,
      message: 'Campaign resumed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resume campaign'
    });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Received stop request for campaign', id);
    const activeLoops = require('../../activeLoops');
    activeLoops[id] = false;
    await campaignService.updateCampaignStatus(id, 'STOPPED');
    broadcastUpdate('campaign:stopped', { campaignId: id });
    res.json({ success: true, message: 'Campaign stopped' });
  } catch (error) {
    console.error('Error stopping campaign:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to stop campaign' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = campaignService.deleteCampaign(id);

    res.json({
      success: true,
      message: 'Campaign deleted',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete campaign'
    });
  }
});

// GET /api/campaigns/:id/stats - Get campaign statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const stats = campaignService.getCampaignStats(id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get campaign stats'
    });
  }
});

// GET /api/campaigns/blacklist/all - Get blacklist
router.get('/blacklist/all', async (req, res) => {
  try {
    const blacklist = await campaignService.getBlacklist();
    res.json({
      success: true,
      data: blacklist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get blacklist'
    });
  }
});

// POST /api/campaigns/blacklist/add - Add to blacklist
router.post('/blacklist/add', async (req, res) => {
  try {
    const { phone, reason } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number required'
      });
    }

    const result = await campaignService.addToBlacklist(phone, reason);

    res.json({
      success: true,
      message: 'Added to blacklist',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add to blacklist'
    });
  }
});

// POST /api/campaigns/blacklist/remove - Remove from blacklist
router.post('/blacklist/remove', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number required'
      });
    }

    const result = await campaignService.removeFromBlacklist(phone);

    res.json({
      success: true,
      message: 'Removed from blacklist',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove from blacklist'
    });
  }
});

// DELETE /api/campaigns/blacklist/:phone - Remove from blacklist (alternative endpoint)
router.delete('/blacklist/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const result = await campaignService.removeFromBlacklist(phone);

    res.json({
      success: true,
      message: 'Removed from blacklist',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove from blacklist'
    });
  }
});

module.exports = router;
