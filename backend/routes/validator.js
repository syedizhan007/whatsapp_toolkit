const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validatorService = require('../services/validatorService');
const { broadcastUpdate } = require('../utils/websocket');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/validator/validate - Start validation
router.post('/validate', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file required'
      });
    }

    const jobId = uuidv4();
    const csvFilePath = req.file.path;

    // Start validation in background
    validatorService.startValidation(jobId, csvFilePath, (progress) => {
      // Broadcast progress via WebSocket
      broadcastUpdate('validator:progress', {
        jobId,
        status: progress.status,
        total: progress.total,
        processed: progress.processed,
        valid: progress.valid,
        invalid: progress.invalid
      });
    }).catch(error => {
      console.error('Validation error:', error);
      broadcastUpdate('validator:error', {
        jobId,
        error: error.message
      });
    });

    res.json({
      success: true,
      message: 'Validation started',
      data: {
        jobId,
        status: 'running'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start validation'
    });
  }
});

// GET /api/validator/status/:jobId - Get validation status
router.get('/status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = validatorService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        total: job.total,
        processed: job.processed,
        valid: job.valid,
        invalid: job.invalid,
        startTime: job.startTime,
        endTime: job.endTime
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start validation'
    });
  }
});

// GET /api/validator/results/:jobId - Get validation results
router.get('/results/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = validatorService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        jobId,
        status: job.status,
        total: job.total,
        valid: job.valid,
        invalid: job.invalid,
        results: job.results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start validation'
    });
  }
});

// GET /api/validator/download/:jobId/:type - Download results CSV
router.get('/download/:jobId/:type', (req, res) => {
  try {
    const { jobId, type } = req.params;

    if (!['valid', 'invalid'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be valid or invalid'
      });
    }

    const filePath = path.join(
      process.env.UPLOAD_DIR || './uploads',
      `${jobId}_${type}.csv`
    );

    res.download(filePath, `${type}_numbers.csv`, (err) => {
      if (err) {
        res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start validation'
    });
  }
});

module.exports = router;
