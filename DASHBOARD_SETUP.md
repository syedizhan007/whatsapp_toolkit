# Dashboard Setup Guide

## What Was Fixed

The dashboard now shows **REAL DATA** instead of fake hardcoded numbers.

### Changes Made:

1. **Created Status Server** (`whatsapp-mcp/status-server.js`)
   - Runs on port 3001
   - Provides real-time statistics from `deals.json`
   - Auto-detects if WhatsApp agent is online

2. **Updated Dashboard** (`dashboard/index.html`)
   - Removed all fake hardcoded data
   - Fetches real data from status server
   - Auto-refreshes every 10 seconds
   - Shows "Offline" when agent is not running

3. **Added npm Script**
   - `npm run status` - starts the status server

## How to Run

### Option 1: Run Both Services (Recommended)

**Terminal 1 - Start WhatsApp Agent:**
```bash
cd whatsapp-mcp
npm run auto-reply
```

**Terminal 2 - Start Status Server:**
```bash
cd whatsapp-mcp
npm run status
```

**Terminal 3 - Open Dashboard:**
```bash
cd dashboard
# Open index.html in your browser
start index.html  # Windows
# or just double-click index.html
```

### Option 2: Status Server Only (View Existing Data)

If you just want to view the dashboard without running the agent:

```bash
cd whatsapp-mcp
npm run status
```

Then open `dashboard/index.html` in your browser.

## What You'll See

### Dashboard Stats (Real Data):
- **Total Messages Sent**: Count from deals.json
- **Deals Locked**: Total deals in deals.json
- **AI Agent Status**: 
  - ✅ **Online** - Agent is running (`.wwebjs_auth` folder exists)
  - ❌ **Offline** - Agent is not running
- **Numbers Validated**: 0 (not implemented yet)

### Deals Page:
- Shows all deals from `deals.json`
- Real customer names, phone numbers, messages
- Actual timestamps
- Pending/Completed status

## API Endpoints

The status server provides two endpoints:

### GET /status
Returns dashboard statistics:
```json
{
  "agent_online": true,
  "total_deals": 5,
  "pending_deals": 5,
  "completed_deals": 0,
  "today_deals": 0,
  "messages_replied": 5
}
```

### GET /deals
Returns full deals array from `deals.json`

## Auto-Refresh

The dashboard automatically refreshes data every **10 seconds**, so you'll see new deals appear in real-time as the agent processes messages.

## Troubleshooting

### Dashboard shows "Offline" or "0" everywhere
- Make sure the status server is running: `npm run status`
- Check if it's running on port 3001: `curl http://localhost:3001/status`

### "Failed to fetch" errors in browser console
- Status server is not running
- Port 3001 is blocked by firewall
- CORS issue (should be fixed, but check browser console)

### Agent shows "Offline" but it's running
- The agent needs the `.wwebjs_auth` folder to be detected as online
- Make sure you've scanned the QR code at least once

## Next Steps

To make the dashboard even better:
1. Add number validator integration
2. Add bulk sender statistics
3. Add real-time message feed
4. Add charts with historical data
