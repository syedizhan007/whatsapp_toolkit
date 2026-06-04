const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const settingsService = require('../services/settingsService');

const router = express.Router();

// TEMPORARY: Authentication disabled for testing
// TODO: Re-enable after testing
// router.use(authenticateToken);

// GET /api/settings - Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get settings'
    });
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res) => {
  try {
    const { dndEnabled, dndStart, dndEnd, delaySeconds } = req.body;

    const updates = {};
    if (dndEnabled !== undefined) updates.dndEnabled = dndEnabled;
    if (dndStart !== undefined) updates.dndStart = dndStart;
    if (dndEnd !== undefined) updates.dndEnd = dndEnd;
    if (delaySeconds !== undefined) updates.delaySeconds = delaySeconds;

    const settings = await settingsService.updateSettings(updates);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update settings'
    });
  }
});

// GET /api/settings/dnd - Get DND status
router.get('/dnd', async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    const isInDND = await settingsService.isInDNDPeriod();
    res.json({
      success: true,
      data: {
        enabled: settings.dndEnabled,
        start: settings.dndStart,
        end: settings.dndEnd,
        isCurrentlyInDND: isInDND
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get DND settings'
    });
  }
});

// POST /api/settings/dnd/toggle - Toggle DND on/off
router.post('/dnd/toggle', async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    const newState = !settings.dndEnabled;

    await settingsService.updateSettings({ dndEnabled: newState });

    res.json({
      success: true,
      message: `DND ${newState ? 'enabled' : 'disabled'}`,
      data: {
        enabled: newState
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle DND'
    });
  }
});

// POST /api/settings/time-window - Update time window
router.post('/time-window', (req, res) => {
  try {
    const { start, end } = req.body;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Start and end times are required'
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:MM'
      });
    }

    settingsService.updateSettings({
      dndStart: start,
      dndEnd: end
    });

    res.json({
      success: true,
      message: 'Time window updated',
      data: {
        start,
        end
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update time window'
    });
  }
});

// GET /api/settings/delay - Get message delay
router.get('/delay', async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json({
      success: true,
      data: {
        delaySeconds: settings.delaySeconds
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get delay setting'
    });
  }
});

// POST /api/settings/delay - Update message delay
router.post('/delay', async (req, res) => {
  try {
    const { delaySeconds } = req.body;

    if (delaySeconds === undefined || delaySeconds === null) {
      return res.status(400).json({
        success: false,
        message: 'delaySeconds is required'
      });
    }

    const delay = parseInt(delaySeconds, 10);
    if (isNaN(delay) || delay < 0 || delay > 300) {
      return res.status(400).json({
        success: false,
        message: 'Delay must be between 0 and 300 seconds'
      });
    }

    await settingsService.updateSettings({ delaySeconds: delay });

    res.json({
      success: true,
      message: 'Delay updated',
      data: {
        delaySeconds: delay
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update delay'
    });
  }
});

module.exports = router;
