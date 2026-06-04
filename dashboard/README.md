# WhatsApp Business Toolkit - Dashboard

A modern, real-time dashboard for managing WhatsApp automation tools with live data synchronization.

## 🚀 Quick Start

### Option 1: Use Startup Scripts (Recommended)

**Windows:**
```bash
start-dashboard.bat
```

**Linux/Mac:**
```bash
./start-dashboard.sh
```

This starts both servers and opens the dashboard in your browser:
- Dashboard Server: http://localhost:3000
- Status API Server: http://localhost:3001

### Option 2: Manual Start

**Terminal 1 - Start Status Server:**
```bash
cd whatsapp-mcp
node status-server.js
```

**Terminal 2 - Start Dashboard Server:**
```bash
cd dashboard
node server.js
```

Then open: http://localhost:3000

### Option 3: Using npm

```bash
cd dashboard
npm start
```

## 🏗️ Server Architecture

```
┌─────────────────────────────────────────┐
│  Dashboard (Port 3000)                  │
│  - Serves static HTML/CSS/JS files      │
│  - User interface                       │
└─────────────────┬───────────────────────┘
                  │
                  │ HTTP Requests (CORS enabled)
                  │
┌─────────────────▼───────────────────────┐
│  Status Server (Port 3001)              │
│  - REST API endpoints                   │
│  - Agent status & control               │
│  - Deals data                           │
│  - Real-time statistics                 │
└─────────────────────────────────────────┘
```

## 📡 API Endpoints

### Status Server (Port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get dashboard statistics and agent status |
| GET | `/deals` | Get all deals |
| POST | `/start` | Start the AI agent |
| POST | `/stop` | Stop the AI agent |

### Example API Response

**GET /status**
```json
{
  "agent_online": true,
  "total_deals": 42,
  "pending_deals": 15,
  "completed_deals": 27,
  "today_deals": 8,
  "messages_replied": 42
}
```

## ✨ Features

### ✅ Complete Sections
1. **Dashboard Overview** - Real-time stats with auto-refresh (10s)
2. **Number Validator** - Bulk WhatsApp number validation
3. **Bulk Sender** - Campaign management and message sending
4. **AI Agent** - Automated customer support with Start/Stop controls
5. **Deals Tracker** - Customer deals management with live updates
6. **Settings** - API configuration

### 🎨 Design Features
- ✨ Dark theme with glassmorphism effects
- 🎯 Smooth animations and transitions
- 📱 Fully mobile responsive
- 📊 Interactive charts (Chart.js)
- 🎭 Hover effects and ripple animations
- 🎨 Color-coded badges and status indicators
- 🔄 Auto-refresh every 10 seconds

### 🤖 Agent Status Synchronization

The dashboard uses a **single source of truth** for agent status:
- `window.AGENT_STATUS` - Global status variable
- `updateAgentEverywhere()` - Updates all UI elements simultaneously

When agent status changes (via Start/Stop buttons or auto-refresh):
1. ✅ Dashboard Overview card updates
2. ✅ AI Agent section status indicator updates
3. ✅ Sidebar status dot updates
4. ✅ Robot icon pulse animation updates
5. ✅ Start/Stop button visibility toggles

**No more sync issues!** All status displays update together.

## 📊 Features by Section

### 1. Dashboard Overview
- Live stats cards with animations
- Campaign performance line chart
- Deals overview doughnut chart
- Real-time agent status with auto-refresh
- Auto-counting numbers on load

### 2. Number Validator
- Upload CSV file with numbers
- Progress bar tracking
- Valid/Invalid count display with glowing counters
- Results table with status badges
- Export functionality

### 3. Bulk Sender
- Create new campaigns with templates
- Campaign management table
- Pause/Resume/Stop controls
- Sent/Failed/Pending stats
- Batch processing with DND respect
- Group contact extraction
- Blacklist management

### 4. AI Agent
- **Start/Stop/Restart controls** (connected to API)
- Live messages feed with terminal-style display
- Business instructions editor
- Products & prices manager
- **Real-time status synchronization**
- Online/Offline status with pulse animations

### 5. Deals Tracker
- All deals table view with live data
- Export to CSV functionality
- Status badges (Pending/Completed)
- Customer information display
- Filter and search capabilities
- Auto-refresh every 10 seconds

### 6. Settings
- API key configuration
- Supabase integration settings
- Save preferences

## 🔄 Auto-Refresh System

The dashboard automatically refreshes data every 10 seconds:
- ✅ Agent status (from `/status` endpoint)
- ✅ Deal statistics
- ✅ Message counts
- ✅ All UI elements synchronized

## 🛠️ Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: Port 3000 is already in use`

**Solution:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### CORS Errors

If you see CORS errors in the browser console:
1. Make sure status-server.js is running on port 3001
2. Check that CORS headers are properly set (already configured)
3. Clear browser cache and reload

### Dashboard Not Loading Data

1. Check if status server is running: http://localhost:3001/status
2. Open browser console (F12) to see error messages
3. Verify both servers are running on correct ports
4. Check that `whatsapp-mcp/deals.json` exists

### Agent Start/Stop Not Working

