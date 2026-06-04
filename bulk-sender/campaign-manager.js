const activeLoops = require('../activeLoops');
const DatabaseManager = require('./database');
const Dashboard = require('./dashboard');
const Utils = require('./utils');
const config = require('./config');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class CampaignManager {
  constructor() {
    this.whatsapp = new WhatsAppClient();
    this.db = new DatabaseManager();
    this.dashboard = new Dashboard();
    this.isPaused = false;
    this.currentCampaignId = null;
  }

  async initialize() {
    await this.db.initialize();
    await this.whatsapp.initialize();

    // Set up auto-blacklist on incoming messages
    this.whatsapp.setMessageHandler(async (message) => {
      await this.handleIncomingMessage(message);
    });
  }

  async handleIncomingMessage(message) {
    // Only process messages not sent by us
    if (message.fromMe) return;

    const messageBody = message.body.toLowerCase();
    const senderPhone = message.from.replace('@c.us', '');

    // Check if message contains blacklist keywords
    if (Utils.containsBlacklistKeyword(messageBody)) {
      // Auto-add to blacklist
      if (!this.db.isBlacklisted(senderPhone)) {
        this.db.addToBlacklist(senderPhone, `Auto-blacklisted: replied with "${message.body}"`);
        console.log(chalk.yellow(`⚠ Auto-blacklisted ${senderPhone} for replying: "${message.body}"`));
      }
    }
  }

  async createCampaign(name, message, contacts) {
    // Create campaign
    const campaignId = this.db.createCampaign(name, message);

    // Filter blacklisted contacts
    const validContacts = contacts.filter(contact => {
      return !this.db.isBlacklisted(contact.phone);
    });

    if (validContacts.length === 0) {
      throw new Error('All contacts are blacklisted!');
    }

    // Add contacts to database
    this.db.addContacts(campaignId, validContacts);

    this.dashboard.success(`Campaign "${name}" created with ${validContacts.length} contacts`);

    if (contacts.length > validContacts.length) {
      this.dashboard.warning(`${contacts.length - validContacts.length} contacts were blacklisted and skipped`);
    }

    return campaignId;
  }

  async startCampaign(campaignId) {
    this.currentCampaignId = campaignId;
    const campaign = this.db.getCampaign(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    this.dashboard.info(`Starting campaign: ${campaign.name}`);

    // Update status
    this.db.updateCampaignStatus(campaignId, 'running');

    // Get pending contacts
    let pendingContacts = this.db.getPendingContacts(campaignId);

    if (pendingContacts.length === 0) {
      this.dashboard.warning('No pending contacts found');
      return;
    }

    this.dashboard.init(pendingContacts.length);

    let batchCount = 0;
    let sentInBatch = 0;

    for (const contact of pendingContacts) {
      // Stop check
      if (!activeLoops[campaignId]) {
        this.dashboard.warning('Campaign stopped by user');
        this.db.updateCampaignStatus(campaignId, 'stopped');
        break;
      }
      // Check if paused
      if (this.isPaused) {
      this.dashboard.warning('Campaign paused by user');
      this.db.updateCampaignStatus(campaignId, 'paused');
      return;
    }

      // Check DND hours
      while (Utils.isDNDTime()) {
        this.dashboard.warning('DND hours active. Waiting...');
        await Utils.sleep(300000); // Wait 5 minutes
      }

      // Send message
      try {
        await this.sendToContact(campaignId, campaign.message, contact);
        this.dashboard.updateSuccess();
        sentInBatch++;
      } catch (error) {
        this.dashboard.updateFailed();
        this.dashboard.error(`Failed to send to ${contact.phone}: ${error.message}`);
      }

      // Batch break
      if (sentInBatch >= config.batchSize) {
        batchCount++;
        this.dashboard.showBatchBreak(config.batchBreak);
        await Utils.sleep(config.batchBreak);
        this.dashboard.resumeAfterBreak();
        sentInBatch = 0;
      } else {
        // Random delay between messages
        const delay = Utils.getRandomDelay();
        await Utils.sleep(delay);
      }
    }

    this.dashboard.complete();

    // Update campaign status
    this.db.updateCampaignStatus(campaignId, 'completed');

    // Check for retries
    await this.retryFailed(campaignId);
  }

  async sendToContact(campaignId, messageTemplate, contact) {
    // Personalize message
    const message = Utils.personalizeMessage(messageTemplate, contact);

    // Format phone
    const phone = Utils.formatPhone(contact.phone);

    // Collect all media files for this contact
    const mediaFiles = [];

    // Check for images
    if (contact.custom_image && fs.existsSync(contact.custom_image)) {
      mediaFiles.push({
        path: contact.custom_image,
        type: 'image',
        caption: ''
      });
    }

    // Check for documents
    if (contact.custom_doc && fs.existsSync(contact.custom_doc)) {
      mediaFiles.push({
        path: contact.custom_doc,
        type: 'document',
        caption: ''
      });
    }

    // Check for additional files (support multiple files)
    if (contact.media_files && Array.isArray(contact.media_files)) {
      contact.media_files.forEach(file => {
        if (fs.existsSync(file.path)) {
          mediaFiles.push({
            path: file.path,
            type: file.type || 'file',
            caption: file.caption || ''
          });
        }
      });
    }

    try {
      // Send based on media availability
      if (mediaFiles.length > 0) {
        await this.whatsapp.sendBulkMedia(phone, message, mediaFiles);
      } else {
        await this.whatsapp.sendMessage(phone, message);
      }

      // Update contact status
      this.db.updateContactStatus(contact.id, 'sent');

      // Add to history
      this.db.addMessageHistory(campaignId, contact.id, phone, message, 'sent');

      // Update campaign stats
      this.updateCampaignStats(campaignId);

    } catch (error) {
      // Update contact status
      this.db.updateContactStatus(contact.id, 'failed', error.message);
      this.db.incrementRetryCount(contact.id);

      // Add to history
      this.db.addMessageHistory(campaignId, contact.id, phone, message, 'failed');

      // Update campaign stats
      this.updateCampaignStats(campaignId);

      throw error;
    }
  }

  async retryFailed(campaignId) {
    const failedContacts = this.db.getContactsForRetry(campaignId);

    if (failedContacts.length === 0) {
      return;
    }

    this.dashboard.info(`Retrying ${failedContacts.length} failed messages...`);

    const campaign = this.db.getCampaign(campaignId);

    for (const contact of failedContacts) {
      try {
        // Reset status to pending
        this.db.updateContactStatus(contact.id, 'pending', null);

        await this.sendToContact(campaignId, campaign.message, contact);
        this.dashboard.success(`Retry successful for ${contact.phone}`);
      } catch (error) {
        this.dashboard.error(`Retry failed for ${contact.phone}`);
      }

      await Utils.sleep(Utils.getRandomDelay());
    }
  }

  updateCampaignStats(campaignId) {
    const result = this.db.db.exec(`
      SELECT
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM contacts
      WHERE campaign_id = ?
    `, [campaignId]);

    if (result.length > 0 && result[0].values.length > 0) {
      const stats = this.db.rowToObject(result[0].columns, result[0].values[0]);
      this.db.updateCampaignStats(campaignId, stats.sent, stats.failed, stats.pending);
    }
  }

  pauseCampaign() {
    this.isPaused = true;
    this.dashboard.warning('Pausing campaign...');
  }

  stopCampaign(campaignId) {
    delete activeLoops[campaignId];
    this.dashboard.warning('Stopping campaign...');
    this.db.updateCampaignStatus(campaignId, 'stopped');
  }

  resumeCampaign(campaignId) {
    this.isPaused = false;
    this.dashboard.info('Resuming campaign...');
    return this.startCampaign(campaignId);
  }

  async extractGroupMembers(groupId) {
    try {
      const members = await this.whatsapp.getGroupMembers(groupId);
      this.dashboard.success(`Extracted ${members.length} members from group`);
      return members;
    } catch (error) {
      this.dashboard.error(`Failed to extract group members: ${error.message}`);
      throw error;
    }
  }

  async getAllGroups() {
    try {
      const groups = await this.whatsapp.getAllGroups();
      return groups;
    } catch (error) {
      this.dashboard.error(`Failed to get groups: ${error.message}`);
      throw error;
    }
  }

  addToBlacklist(phone, reason = 'User requested') {
    this.db.addToBlacklist(phone, reason);
    this.dashboard.success(`Added ${phone} to blacklist`);
  }

  getBlacklist() {
    return this.db.getBlacklist();
  }

  removeFromBlacklist(phone) {
    this.db.removeFromBlacklist(phone);
    this.dashboard.success(`Removed ${phone} from blacklist`);
  }

  getCampaigns() {
    return this.db.getAllCampaigns();
  }

  getCampaign(id) {
    return this.db.getCampaign(id);
  }

  deleteCampaign(id) {
    this.db.deleteCampaign(id);
    this.dashboard.success(`Campaign deleted`);
  }

  async destroy() {
    await this.whatsapp.destroy();
    this.db.close();
  }
}

module.exports = CampaignManager;
