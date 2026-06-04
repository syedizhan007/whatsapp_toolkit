const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getInstance } = require('../services/bulkSenderService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../bulk-sender/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, documents, and common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, documents, and common files are allowed.'));
    }
  }
});

// Initialize service (lazy initialization - don't block requests)
router.use((req, res, next) => {
  try {
    const service = getInstance();
    req.bulkService = service;
    next();
  } catch (error) {
    console.error('Failed to get bulk service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bulk sender service',
      error: error.message
    });
  }
});

// Get all campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await req.bulkService.getCampaigns();
    res.json({
      success: true,
      campaigns: campaigns || []
    });
  } catch (error) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get single campaign
router.get('/campaigns/:id', (req, res) => {
  try {
    const campaign = req.bulkService.getCampaign(parseInt(req.params.id));
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
  } catch (error) {
    console.error('Error getting campaign:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Create new campaign
router.post('/campaigns', upload.array('media', 10), async (req, res) => {
  try {
    const { name, message, contacts } = req.body;

    // Validate required fields
    if (!name || !message || !contacts) {
      return res.status(400).json({
        success: false,
        message: 'Name, message, and contacts are required'
      });
    }

    // Parse contacts - handle both string and array
    let contactsList;
    try {
      if (typeof contacts === 'string') {
        contactsList = JSON.parse(contacts);
      } else if (Array.isArray(contacts)) {
        contactsList = contacts;
      } else {
        contactsList = [contacts]; // Single contact object
      }

      // Ensure it's an array
      if (!Array.isArray(contactsList)) {
        return res.status(400).json({
          success: false,
          message: 'Contacts must be an array'
        });
      }

      // Validate contacts array is not empty
      if (contactsList.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one contact is required'
        });
      }

    } catch (parseError) {
      console.error('Error parsing contacts:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid contacts format. Must be valid JSON array.'
      });
    }

    // Process uploaded media files
    const mediaFiles = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fileType = file.mimetype.startsWith('image/') ? 'image' : 'document';
        mediaFiles.push({
          path: file.path,
          type: fileType,
          originalName: file.originalname,
          forAll: true // Apply to all contacts by default
        });
      });
    }

    const result = await req.bulkService.createCampaign(name, message, contactsList, mediaFiles);

    res.json(result);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Start campaign
router.post('/campaigns/:id/start', async (req, res) => {
  try {
    const result = await req.bulkService.startCampaign(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Pause campaign
router.post('/campaigns/pause', async (req, res) => {
  try {
    const result = await req.bulkService.pauseCampaign();
    res.json(result);
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Resume campaign
router.post('/campaigns/:id/resume', async (req, res) => {
  try {
    const result = await req.bulkService.resumeCampaign(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete campaign
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const result = await req.bulkService.deleteCampaign(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Upload CSV contacts
router.post('/contacts/import', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    const result = await req.bulkService.importContactsFromCSV(req.file.path);

    // Delete uploaded CSV after import
    fs.unlinkSync(req.file.path);

    res.json(result);
  } catch (error) {
    console.error('Error importing contacts:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Export campaign results
router.get('/campaigns/:id/export', async (req, res) => {
  try {
    const result = await req.bulkService.exportResults(parseInt(req.params.id));

    // Send file for download
    res.download(result.filePath, `campaign_${req.params.id}_results.csv`, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Delete file after download
      fs.unlinkSync(result.filePath);
    });
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all WhatsApp groups
router.get('/groups', async (req, res) => {
  try {
    const groups = await req.bulkService.getAllGroups();
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
router.get('/groups/:id/members', async (req, res) => {
  try {
    const members = await req.bulkService.extractGroupMembers(req.params.id);
    res.json({
      success: true,
      members
    });
  } catch (error) {
    console.error('Error extracting group members:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Blacklist management
router.get('/blacklist', (req, res) => {
  try {
    const blacklist = req.bulkService.getBlacklist();
    res.json({
      success: true,
      blacklist: blacklist || []
    });
  } catch (error) {
    console.error('Error getting blacklist:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/blacklist', (req, res) => {
  try {
    const { phone, reason } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const result = req.bulkService.addToBlacklist(phone, reason || 'Manually added');
    res.json(result);
  } catch (error) {
    console.error('Error adding to blacklist:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.delete('/blacklist/:phone', (req, res) => {
  try {
    const result = req.bulkService.removeFromBlacklist(req.params.phone);
    res.json(result);
  } catch (error) {
    console.error('Error removing from blacklist:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get WhatsApp connection status
router.get('/whatsapp/status', (req, res) => {
  try {
    const status = req.bulkService.getWhatsAppStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.json({
      success: true,
      connected: false,
      ready: false,
      hasQRCode: false,
      message: 'Not initialized'
    });
  }
});

// Get QR code image
router.get('/whatsapp/qr', (req, res) => {
  try {
    const qrCode = req.bulkService.getQRCode();

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not available. Start a campaign first.'
      });
    }

    // Return QR code as data URL
    res.json({
      success: true,
      qrCode: qrCode
    });
  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DND Settings
let dndSettings = {
  startTime: '23:00',
  endTime: '08:00'
};

router.get('/settings/dnd', (req, res) => {
  res.json({
    success: true,
    settings: dndSettings
  });
});

router.post('/settings/dnd', (req, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Start time and end time are required'
      });
    }

    dndSettings = { startTime, endTime };

    res.json({
      success: true,
      message: 'DND settings saved',
      settings: dndSettings
    });
  } catch (error) {
    console.error('Error saving DND settings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