1. Verify status server is running on port 3001
2. Check browser console for API errors
3. Ensure CORS is enabled in status-server.js
4. Test endpoints manually: `curl -X POST http://localhost:3001/start`

## 📁 File Structure

```
whatsapptool/
├── dashboard/
│   ├── index.html          # Main dashboard (single-page app)
│   ├── server.js           # Dashboard HTTP server
│   ├── package.json        # npm configuration
│   └── README.md          # This file
├── whatsapp-mcp/
│   ├── status-server.js   # Status API server (port 3001)
│   └── deals.json         # Deals data storage
├── start-dashboard.bat    # Windows startup script
└── start-dashboard.sh     # Linux/Mac startup script
```

## 🔌 Backend Integration

The dashboard is now **fully integrated** with the backend API:

### Connected Features
- ✅ Real-time agent status from `/status` endpoint
- ✅ Deals data from `/deals` endpoint
- ✅ Start agent via POST `/start`
- ✅ Stop agent via POST `/stop`
- ✅ Auto-refresh every 10 seconds
- ✅ CORS enabled for cross-origin requests

### API Integration Example
```javascript
// Fetch agent status
async function fetchStatus() {
    const response = await fetch('http://localhost:3001/status');
    const status = await response.json();
    updateAgentEverywhere(status.agent_online);
}

// Start agent
async function startAgent() {
    const response = await fetch('http://localhost:3001/start', {
        method: 'POST'
    });
    if (response.ok) {
        updateAgentEverywhere(true);
    }
}
```

## 🎯 Interactive Features

### Animations
- **Hover effects** on all cards
- **Ripple effect** on button clicks
- **Slide-in animations** on page load
- **Progress bars** with smooth transitions

### Stats Cards
- Auto-counting numbers on load
- Gradient text effects
- Icon animations
- Percentage change indicators

### Charts
- Responsive and interactive
- Smooth animations
- Custom color scheme
- Real-time updates ready

## 🎯 Interactive Features

### Animations
- **Hover effects** on all cards with glassmorphism
- **Ripple effect** on button clicks
- **Slide-in animations** on page load
- **Progress bars** with smooth transitions
- **Pulse animations** for online status indicators
- **Glow effects** on counters and active elements

### Stats Cards
- Auto-counting numbers on load with smooth animation
- Gradient text effects
- Icon animations
- Percentage change indicators
- Real-time updates from API

### Charts
- Responsive and interactive (Chart.js)
- Smooth animations
- Custom color scheme matching theme
- Real-time data updates

## 📱 Mobile Responsive

- ✅ Sidebar collapses on mobile with hamburger menu
- ✅ Touch-friendly buttons and controls
- ✅ Optimized grid layouts for small screens
- ✅ Smooth transitions and animations
- ✅ Swipe gestures supported

## 🎨 Customization

### Colors (CSS Variables)
Edit the `:root` section in `index.html`:
```css
--primary: #00d4ff;      /* Main accent color */
--secondary: #7c3aed;    /* Secondary accent */
--success: #10b981;      /* Success states */
--warning: #f59e0b;      /* Warning states */
--danger: #ef4444;       /* Error states */
--dark-bg: #0a0e27;      /* Background */
--card-bg: rgba(15, 23, 42, 0.6);  /* Card background */
```

### Server Ports
Edit server configuration files:
- Dashboard: `dashboard/server.js` (default: 3000)
- Status API: `whatsapp-mcp/status-server.js` (default: 3001)

## 🌟 Browser Support

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ⚠️ Internet Explorer (Not supported)

## 📝 Technical Notes

- Dashboard is a **single-page application** (SPA)
- Uses **CDN** for Chart.js, Font Awesome, and VanillaTilt
- **No build process** required
- **CORS enabled** for cross-origin API requests
- **Auto-refresh** every 10 seconds
- **Graceful error handling** for offline scenarios

## 🔐 Security Considerations

- Dashboard runs on localhost only (not exposed to internet)
- No authentication required for local development
- API keys should be stored in environment variables
- CORS is set to `*` for development (restrict in production)

## 🚀 Production Deployment

For production use:

1. **Add authentication** to both servers
2. **Restrict CORS** to specific domains
3. **Use HTTPS** with SSL certificates
4. **Add rate limiting** to API endpoints
5. **Implement proper logging** and monitoring
6. **Use environment variables** for configuration
7. **Add database** instead of JSON files

## 📚 Additional Resources

- [Chart.js Documentation](https://www.chartjs.org/)
- [Font Awesome Icons](https://fontawesome.com/icons)
- [Express.js Guide](https://expressjs.com/)
- [WhatsApp Web.js](https://wwebjs.dev/)

## 🐛 Known Issues

- Agent start/stop currently returns mock responses (implement actual process control)
- Deals data stored in JSON file (consider database for production)
- No authentication system (add for production)

## 🤝 Contributing

To add new features:

1. Edit `dashboard/index.html` for UI changes
2. Edit `whatsapp-mcp/status-server.js` for API changes
3. Test both servers together
4. Update this README with new features

## 📄 License

MIT

---

**Created with ❤️ for WhatsApp Business Automation**

**Version:** 2.0.0 (Server-based with real-time sync)
