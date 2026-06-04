const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const agentService = require('../services/agentService');
const { broadcastUpdate } = require('../utils/websocket');

const router = express.Router();

// Store io instance for Socket.io broadcasting
let io = null;

// Function to set Socket.io instance
router.setSocketIO = (socketIO) => {
  io = socketIO;
};

// TEMPORARY: Authentication disabled for testing
// TODO: Re-enable after testing
// router.use(authenticateToken);

// GET /api/agent/status - Get agent status
router.get('/status', (req, res) => {
  try {
    const status = agentService.getAgentStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get agent status'
    });
  }
});

// POST /api/agent/start - Start AI agent
router.post('/start', async (req, res) => {
  try {
    const result = await agentService.startAgent();

    // Broadcast via WebSocket
    broadcastUpdate('agent:status', {
      status: result.status,
      message: result.message
    });

    // Emit via Socket.io if available
    if (io) {
      io.emit('agent-status', {
        status: result.status,
        enabled: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: result.message,
      status: result.status,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start AI agent',
      status: 'offline'
    });
  }
});

// POST /api/agent/stop - Stop AI agent
router.post('/stop', async (req, res) => {
  try {
    const result = await agentService.stopAgent();

    // Broadcast via WebSocket
    broadcastUpdate('agent:status', {
      status: result.status,
      message: result.message
    });

    // Emit via Socket.io if available
    if (io) {
      io.emit('agent-status', {
        status: result.status,
        enabled: false,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: result.message,
      status: result.status,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to stop AI agent',
      status: 'offline'
    });
  }
});

// GET /api/agent/config - Get business instructions
router.get('/config', async (req, res) => {
  try {
    const config = await agentService.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get configuration'
    });
  }
});

// GET /api/agent/qr - Get QR code for WhatsApp authentication
router.get('/qr', (req, res) => {
  try {
    const qrData = agentService.getQRCode();
    res.json({
      success: true,
      data: qrData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get QR code'
    });
  }
});

// PUT /api/agent/config - Update business instructions
router.put('/config', async (req, res) => {
  try {
    const { instructions } = req.body;

    if (!instructions) {
      return res.status(400).json({
        success: false,
        message: 'Instructions are required'
      });
    }

    const result = await agentService.updateConfig(instructions);

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update configuration'
    });
  }
});

module.exports = router;
