const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

class TelegramNotifier {
  constructor() {
    this.bot = null;
    this.chatId = config.telegramChatId;
    this.enabled = config.telegramEnabled;
  }

  initialize() {
    if (!this.enabled || !config.telegramBotToken) {
      console.log('⚠️  Telegram notifications disabled');
      return;
    }

    try {
      this.bot = new TelegramBot(config.telegramBotToken, { polling: false });
      console.log('✅ Telegram notifier initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Telegram bot:', error.message);
      this.enabled = false;
    }
  }

  async sendMessage(message) {
    if (!this.enabled || !this.bot || !this.chatId) {
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('❌ Failed to send Telegram message:', error.message);
    }
  }

  async notifyCampaignStarted(campaignName, totalContacts) {
    const message = `
🚀 <b>Campaign Started</b>

📋 Campaign: ${campaignName}
👥 Total Contacts: ${totalContacts}
⏰ Started: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }

  async notifyCampaignCompleted(campaignName, stats) {
    const successRate = ((stats.sent / stats.total) * 100).toFixed(1);
    const message = `
✅ <b>Campaign Completed</b>

📋 Campaign: ${campaignName}
👥 Total: ${stats.total}
✅ Sent: ${stats.sent}
❌ Failed: ${stats.failed}
📊 Success Rate: ${successRate}%
⏱️ Duration: ${stats.duration}
⏰ Completed: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }

  async notifyCampaignPaused(campaignName, progress) {
    const message = `
⏸️ <b>Campaign Paused</b>

📋 Campaign: ${campaignName}
📊 Progress: ${progress.sent}/${progress.total} (${((progress.sent/progress.total)*100).toFixed(1)}%)
⏰ Paused: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }

  async notifyCampaignResumed(campaignName, remaining) {
    const message = `
▶️ <b>Campaign Resumed</b>

📋 Campaign: ${campaignName}
📊 Remaining: ${remaining} contacts
⏰ Resumed: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }

  async notifyBatchCompleted(campaignName, batchNumber, stats) {
    const message = `
📦 <b>Batch #${batchNumber} Completed</b>

📋 Campaign: ${campaignName}
✅ Sent: ${stats.sent}
❌ Failed: ${stats.failed}
⏳ Next batch in: ${stats.breakTime} minutes
    `;
    await this.sendMessage(message);
  }

  async notifyFailedMessages(campaignName, failedCount, failedNumbers) {
    const numbersList = failedNumbers.slice(0, 5).join('\n');
    const more = failedNumbers.length > 5 ? `\n... and ${failedNumbers.length - 5} more` : '';

    const message = `
⚠️ <b>Failed Messages Alert</b>

📋 Campaign: ${campaignName}
❌ Failed Count: ${failedCount}

Failed Numbers:
${numbersList}${more}

⏰ Time: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }

  async notifyError(campaignName, error) {
    const message = `
🚨 <b>Campaign Error</b>

📋 Campaign: ${campaignName}
❌ Error: ${error}
⏰ Time: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }

  async notifyBlacklisted(phone, reason) {
    const message = `
🚫 <b>Number Blacklisted</b>

📱 Phone: ${phone}
📝 Reason: ${reason}
⏰ Time: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }

  async testConnection() {
    const message = `
✅ <b>Telegram Bot Connected</b>

WhatsApp Bulk Sender is now connected to Telegram!
You will receive notifications for:
• Campaign start/completion
• Batch updates
• Failed messages
• Errors and alerts

⏰ Connected: ${new Date().toLocaleString()}
    `;
    await this.sendMessage(message);
  }
}

module.exports = TelegramNotifier;
