/**
 * WhatsApp Service - Baileys Compatible
 *
 * This service acts as a bridge to the global Baileys WhatsApp clients
 * managed in server.js. It provides a clean API for other backend services
 * to interact with WhatsApp without directly accessing the global state.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.whatsappClients = null; // Will be set by server.js
    this.io = null; // Socket.IO instance for events
    this.isInitialized = false;
  }

  /**
   * Initialize service with global WhatsApp clients map from server.js
   * @param {Map} whatsappClients - Global whatsappClients Map from server.js
   * @param {Object} io - Socket.IO instance
   */
  initialize(whatsappClients, io) {
    this.whatsappClients = whatsappClients;
    this.io = io;
    this.isInitialized = true;
    console.log('✓ WhatsApp Service initialized with Baileys integration');
  }

  /**
   * Get Baileys socket for a specific user
   * @param {string} userId - User ID
   * @returns {Object|null} Baileys socket instance or null
   */
  getClient(userId) {
    if (!this.isInitialized || !this.whatsappClients || !userId) {
      return null;
    }

    const userData = this.whatsappClients.get(userId);
    if (!userData || !userData.isReady || !userData.client) {
      return null;
    }

    return userData.client;
  }

  /**
   * Check if user's WhatsApp client is ready
   * @param {string} userId - User ID
   * @returns {string} Status: 'ready', 'initializing', 'disconnected', 'not_initialized'
   */
  getClientStatus(userId) {
    if (!this.isInitialized || !this.whatsappClients || !userId) {
      return 'not_initialized';
    }

    const userData = this.whatsappClients.get(userId);
    if (!userData) {
      return 'not_initialized';
    }

    if (userData.isReady && userData.client) {
      return 'ready';
    }

    if (userData.isInitializing) {
      return 'initializing';
    }

    return 'disconnected';
  }

  /**
   * Check if client is ready (boolean)
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isClientReady(userId) {
    return this.getClientStatus(userId) === 'ready';
  }

  /**
   * Send a text message using Baileys
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number (will be formatted to JID)
   * @param {string} message - Message text
   * @returns {Promise<Object>} Send result
   */
  async sendMessage(userId, phoneNumber, message) {
    const client = this.getClient(userId);

    if (!client) {
      throw new Error(`WhatsApp client not ready for user ${userId}`);
    }

    // Format phone number to Baileys JID format
    let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');

    // Pakistani number sanitization
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '92' + formattedNumber.substring(1);
    }

    const jid = formattedNumber + '@s.whatsapp.net';

    // Send message using Baileys syntax
    const result = await client.sendMessage(jid, { text: message });

    return {
      success: true,
      messageId: result.key.id,
      jid: jid
    };
  }

  /**
   * Send message with media using Baileys
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number
   * @param {Buffer|string} mediaBuffer - Media file buffer or URL
   * @param {Object} options - Options { caption, fileName, mimetype }
   * @returns {Promise<Object>} Send result
   */
  async sendMediaMessage(userId, phoneNumber, mediaBuffer, options = {}) {
    const client = this.getClient(userId);

    if (!client) {
      throw new Error(`WhatsApp client not ready for user ${userId}`);
    }

    // Sanitize media input - strip attachment: prefix if present
    let sanitizedMedia = mediaBuffer;
    if (typeof mediaBuffer === 'string') {
      // Remove attachment: prefix from URLs
      sanitizedMedia = mediaBuffer.replace(/^attachment:/, '');
    }

    // Randomize filename to mitigate WhatsApp ban detection
    let randomizedFileName = 'document';
    if (options.fileName) {
      // Extract extension from original filename
      const extensionMatch = options.fileName.match(/(\.[^.]+)$/);
      const extension = extensionMatch ? extensionMatch[1] : '';

      // Generate random filename with original extension
      const randomBase = crypto.randomBytes(16).toString('hex');
      randomizedFileName = randomBase + extension;
    } else {
      // No original filename - generate random name with generic extension
      randomizedFileName = crypto.randomBytes(16).toString('hex');
    }

    // Format phone number
    let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '92' + formattedNumber.substring(1);
    }
    const jid = formattedNumber + '@s.whatsapp.net';

    // Determine media type
    const isImage = options.mimetype && options.mimetype.startsWith('image/');

    let result;
    if (isImage) {
      result = await client.sendMessage(jid, {
        image: typeof sanitizedMedia === 'string' ? { url: sanitizedMedia } : sanitizedMedia,
        caption: options.caption || ''
      });
    } else {
      result = await client.sendMessage(jid, {
        document: typeof sanitizedMedia === 'string' ? { url: sanitizedMedia } : sanitizedMedia,
        fileName: randomizedFileName,
        mimetype: options.mimetype || 'application/octet-stream',
        caption: options.caption || ''
      });
    }

    return {
      success: true,
      messageId: result.key.id,
      jid: jid
    };
  }

  /**
   * Get all connected clients
   * @returns {Array} Array of user IDs with ready clients
   */
  getConnectedClients() {
    if (!this.isInitialized || !this.whatsappClients) {
      return [];
    }

    const connectedUsers = [];
    for (const [userId, userData] of this.whatsappClients.entries()) {
      if (userData.isReady && userData.client) {
        connectedUsers.push({
          userId: userId,
          clientInfo: userData.clientInfo
        });
      }
    }

    return connectedUsers;
  }

  /**
   * Get client info for a user
   * @param {string} userId - User ID
   * @returns {Object|null} Client info or null
   */
  getClientInfo(userId) {
    if (!this.isInitialized || !this.whatsappClients || !userId) {
      return null;
    }

    const userData = this.whatsappClients.get(userId);
    if (!userData || !userData.clientInfo) {
      return null;
    }

    return userData.clientInfo;
  }

  /**
   * DEPRECATED: Legacy method for compatibility
   * Use getClient(userId) instead
   */
  async initializeClient(clientId, sessionPath) {
    console.warn('⚠️ initializeClient is deprecated. WhatsApp clients are now managed by server.js');
    throw new Error('initializeClient is deprecated. WhatsApp clients are automatically initialized per user.');
  }

  /**
   * DEPRECATED: Legacy method for compatibility
   */
  async destroyClient(clientId) {
    console.warn('⚠️ destroyClient is deprecated. Use the logout endpoint instead.');
    throw new Error('destroyClient is deprecated. Use POST /api/whatsapp/logout instead.');
  }

  /**
   * DEPRECATED: Legacy method for compatibility
   */
  async destroyAll() {
    console.warn('⚠️ destroyAll is deprecated. Clients are managed per-user by server.js');
    throw new Error('destroyAll is deprecated. Clients are managed individually per user.');
  }
}

// Singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
