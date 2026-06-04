const path = require('path');
const fs = require('fs');

// Import bulk-sender modules
const CampaignManager = require('../../bulk-sender/campaign-manager');
const CSVHandler = require('../../bulk-sender/csv-handler');
const Utils = require('../../bulk-sender/utils');

class BulkSenderService {
  constructor() {
    this.campaignManager = null;
    this.isInitialized = false;
    this.uploadsDir = path.join(__dirname, '../../bulk-sender/uploads');
    this.resultsDir = path.join(__dirname, '../../bulk-sender/results');
    this.currentQRCode = null; // Store current QR code
    this.whatsappStatus = {
      connected: false,
      ready: false,
      qrCode: null
    };
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      const Utils = require('../../bulk-sender/utils');
      const CampaignManager = require('../../bulk-sender/campaign-manager');
      const QRCode = require('qrcode');

      Utils.ensureDir(this.uploadsDir);
      Utils.ensureDir(this.resultsDir);

      console.log('✓ Initializing Bulk Sender Service with WhatsApp...');

      // Use the REAL CampaignManager class
      this.campaignManager = new CampaignManager();

      // Initialize it (this creates WhatsApp client internally)
      await this.campaignManager.initialize();

      // NOW hook into the existing WhatsApp client to capture QR
      if (this.campaignManager.whatsapp && this.campaignManager.whatsapp.client) {
        const client = this.campaignManager.whatsapp.client;

        // Add our QR code capture listener
        client.on('qr', async (qr) => {
          console.log('📱 QR Code generated!');
          try {
            const qrDataURL = await QRCode.toDataURL(qr);
            this.whatsappStatus.qrCode = qrDataURL;
            this.whatsappStatus.connected = false;
            this.whatsappStatus.ready = false;
            console.log('✓ QR Code available at: GET /api/bulk/whatsapp/qr');
          } catch (err) {
            console.error('Error generating QR code:', err);
          }
        });

        client.on('ready', () => {
          console.log('✅ WhatsApp connected and ready!');
          this.whatsappStatus.connected = true;
          this.whatsappStatus.ready = true;
          this.whatsappStatus.qrCode = null;
        });

        client.on('disconnected', (reason) => {
          console.log('❌ WhatsApp disconnected:', reason);
          this.whatsappStatus.connected = false;
          this.whatsappStatus.ready = false;
          this.whatsappStatus.qrCode = null;
        });
      }

      this.isInitialized = true;
      console.log('✓ Bulk Sender Service fully initialized');
    } catch (error) {
      console.error('✗ Failed to initialize Bulk Sender Service:', error);
      throw error;
    }
  }

  getWhatsAppStatus() {
    return {
      success: true,
      connected: this.whatsappStatus.connected,
      ready: this.whatsappStatus.ready,
      hasQRCode: this.whatsappStatus.qrCode !== null,
      message: this.whatsappStatus.ready ? 'WhatsApp connected' :
               this.whatsappStatus.qrCode ? 'Scan QR code to connect' :
               'Initializing...'
    };
  }

  getQRCode() {
    return this.whatsappStatus.qrCode;
  }

  async createCampaign(name, message, contacts, mediaFiles = []) {
    try {
      const Utils = require('../../bulk-sender/utils');
      const DatabaseManager = require('../../bulk-sender/database');

      // Validate inputs
      if (!name || !message) {
        throw new Error('Name and message are required');
      }

      if (!Array.isArray(contacts)) {
        throw new Error('Contacts must be an array');
      }

      if (contacts.length === 0) {
        throw new Error('At least one contact is required');
      }

      Utils.ensureDir(this.uploadsDir);
      Utils.ensureDir(this.resultsDir);

      // Use singleton database instance
      if (!this.campaignManager || !this.campaignManager.db) {
        this.campaignManager = {
          db: new DatabaseManager()
        };
        await this.campaignManager.db.initialize();
      }

      // Attach media files to contacts if provided
      let processedContacts = contacts;
      if (mediaFiles && Array.isArray(mediaFiles) && mediaFiles.length > 0) {
        processedContacts = contacts.map(contact => {
          const contactMedia = mediaFiles.filter(m =>
            m.phone === contact.phone || m.forAll === true
          );

          if (contactMedia.length > 0) {
            return {
              ...contact,
              media_files: contactMedia.map(m => ({
                path: m.path,
                type: m.type,
                caption: m.caption || ''
              }))
            };
          }

          return contact;
        });
      }

      // Create campaign in database
      const campaignId = this.campaignManager.db.createCampaign(name, message);

      // Add contacts to database
      this.campaignManager.db.addContacts(campaignId, processedContacts);

      return {
        success: true,
        campaignId,
        message: `Campaign created with ${processedContacts.length} contacts. Click Start to begin sending.`
      };
    } catch (error) {
      console.error('Error creating campaign:', error);
      return {
        success: false,
        message: error.message || 'Failed to create campaign'
      };
    }
  }

  async startCampaign(campaignId) {
    try {
      // Initialize full campaign manager with WhatsApp client
      if (!this.isInitialized) {
        console.log('🔄 Initializing WhatsApp client for campaign...');
        await this.initialize();
      }

      // Start campaign in background
      setImmediate(async () => {
        try {
          console.log(`🚀 Starting campaign ${campaignId}...`);
          await this.campaignManager.startCampaign(campaignId);
          console.log(`✅ Campaign ${campaignId} completed!`);
        } catch (error) {
          console.error(`❌ Campaign ${campaignId} execution error:`, error);
        }
      });

      return {
        success: true,
        message: 'Campaign started. WhatsApp client is initializing...'
      };
    } catch (error) {
      console.error('Error starting campaign:', error);
      throw error;
    }
  }

  async pauseCampaign(campaignId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    this.campaignManager.pauseCampaign();

    return {
      success: true,
      message: 'Campaign paused'
    };
  }

  async stopCampaign(campaignId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    this.campaignManager.stopCampaign(campaignId);

    return {
      success: true,
      message: 'Campaign stopped'
    };
  }

  async resumeCampaign(campaignId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Resume campaign in background
      setImmediate(async () => {
        try {
          await this.campaignManager.resumeCampaign(campaignId);
        } catch (error) {
          console.error('Campaign resume error:', error);
        }
      });

      return {
        success: true,
        message: 'Campaign resumed'
      };
    } catch (error) {
      console.error('Error resuming campaign:', error);
      throw error;
    }
  }

  async getCampaigns() {
    try {
      const DatabaseManager = require('../../bulk-sender/database');

      // Initialize database if not already done
      if (!this.campaignManager || !this.campaignManager.db) {
        this.campaignManager = {
          db: new DatabaseManager()
        };
        await this.campaignManager.db.initialize();
      }

      const campaigns = this.campaignManager.db.getAllCampaigns();
      return campaigns;
    } catch (error) {
      console.error('Error getting campaigns:', error);
      return [];
    }
  }

  async getCampaign(campaignId) {
    try {
      const DatabaseManager = require('../../bulk-sender/database');

      // Initialize database if not already done
      if (!this.campaignManager || !this.campaignManager.db) {
        this.campaignManager = {
          db: new DatabaseManager()
        };
        await this.campaignManager.db.initialize();
      }

      const campaign = this.campaignManager.db.getCampaign(campaignId);
      return campaign;
    } catch (error) {
      console.error('Error getting campaign:', error);
      return null;
    }
  }

  async deleteCampaign(campaignId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    this.campaignManager.deleteCampaign(campaignId);

    return {
      success: true,
      message: 'Campaign deleted'
    };
  }

  async importContactsFromCSV(csvFilePath) {
    try {
      const contacts = await CSVHandler.importContacts(csvFilePath);
      return {
        success: true,
        contacts,
        count: contacts.length
      };
    } catch (error) {
      console.error('Error importing CSV:', error);
      throw error;
    }
  }

  async exportResults(campaignId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      const history = this.campaignManager.db.getMessageHistory(campaignId);
      const outputFile = path.join(this.resultsDir, `campaign_${campaignId}_results_${Date.now()}.csv`);

      await CSVHandler.exportResults(outputFile, history);

      return {
        success: true,
        filePath: outputFile,
        message: 'Results exported'
      };
    } catch (error) {
      console.error('Error exporting results:', error);
      throw error;
    }
  }

  async getAllGroups() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const groups = await this.campaignManager.getAllGroups();
      return groups;
    } catch (error) {
      console.error('Error getting groups:', error);
      throw error;
    }
  }

  async extractGroupMembers(groupId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const members = await this.campaignManager.extractGroupMembers(groupId);
      return members;
    } catch (error) {
      console.error('Error extracting group members:', error);
      throw error;
    }
  }

  getBlacklist() {
    if (!this.isInitialized) {
      return [];
    }

    return this.campaignManager.getBlacklist();
  }

  addToBlacklist(phone, reason) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    this.campaignManager.addToBlacklist(phone, reason);

    return {
      success: true,
      message: 'Added to blacklist'
    };
  }

  removeFromBlacklist(phone) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    this.campaignManager.removeFromBlacklist(phone);

    return {
      success: true,
      message: 'Removed from blacklist'
    };
  }

  async destroy() {
    if (this.campaignManager) {
      await this.campaignManager.destroy();
    }
    this.isInitialized = false;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new BulkSenderService();
    }
    return instance;
  }
};
