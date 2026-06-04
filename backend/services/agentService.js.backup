const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const whatsappService = require('./whatsappService');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

class AgentService {
  constructor() {
    this.agentProcess = null;
    this.isRunning = false;
    this.currentQR = null;
    this.dealsPath = path.join(__dirname, '..', '..', process.env.DEALS_JSON_PATH || './whatsapp-mcp/deals.json');
    this.configPath = path.join(__dirname, '..', '..', 'whatsapp-mcp', 'business-instructions.txt');

    // Load initial status from database
    this.loadStatusFromDatabase();
  }

  async loadStatusFromDatabase() {
    try {
      const { data, error } = await supabase
        .from('business_config')
        .select('is_active')
        .eq('id', 1)
        .single();

      if (!error && data && typeof data.is_active === 'boolean') {
        this.isRunning = data.is_active;
        console.log(`✓ Agent status loaded from database: ${this.isRunning ? 'ONLINE' : 'OFFLINE'}`);
      }
    } catch (error) {
      console.error('⚠️ Could not load agent status from database:', error.message);
    }
  }

  async updateDatabaseStatus(isActive) {
    try {
      const { error } = await supabase
        .from('business_config')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) {
        console.error('❌ Error updating agent status in database:', error.message);
        return false;
      }

      console.log(`✓ Agent status persisted to database: ${isActive ? 'ONLINE' : 'OFFLINE'}`);
      return true;
    } catch (error) {
      console.error('❌ Exception updating database status:', error.message);
      return false;
    }
  }

  async startAgent() {
    if (this.isRunning) {
      return {
        status: 'online',
        message: 'Agent is already running'
      };
    }

    // Mark as starting immediately
    this.isRunning = true;

    // Update database status
    await this.updateDatabaseStatus(true);

    // Initialize WhatsApp client asynchronously (don't wait)
    this.initializeWhatsAppClient().catch(error => {
      console.error('Failed to initialize WhatsApp client:', error);
      this.isRunning = false;
      this.updateDatabaseStatus(false);
    });

    return {
      status: 'online',
      message: 'AI agent started successfully'
    };
  }

  async initializeWhatsAppClient() {
    try {
      // Listen for QR code events from WhatsApp service
      whatsappService.once('qr', (data) => {
        if (data.clientId === 'ai-agent') {
          this.currentQR = data.qr;
          console.log('QR Code generated for AI agent');
        }
      });

      // Listen for ready event to clear QR
      whatsappService.once('ready', (data) => {
        if (data.clientId === 'ai-agent') {
          this.currentQR = null;
          console.log('WhatsApp client authenticated, QR cleared');
        }
      });

      const client = await whatsappService.initializeClient(
        'ai-agent',
        process.env.AI_AGENT_SESSION_PATH || './.wwebjs_auth_agent'
      );

      console.log('WhatsApp client initialized successfully');
    } catch (error) {
      // Handle specific browser lock error
      if (error.message && error.message.includes('browser is already running')) {
        throw new Error('WhatsApp session is already active. Please stop any running WhatsApp instances first.');
      }
      throw new Error('Failed to start agent: ' + (error.message || 'Unknown error'));
    }
  }

  async stopAgent() {
    if (!this.isRunning) {
      return {
        status: 'offline',
        message: 'Agent is already stopped'
      };
    }

    try {
      // Try to destroy the AI agent WhatsApp client
      try {
        await whatsappService.destroyClient('ai-agent');
      } catch (destroyError) {
        console.log('Warning: Could not destroy client:', destroyError.message);
        // Continue anyway - we still want to mark as stopped
      }

      this.isRunning = false;

      // Update database status
      await this.updateDatabaseStatus(false);

      return {
        status: 'offline',
        message: 'AI agent stopped successfully'
      };
    } catch (error) {
      this.isRunning = false; // Mark as stopped even if error
      await this.updateDatabaseStatus(false);
      throw new Error('Failed to stop agent: ' + (error.message || 'Unknown error'));
    }
  }

  getAgentStatus() {
    return {
      isRunning: this.isRunning,
      status: this.isRunning ? 'online' : 'offline',
      clientStatus: whatsappService.getClientStatus('ai-agent')
    };
  }

  getQRCode() {
    return {
      qr: this.currentQR,
      hasQR: this.currentQR !== null
    };
  }

  async getDeals() {
    try {
      const fileExists = await fs.access(this.dealsPath).then(() => true).catch(() => false);

      if (!fileExists) {
        return [];
      }

      const data = await fs.readFile(this.dealsPath, 'utf8');
      const deals = JSON.parse(data);
      return Array.isArray(deals) ? deals : [];
    } catch (error) {
      console.error('Error reading deals:', error);
      return [];
    }
  }

  async getDealById(id) {
    const deals = await this.getDeals();
    return deals.find(deal => deal.id === id);
  }

  async updateDeal(id, updates) {
    try {
      const deals = await this.getDeals();
      const dealIndex = deals.findIndex(deal => deal.id === id);

      if (dealIndex === -1) {
        throw new Error('Deal not found');
      }

      deals[dealIndex] = {
        ...deals[dealIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await fs.writeFile(this.dealsPath, JSON.stringify(deals, null, 2));

      return deals[dealIndex];
    } catch (error) {
      throw error;
    }
  }

  async deleteDeal(id) {
    try {
      const deals = await this.getDeals();
      const filteredDeals = deals.filter(deal => deal.id !== id);

      if (deals.length === filteredDeals.length) {
        throw new Error('Deal not found');
      }

      await fs.writeFile(this.dealsPath, JSON.stringify(filteredDeals, null, 2));

      return { success: true, message: 'Deal deleted' };
    } catch (error) {
      throw error;
    }
  }

  async getConfig() {
    try {
      const fileExists = await fs.access(this.configPath).then(() => true).catch(() => false);

      if (!fileExists) {
        return { instructions: '' };
      }

      const instructions = await fs.readFile(this.configPath, 'utf8');
      return { instructions };
    } catch (error) {
      console.error('Error reading config:', error);
      return { instructions: '' };
    }
  }

  async updateConfig(instructions) {
    try {
      await fs.writeFile(this.configPath, instructions, 'utf8');
      return { success: true, message: 'Configuration updated' };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AgentService();
