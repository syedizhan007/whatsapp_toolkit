const WebSocket = require('ws');
const { getInstance } = require('../services/bulkSenderService');

let wss;

function initializeWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('✓ WebSocket client connected');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        const service = getInstance();

        if (data.type === 'stop-campaign') {
          console.log(`Stopping campaign ${data.id}...`);
          await service.stopCampaign(data.id);
          broadcastUpdate('campaign:stopped', { id: data.id });
        } else if (data.type === 'pause-campaign') {
          console.log(`Pausing campaign ${data.id}...`);
          await service.pauseCampaign(data.id);
          broadcastUpdate('campaign:paused', { id: data.id });
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    }));
  });

  console.log('✓ WebSocket server initialized on /ws');
}

function broadcastUpdate(type, data) {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  let clientCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      clientCount++;
    }
  });

  if (clientCount > 0) {
    console.log(`Broadcast ${type} to ${clientCount} client(s)`);
  }
}

module.exports = {
  initializeWebSocket,
  broadcastUpdate
};
