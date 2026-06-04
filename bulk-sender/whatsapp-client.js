const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const chalk = require('chalk');

class WhatsAppClient {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      console.log(chalk.blue('Initializing WhatsApp client...'));

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: config.sessionPath
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      this.client.on('qr', (qr) => {
        console.log(chalk.yellow('\nScan the QR code below with WhatsApp:\n'));
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        console.log(chalk.green('✓ WhatsApp client is ready!\n'));
        this.isReady = true;
        resolve();
      });

      this.client.on('authenticated', () => {
        console.log(chalk.green('✓ Authentication successful!'));
      });

      this.client.on('auth_failure', (msg) => {
        console.log(chalk.red('✗ Authentication failed:', msg));
        reject(new Error('Authentication failed'));
      });

      this.client.on('disconnected', (reason) => {
        console.log(chalk.red('Client disconnected:', reason));
        this.isReady = false;
      });

      // Listen for incoming messages to auto-blacklist
      this.client.on('message', async (message) => {
        if (this.onMessageReceived) {
          await this.onMessageReceived(message);
        }
      });

      this.client.initialize();
    });
  }

  // Set callback for incoming messages
  setMessageHandler(callback) {
    this.onMessageReceived = callback;
  }

  async sendMessage(phone, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
    await this.client.sendMessage(chatId, message);
  }

  async sendMessageWithMedia(phone, message, mediaPath, mediaType = 'image') {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
    const media = MessageMedia.fromFilePath(mediaPath);

    // Send based on media type
    if (mediaType === 'document' || mediaType === 'file') {
      // Send as document
      await this.client.sendMessage(chatId, media, {
        caption: message,
        sendMediaAsDocument: true
      });
    } else {
      // Send as image/video
      await this.client.sendMessage(chatId, media, { caption: message });
    }
  }

  async sendBulkMedia(phone, message, mediaFiles) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

    // Send message first if provided
    if (message && message.trim()) {
      await this.client.sendMessage(chatId, message);
      // Small delay between message and media
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Send each media file
    for (const mediaFile of mediaFiles) {
      const media = MessageMedia.fromFilePath(mediaFile.path);

      if (mediaFile.type === 'document' || mediaFile.type === 'file') {
        await this.client.sendMessage(chatId, media, {
          sendMediaAsDocument: true,
          caption: mediaFile.caption || ''
        });
      } else {
        await this.client.sendMessage(chatId, media, {
          caption: mediaFile.caption || ''
        });
      }

      // Small delay between multiple media files
      if (mediaFiles.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
  }

  async isRegisteredUser(phone) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
    return await this.client.isRegisteredUser(chatId);
  }

  async getGroupMembers(groupId) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await this.client.getChatById(groupId);

    if (!chat.isGroup) {
      throw new Error('Provided ID is not a group');
    }

    const participants = chat.participants;
    return participants.map(p => ({
      phone: p.id.user,
      isAdmin: p.isAdmin,
      isSuperAdmin: p.isSuperAdmin
    }));
  }

  async getAllGroups() {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await this.client.getChats();
    return chats.filter(chat => chat.isGroup).map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      participantsCount: chat.participants.length
    }));
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.isReady = false;
    }
  }
}

module.exports = WhatsAppClient;
