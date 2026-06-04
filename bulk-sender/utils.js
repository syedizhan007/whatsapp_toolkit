const config = require('./config');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

class Utils {
  // Random delay between min and max
  static getRandomDelay() {
    return Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + config.minDelay;
  }

  // Sleep function
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Personalize message with variables
  static personalizeMessage(template, contact) {
    let message = template;

    // Replace variables
    message = message.replace(/{name}/g, contact.name || '');
    message = message.replace(/{city}/g, contact.city || '');
    message = message.replace(/{tag}/g, contact.tag || '');
    message = message.replace(/{date}/g, moment().format('MMMM Do YYYY'));
    message = message.replace(/{time}/g, moment().format('h:mm A'));
    message = message.replace(/{day}/g, moment().format('dddd'));

    return message;
  }

  // Format phone number
  static formatPhone(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');

    return cleaned;
  }

  // Check if current time is in DND hours
  static isDNDTime() {
    const currentHour = moment().hour();

    if (config.dndStart > config.dndEnd) {
      // DND spans midnight (e.g., 23:00 to 08:00)
      return currentHour >= config.dndStart || currentHour < config.dndEnd;
    } else {
      // DND within same day
      return currentHour >= config.dndStart && currentHour < config.dndEnd;
    }
  }

  // Check if message contains blacklist keywords
  static containsBlacklistKeyword(message) {
    const lowerMessage = message.toLowerCase();
    return config.blacklistKeywords.some(keyword =>
      lowerMessage.includes(keyword.toLowerCase())
    );
  }

  // Remove duplicates from array of contacts
  static removeDuplicates(contacts) {
    const seen = new Set();
    return contacts.filter(contact => {
      const phone = this.formatPhone(contact.phone);
      if (seen.has(phone)) {
        return false;
      }
      seen.add(phone);
      return true;
    });
  }

  // Ensure directory exists
  static ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Get file extension
  static getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  // Validate media file
  static isValidMediaFile(filename) {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt'];
    const ext = this.getFileExtension(filename);
    return validExtensions.includes(ext);
  }

  // Format duration
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Calculate ETA
  static calculateETA(processed, total, startTime) {
    if (processed === 0) return 'Calculating...';

    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed;
    const remaining = total - processed;
    const eta = remaining / rate;

    return this.formatDuration(eta);
  }

  // Generate timestamp
  static timestamp() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  // Validate cron expression (basic)
  static isValidCron(expression) {
    const parts = expression.split(' ');
    return parts.length === 5 || parts.length === 6;
  }
}

module.exports = Utils;
