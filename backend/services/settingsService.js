const db = require('../config/database');

class SettingsService {
  constructor() {
    this.initializeSettings();
  }

  // Initialize settings table and default values
  async initializeSettings() {
    try {
      await db.connect();

      // Create settings table if not exists
      await db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default settings if they don't exist
      const defaults = {
        dndEnabled: 'true',
        dndStart: '21:00',
        dndEnd: '09:00',
        delaySeconds: '45'
      };

      for (const [key, value] of Object.entries(defaults)) {
        const existing = await db.get('SELECT key FROM settings WHERE key = ?', [key]);
        if (!existing) {
          await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
        }
      }

      console.log('✅ Settings service initialized');
    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  }

  // Get all settings
  async getSettings() {
    try {
      const rows = await db.query('SELECT key, value FROM settings');

      const settings = {};
      rows.forEach(row => {
        // Convert string values to appropriate types
        if (row.key === 'dndEnabled') {
          settings[row.key] = row.value === 'true';
        } else if (row.key === 'delaySeconds') {
          settings[row.key] = parseInt(row.value, 10);
        } else {
          settings[row.key] = row.value;
        }
      });

      return settings;
    } catch (error) {
      console.error('Failed to get settings:', error);
      throw error;
    }
  }

  // Get single setting
  async getSetting(key) {
    try {
      const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
      return row ? row.value : null;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return null;
    }
  }

  // Update settings
  async updateSettings(settings) {
    try {
      for (const [key, value] of Object.entries(settings)) {
        // Convert boolean to string for storage
        const stringValue = typeof value === 'boolean' ? value.toString() : value.toString();

        const existing = await db.get('SELECT key FROM settings WHERE key = ?', [key]);
        if (existing) {
          await db.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [stringValue, key]);
        } else {
          await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, stringValue]);
        }
      }

      console.log('✅ Settings updated:', settings);
      return await this.getSettings();
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  // Check if currently in DND period
  async isInDNDPeriod() {
    try {
      const settings = await this.getSettings();

      if (!settings.dndEnabled) {
        return false;
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [startHour, startMin] = settings.dndStart.split(':').map(Number);
      const [endHour, endMin] = settings.dndEnd.split(':').map(Number);

      const dndStart = startHour * 60 + startMin;
      const dndEnd = endHour * 60 + endMin;

      // Handle overnight DND period (e.g., 21:00 to 09:00)
      if (dndStart > dndEnd) {
        return currentTime >= dndStart || currentTime < dndEnd;
      } else {
        return currentTime >= dndStart && currentTime < dndEnd;
      }
    } catch (error) {
      console.error('Failed to check DND period:', error);
      return false;
    }
  }
}

module.exports = new SettingsService();
