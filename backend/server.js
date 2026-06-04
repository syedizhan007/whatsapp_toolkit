const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const net = require('net');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const errorHandler = require('./middleware/errorHandler');
const { initializeWebSocket } = require('./utils/websocket');

// Import routes
const authRoutes = require('./routes/auth');
const validatorRoutes = require('./routes/validator');
const campaignRoutes = require('./routes/campaigns');
const agentRoutes = require('./routes/agent');
const dealsRoutes = require('./routes/deals');
const groupsRoutes = require('./routes/groups');
const settingsRoutes = require('./routes/settings');
const bulkCampaignsRoutes = require('./routes/bulkCampaigns');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (reason && reason.stack) {
    console.error('Stack:', reason.stack);
  }
  // Don't exit - keep server running
});

// Async error wrapper for route handlers
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('❌ Async route error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: error.message || 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });
  };
}

// Check if port is already in use
function checkPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
}

// Security middleware - Configure helmet to allow inline scripts and CDN resources
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3001", "ws://localhost:3001", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request timeout middleware - prevent hanging requests
// Exclude long-running operations
app.use((req, res, next) => {
  // Skip timeout for agent operations and bulk sender operations (WhatsApp initialization takes time)
  if (req.url.includes('/api/agent/start') ||
      req.url.includes('/api/agent/stop') ||
      req.url.includes('/api/bulk/')) {
    return next();
  }

  // Set timeout to 60 seconds for other requests
  req.setTimeout(60000, () => {
    console.error('Request timeout:', req.method, req.url);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Request timeout'
      });
    }
  });

  res.setTimeout(60000, () => {
    console.error('Response timeout:', req.method, req.url);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Response timeout'
      });
    }
  });

  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// Root redirect to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// API routes - mount routers directly
app.use('/api/auth', authRoutes);
app.use('/api/validator', validatorRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/bulk', bulkCampaignsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Dashboard stats endpoint
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = {
      totalMessages: 0,
      totalDeals: 0,
      validNumbers: 0,
      agentStatus: 'offline'
    };
    // TODO: Implement actual stats gathering from services
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get dashboard stats'
    });
  }
});

// Error handling - must be last
app.use(errorHandler);

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server with port checking
async function startServer() {
  try {
    const portInUse = await checkPortInUse(PORT);

    if (portInUse) {
      console.error(`❌ Port ${PORT} is already in use. Server may already be running.`);
      console.log('💡 To fix: Stop the existing server or use a different port.');
      process.exit(1);
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🔌 API: http://localhost:${PORT}/api`);
    });

    // Initialize WebSocket for real-time updates
    initializeWebSocket(server);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\nSIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
