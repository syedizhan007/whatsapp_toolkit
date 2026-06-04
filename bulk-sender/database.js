const initSqlJs = require('sql.js');
const config = require('./config');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.SQL = null;
  }

  async initialize() {
    this.SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(config.dbPath)) {
      const buffer = fs.readFileSync(config.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }

    this.createTables();
  }

  createTables() {
    // Campaigns table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scheduled_at DATETIME,
        total_contacts INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0
      )
    `);

    // Contacts table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        name TEXT,
        phone TEXT NOT NULL,
        tag TEXT,
        city TEXT,
        custom_image TEXT,
        custom_doc TEXT,
        status TEXT DEFAULT 'pending',
        sent_at DATETIME,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `);

    // Blacklist table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        reason TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Message history table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS message_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        contact_id INTEGER,
        phone TEXT NOT NULL,
        message TEXT,
        status TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      )
    `);

    // Scheduled jobs table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        cron_expression TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `);

    this.save();
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  }

  // Campaign operations
  createCampaign(name, message) {
    this.db.run('INSERT INTO campaigns (name, message) VALUES (?, ?)', [name, message]);
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return result[0].values[0][0];
  }

  getCampaign(id) {
    const result = this.db.exec('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToObject(result[0].columns, result[0].values[0]);
  }

  getAllCampaigns() {
    const result = this.db.exec('SELECT * FROM campaigns ORDER BY created_at DESC');
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  updateCampaignStatus(id, status) {
    this.db.run('UPDATE campaigns SET status = ? WHERE id = ?', [status, id]);
    this.save();
  }

  updateCampaignStats(id, sent, failed, pending) {
    this.db.run(`
      UPDATE campaigns
      SET sent_count = ?, failed_count = ?, pending_count = ?
      WHERE id = ?
    `, [sent, failed, pending, id]);
    this.save();
  }

  deleteCampaign(id) {
    this.db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    this.save();
  }

  // Contact operations
  addContact(campaignId, contact) {
    this.db.run(`
      INSERT INTO contacts (campaign_id, name, phone, tag, city, custom_image, custom_doc)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [campaignId, contact.name, contact.phone, contact.tag, contact.city, contact.custom_image, contact.custom_doc]);

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return result[0].values[0][0];
  }

  addContacts(campaignId, contacts) {
    for (const contact of contacts) {
      this.db.run(`
        INSERT INTO contacts (campaign_id, name, phone, tag, city, custom_image, custom_doc)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        campaignId,
        contact.name || '',
        contact.phone || '',
        contact.tag || null,
        contact.city || null,
        contact.custom_image || null,
        contact.custom_doc || null
      ]);
    }

    // Update campaign total
    this.db.run('UPDATE campaigns SET total_contacts = ?, pending_count = ? WHERE id = ?',
      [contacts.length, contacts.length, campaignId]);
    this.save();
  }

  getPendingContacts(campaignId) {
    const result = this.db.exec(`
      SELECT * FROM contacts
      WHERE campaign_id = ? AND status = 'pending'
      ORDER BY id
    `, [campaignId]);

    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  updateContactStatus(id, status, errorMessage = null) {
    this.db.run(`
      UPDATE contacts
      SET status = ?, sent_at = CURRENT_TIMESTAMP, error_message = ?
      WHERE id = ?
    `, [status, errorMessage, id]);
    this.save();
  }

  incrementRetryCount(id) {
    this.db.run('UPDATE contacts SET retry_count = retry_count + 1 WHERE id = ?', [id]);
    this.save();
  }

  getContactsForRetry(campaignId) {
    const result = this.db.exec(`
      SELECT * FROM contacts
      WHERE campaign_id = ?
      AND status = 'failed'
      AND retry_count < ?
      AND datetime(sent_at, '+1 hour') <= datetime('now')
    `, [campaignId, config.maxRetries]);

    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  // Blacklist operations
  addToBlacklist(phone, reason) {
    this.db.run('INSERT OR IGNORE INTO blacklist (phone, reason) VALUES (?, ?)', [phone, reason]);
    this.save();
  }

  isBlacklisted(phone) {
    const result = this.db.exec('SELECT COUNT(*) as count FROM blacklist WHERE phone = ?', [phone]);
    if (result.length === 0) return false;
    return result[0].values[0][0] > 0;
  }

  getBlacklist() {
    const result = this.db.exec('SELECT * FROM blacklist ORDER BY added_at DESC');
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  removeFromBlacklist(phone) {
    this.db.run('DELETE FROM blacklist WHERE phone = ?', [phone]);
    this.save();
  }

  // Message history
  addMessageHistory(campaignId, contactId, phone, message, status) {
    this.db.run(`
      INSERT INTO message_history (campaign_id, contact_id, phone, message, status)
      VALUES (?, ?, ?, ?, ?)
    `, [campaignId, contactId, phone, message, status]);
    this.save();
  }

  getMessageHistory(campaignId) {
    const result = this.db.exec(`
      SELECT * FROM message_history
      WHERE campaign_id = ?
      ORDER BY sent_at DESC
    `, [campaignId]);

    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  // Scheduled jobs
  addScheduledJob(campaignId, cronExpression) {
    this.db.run(`
      INSERT INTO scheduled_jobs (campaign_id, cron_expression)
      VALUES (?, ?)
    `, [campaignId, cronExpression]);

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return result[0].values[0][0];
  }

  getActiveScheduledJobs() {
    const result = this.db.exec(`SELECT * FROM scheduled_jobs WHERE status = 'active'`);
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  deactivateScheduledJob(id) {
    this.db.run('UPDATE scheduled_jobs SET status = "inactive" WHERE id = ?', [id]);
    this.save();
  }

  rowToObject(columns, values) {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  }

  close() {
    this.save();
    this.db.close();
  }
}

module.exports = DatabaseManager;
