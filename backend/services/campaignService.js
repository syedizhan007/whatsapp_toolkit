const db = require('../config/database');
const fs = require('fs').promises;
const { createReadStream } = require('fs');
const csv = require('csv-parser');
const whatsappService = require('./whatsappService');

class CampaignService {
  constructor() {
    this.activeCampaigns = new Map();
  }

  async getAllCampaigns() {
    try {
      const campaigns = await db.query(`
        SELECT
          c.*,
          COUNT(DISTINCT ct.id) as total_contacts,
          COUNT(DISTINCT CASE WHEN ct.status = 'sent' THEN ct.id END) as sent_count,
          COUNT(DISTINCT CASE WHEN ct.status = 'pending' THEN ct.id END) as pending_count,
          COUNT(DISTINCT CASE WHEN ct.status = 'failed' THEN ct.id END) as failed_count
        FROM campaigns c
        LEFT JOIN contacts ct ON c.id = ct.campaign_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);
      return campaigns;
    } catch (error) {
      console.error('Error getting campaigns:', error);
      throw error;
    }
  }

  async getCampaignById(id) {
    try {
      const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
      if (!campaign) {
        return null;
      }

      const contacts = await db.query('SELECT * FROM contacts WHERE campaign_id = ? ORDER BY created_at', [id]);

      return {
        ...campaign,
        contacts
      };
    } catch (error) {
      console.error('Error getting campaign:', error);
      throw error;
    }
  }

  async createCampaign(data) {
    try {
      const { name, message, delay_min, delay_max, batch_size, batch_delay } = data;

      const result = await db.run(`
        INSERT INTO campaigns (name, message, status, delay_min, delay_max, batch_size, batch_delay, created_at)
        VALUES (?, ?, 'draft', ?, ?, ?, ?, datetime('now'))
      `, [name, message, delay_min || 8, delay_max || 20, batch_size || 50, batch_delay || 10]);

      return {
        id: result.lastInsertRowid,
        name,
        message,
        status: 'draft'
      };
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  }

  async uploadContacts(campaignId, csvFilePath) {
    return new Promise((resolve, reject) => {
      const contacts = [];

      createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          const phone = row.phone || row.number || row.Phone || row.Number || Object.values(row)[0];
          if (phone) {
            contacts.push({
              phone: phone.toString().trim(),
              name: row.name || row.Name || '',
              tag: row.tag || row.Tag || '',
              city: row.city || row.City || '',
              custom_image: row.custom_image || row.image || '',
              custom_doc: row.custom_doc || row.document || ''
            });
          }
        })
        .on('end', () => {
          (async () => {
            try {
              for (const contact of contacts) {
                await db.run(`
                  INSERT INTO contacts (campaign_id, phone, name, tag, city, custom_image, custom_doc, status, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
                `, [campaignId, contact.phone, contact.name, contact.tag, contact.city, contact.custom_image, contact.custom_doc]);
              }

              resolve({
                success: true,
                count: contacts.length
              });
            } catch (error) {
              reject(error);
            }
          })();
        })
        .on('error', reject);
    });
  }

  async startCampaign(id) {
    try {
      // Mark as running
      await db.run('UPDATE campaigns SET status = ?, started_at = datetime(\'now\') WHERE id = ?', ['running', id]);
      const activeLoops = require('../../activeLoops');
      activeLoops[id] = true;
      // TODO: trigger actual send via BulkSenderService (omitted)
      return { success: true, message: 'Campaign started' };
    } catch (error) {
      console.error('Error starting campaign:', error);
      throw error;
    }
  }

  async pauseCampaign(id) {
    try {
      await db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['paused', id]);
      return { success: true, message: 'Campaign paused' };
    } catch (error) {
      console.error('Error pausing campaign:', error);
      throw error;
    }
  }

  async resumeCampaign(id) {
    try {
      await db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['running', id]);
      return { success: true, message: 'Campaign resumed' };
    } catch (error) {
      console.error('Error resuming campaign:', error);
      throw error;
    }
  }

  async updateCampaignStatus(id, status) {
    try {
      await db.run('UPDATE campaigns SET status = ? WHERE id = ?', [status, id]);
      return { success: true };
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  }
  async deleteCampaign(id) {
    try {
      await db.run('DELETE FROM contacts WHERE campaign_id = ?', [id]);
      await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
      return { success: true, message: 'Campaign deleted' };
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  }

  async getCampaignStats(id) {
    try {
      const stats = await db.get(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM contacts
        WHERE campaign_id = ?
      `, [id]);

      return stats;
    } catch (error) {
      console.error('Error getting campaign stats:', error);
      throw error;
    }
  }

  async getBlacklist() {
    try {
      return await db.query('SELECT * FROM blacklist ORDER BY added_at DESC');
    } catch (error) {
      console.error('Error getting blacklist:', error);
      throw error;
    }
  }

  async addToBlacklist(phone, reason = '') {
    try {
      await db.run(`
        INSERT INTO blacklist (phone, reason)
        VALUES (?, ?)
      `, [phone, reason]);
      return { success: true, message: 'Added to blacklist' };
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  }

  async removeFromBlacklist(phone) {
    try {
      await db.run('DELETE FROM blacklist WHERE phone = ?', [phone]);
      return { success: true, message: 'Removed from blacklist' };
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      throw error;
    }
  }
}

module.exports = new CampaignService();
