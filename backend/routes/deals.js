const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const agentService = require('../services/agentService');

const router = express.Router();

// TEMPORARY: Authentication disabled for testing
// TODO: Re-enable after testing
// router.use(authenticateToken);

// GET /api/deals - Get all deals
router.get('/', async (req, res) => {
  try {
    const deals = await agentService.getDeals();
    res.json({
      success: true,
      data: deals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get deals'
    });
  }
});

// GET /api/deals/:id - Get specific deal
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deal = await agentService.getDealById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    res.json({
      success: true,
      data: deal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get deal'
    });
  }
});

// PUT /api/deals/:id - Update deal
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedDeal = await agentService.updateDeal(id, updates);

    res.json({
      success: true,
      message: 'Deal updated successfully',
      data: updatedDeal
    });
  } catch (error) {
    if (error.message === 'Deal not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update deal'
    });
  }
});

// DELETE /api/deals/:id - Delete deal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await agentService.deleteDeal(id);

    res.json({
      success: true,
      message: 'Deal deleted successfully',
      data: result
    });
  } catch (error) {
    if (error.message === 'Deal not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete deal'
    });
  }
});

module.exports = router;
