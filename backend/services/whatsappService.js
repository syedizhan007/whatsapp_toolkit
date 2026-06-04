const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const EventEmitter = require('events');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // Store multiple client instances
    this.clientStatus = new Map();
  }

  async initializeClient(clientId, sessionPath) {
    if (this.clients.has(clientId)) {
      const existingClient = this.clients.get(clientId);
      const status = this.clientStatus.get(clientId);
      if (status === 'ready') {
        return existingClient;
      }
    }

    return new Promise((resolve, reject) => {
      const client = new Client({
        authStrategy: new LocalAuth({
          dataPath: sessionPath,
          clientId: clientId
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      client.on('qr', (qr) => {
        console.log(`QR Code for ${clientId}:`);
        qrcode.generate(qr, { small: true });
        this.emit('qr', { clientId, qr });
      });

      client.on('ready', () => {
        console.log(`✓ WhatsApp client ${clientId} is ready`);
        this.clientStatus.set(clientId, 'ready');
        this.emit('ready', { clientId });
        resolve(client);
      });

      client.on('authenticated', () => {
        console.log(`✓ ${clientId} authenticated`);
        this.clientStatus.set(clientId, 'authenticated');
      });

      client.on('auth_failure', (msg) => {
        console.error(`✗ ${clientId} auth failed:`, msg);
        this.clientStatus.set(clientId, 'auth_failed');
        reject(new Error(`Authentication failed for ${clientId}`));
      });

      client.on('disconnected', (reason) => {
        console.log(`${clientId} disconnected:`, reason);
        this.clientStatus.set(clientId, 'disconnected');
        this.clients.delete(clientId);
        this.emit('disconnected', { clientId, reason });
      });

      client.initialize();
      this.clients.set(clientId, client);
    });
  }

  getClient(clientId) {
    return this.clients.get(clientId);
  }

  getClientStatus(clientId) {
    return this.clientStatus.get(clientId) || 'not_initialized';
  }

  async destroyClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      await client.destroy();
      this.clients.delete(clientId);
      this.clientStatus.delete(clientId);
    }
  }

  async destroyAll() {
    for (const [clientId, client] of this.clients) {
      await client.destroy();
    }
    this.clients.clear();
    this.clientStatus.clear();
  }
}

// Singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
