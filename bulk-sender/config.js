const path = require('path');

module.exports = {
  // WhatsApp session
  sessionPath: './.wwebjs_auth',

  // Database - use absolute path
  dbPath: path.join(__dirname, 'campaigns.db'),

  // Sending settings
  minDelay: 8000,        // 8 seconds
  maxDelay: 20000,       // 20 seconds
  batchSize: 50,         // Messages per batch
  batchBreak: 600000,    // 10 minutes break after batch

  // Retry settings
  maxRetries: 3,
  retryDelay: 3600000,   // 1 hour

  // DND hours (Do Not Disturb)
  dndStart: 23,          // 11 PM
  dndEnd: 8,             // 8 AM

  // Blacklist keywords
  blacklistKeywords: ['stop', 'unsubscribe', 'remove', 'block'],

  // File paths
  uploadsDir: './uploads',
  resultsDir: './results',

  // Dashboard refresh rate
  refreshRate: 100,

  // Telegram notifications
  telegramEnabled: false,        // Set to true to enable
  telegramBotToken: '',          // Get from @BotFather
  telegramChatId: '',            // Your Telegram chat ID
};
