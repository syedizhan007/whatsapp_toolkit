# 🚀 WhatsApp Dashboard - Live Walkthrough Guide

## 📊 CURRENT SYSTEM STATUS

### Agent Status
```json
{"success":true,"data":{"isRunning":false,"status":"offline","clientStatus":"not_initialized"}}
```
✅ Agent is currently **OFFLINE** and ready to start

### Settings Configuration
```json
{"success":true,"data":{"dndEnabled":true,"dndStart":"22:00","dndEnd":"08:00","delaySeconds":60}}
```
✅ DND: **ENABLED** (22:00 - 08:00)
✅ Message Delay: **60 seconds**

### QR Code Status
```json
{"success":true,"data":{"qr":null,"hasQR":false}}
```
✅ No QR code yet (will appear when agent starts)

### Active Campaigns
✅ **13 campaigns** in database (including drafts and completed)

### Blacklist
✅ **17 numbers** currently blacklisted

---

## 🎯 STEP-BY-STEP WORKFLOW

### Step 1: Open the Dashboard

**URL:** http://localhost:3000/dashboard.html

**What you'll see:**
- Agent status showing **OFFLINE** (red dot)
- Start Agent button visible
- Stop Agent button hidden
- All settings panels loaded
- Campaigns table showing loading state
- Blacklist showing loading state

**Auto-refresh:** Every 5 seconds, all data syncs automatically

---

### Step 2: Start the AI Agent

**Action:** Click the **"Start Agent"** button

**What happens:**
1. Backend starts WhatsApp client initialization
2. Agent status changes to **ONLINE**
3. QR code panel appears (if WhatsApp needs authentication)
4. Start button hides, Stop button shows

**API Call:**
```bash
POST /api/agent/start
```

**Expected Response:**
```json
{
  "success": true,
  "message": "AI agent started successfully",
  "status": "online"
}
```

**UI Updates:**
- Status dot turns **green**
- Status text changes to **"ONLINE"**
- QR panel becomes visible (if needed)

---

### Step 3: Scan QR Code (If Needed)

**When:** First time connecting or after session expires

**What you'll see:**
- QR code panel appears automatically
- Large QR code displayed in white box
- Message: "Scan this QR code with WhatsApp to connect"
- Auto-refresh notice: "QR code refreshes automatically every 5 seconds"

**How to scan:**
1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code from the dashboard

**After scanning:**
- QR panel disappears automatically
- Agent status remains **ONLINE**
- WhatsApp is now connected

**API Endpoint:**
```bash
GET /api/agent/qr
```

---

### Step 4: Configure Campaign Settings

#### A. DND (Do Not Disturb) Mode

**Current Status:** ENABLED (22:00 - 08:00)

**To Toggle:**
1. Locate "Campaign Settings" panel
2. Find "DND Mode" section
3. Click **"Toggle DND"** button

**What happens:**
- DND status flips (ON → OFF or OFF → ON)
- Status text updates immediately
- Setting saved to database
- All future campaigns respect this setting

**API Call:**
```bash
POST /api/settings/dnd/toggle
```

**Use Case:**
- Enable DND to skip messages during night hours
- Disable DND to send messages 24/7

---

#### B. Time Window Configuration

**Current Window:** 22:00 - 08:00 (10 PM to 8 AM)

**To Change:**
1. Find "Time Window" section
2. Set **Start Time** (e.g., 21:00)
3. Set **End Time** (e.g., 09:00)
4. Click **"Update Time Window"**

**What happens:**
- New time window saved to database
- Display updates: "Current: 21:00 - 09:00"
- Messages will be skipped during this period
- Alert confirms: "Time window updated successfully!"

**API Call:**
```bash
POST /api/settings/time-window
Body: {"start":"21:00","end":"09:00"}
```

**Use Case:**
- Set quiet hours for your business
- Avoid sending messages when customers are sleeping
- Comply with local regulations

---

#### C. Message Delay

**Current Delay:** 60 seconds

**To Change:**
1. Find "Message Delay" section
2. Enter new delay (0-300 seconds)
3. Click **"Update Delay"**

**What happens:**
- New delay saved to database
- Display updates: "Current: 90 sec"
- System waits this long between messages
- Alert confirms: "Delay updated successfully!"

**API Call:**
```bash
POST /api/settings/delay
Body: {"delaySeconds":90}
```

**Use Case:**
- Increase delay to appear more human
- Decrease delay for urgent campaigns
- Avoid WhatsApp rate limits

---

### Step 5: Manage Campaigns

**View Campaigns:**
- Navigate to "Campaigns" section
- See all campaigns in table format
- Columns: Name, Status, Sent, Failed, Pending, Actions

**Campaign Actions:**

**Pause Campaign:**
- Click pause button (⏸️) on active campaign
- Campaign status changes to "Paused"
- No more messages sent
- UI refreshes automatically

**Resume Campaign:**
- Click play button (▶️) on paused campaign
- Campaign status changes to "Active"
- Messages resume sending
- UI refreshes automatically

**Stop Campaign:**
- Click stop button (⏹️) on any campaign
- Confirmation dialog appears
- Campaign deleted from database
- UI refreshes automatically

**Create New Campaign:**
1. Navigate to "Create Campaign" section
2. Enter campaign name
3. Enter message template
4. Click "Create Campaign"
5. Campaign appears in list immediately

---

### Step 6: Manage Blacklist

**View Blacklist:**
- Navigate to "Campaigns" section
- Find "Blacklist Manager" panel
- See all blacklisted numbers

**Add to Blacklist:**
1. Enter phone number (e.g., +923001234567)
2. Click **"+"** button
3. Number added to database
4. List refreshes automatically
5. Alert confirms: "Number added to blacklist"

**Remove from Blacklist:**
1. Find number in list
2. Click trash icon (🗑️)
3. Confirmation dialog appears
4. Number removed from database
5. List refreshes automatically
6. Alert confirms: "Number removed from blacklist"

**API Calls:**
```bash
POST /api/campaigns/blacklist/add
Body: {"phone":"+923001234567","reason":"Added from dashboard"}

POST /api/campaigns/blacklist/remove
Body: {"phone":"+923001234567"}
```

---

### Step 7: Extract Group Contacts

**Purpose:** Extract phone numbers from WhatsApp groups

**How to use:**
1. Navigate to "Campaigns" section
2. Find "Group Contact Extractor"
3. Enter WhatsApp group link or ID
4. Click **"Extract Contacts"**

**What happens:**
- System connects to WhatsApp group
- Extracts all member phone numbers
- Downloads CSV file automatically
- CSV contains: Name, Phone, Is Admin

**API Call:**
```bash
POST /api/groups/extract
Body: {"groupLink":"https://chat.whatsapp.com/..."}
```

**CSV Format:**
```csv
Name,Phone,Is Admin
John Doe,+923001234567,No
Jane Smith,+923217654321,Yes
```

---

### Step 8: Monitor Live Activity

**Real-Time Updates (Every 5 seconds):**

1. **Agent Status**
   - Green dot = Online
   - Red dot = Offline
   - Updates automatically

2. **QR Code**
   - Appears when needed
   - Refreshes automatically
   - Disappears when authenticated

3. **Settings**
   - DND status
   - Time window
   - Message delay
   - All sync in real-time

4. **Campaigns**
   - Status changes
   - Message counts
   - New campaigns
   - All update automatically

5. **Blacklist**
   - New additions
   - Removals
   - Count updates
   - All sync in real-time

**Console Logs:**
```
🔄 Auto-refresh completed
✅ Agent status loaded: offline
✅ Blacklist loaded: 17 items
✅ Campaigns loaded: 13 items
✅ Settings loaded: {dndEnabled: true, ...}
```

---

## 🎮 INTERACTIVE FEATURES

### Dashboard Sections

1. **Overview** - Stats and charts
2. **Validator** - Phone number validation
3. **Campaigns** - Campaign management + Blacklist + Group extractor
4. **AI Agent** - Agent control + QR code + Settings
5. **Deals** - Deal tracking
6. **Settings** - System configuration

### Navigation
- Click sidebar menu items to switch sections
- Mobile: Hamburger menu for sidebar
- All sections load instantly

---

## 🔧 TROUBLESHOOTING

### Agent Won't Start
**Problem:** Click "Start Agent" but nothing happens

**Solutions:**
1. Check console for errors (F12)
2. Verify backend is running: `curl http://localhost:3000/api/health`
3. Check if port 3000 is available
4. Restart backend server

### QR Code Not Appearing
**Problem:** Agent started but no QR code

**Possible Reasons:**
1. WhatsApp already authenticated (check session folder)
2. QR not generated yet (wait 10 seconds)
3. Check API: `curl http://localhost:3000/api/agent/qr`

**Solution:**
- Wait for auto-refresh (5 seconds)
- Check if `hasQR: true` in API response

### Settings Not Saving
**Problem:** Change settings but they revert

**Solutions:**
1. Check database permissions
2. Verify API response: Should return `success: true`
3. Check console for errors
4. Restart backend to reinitialize database

### UI Not Updating
**Problem:** Make changes but UI doesn't reflect them

**Solutions:**
1. Check auto-refresh is working (console logs)
2. Hard refresh browser (Ctrl+F5)
3. Check network tab for API calls
4. Verify backend is responding

---

## 📱 MOBILE RESPONSIVE

**Dashboard works on:**
- ✅ Desktop (1920x1080+)
- ✅ Laptop (1366x768+)
- ✅ Tablet (768x1024)
- ✅ Mobile (375x667+)

**Mobile Features:**
- Hamburger menu for navigation
- Touch-friendly buttons
- Responsive tables
- Optimized layouts

---

## 🎯 BEST PRACTICES

### Campaign Management
1. **Test First:** Create small test campaign before bulk sending
2. **Use Blacklist:** Add opted-out numbers immediately
3. **Monitor Status:** Check campaign progress regularly
4. **Adjust Delay:** Increase if getting rate limited

### DND Configuration
1. **Respect Local Time:** Set appropriate quiet hours
2. **Legal Compliance:** Follow local messaging regulations
3. **Customer Preference:** Honor customer time zones

### Message Delay
1. **Start Conservative:** Begin with 45-60 seconds
2. **Monitor Results:** Watch for delivery failures
3. **Adjust Gradually:** Increase/decrease based on performance

### Blacklist Management
1. **Add Immediately:** When customer opts out
2. **Regular Review:** Clean up old entries
3. **Export Backup:** Download blacklist periodically

---

## ✅ VERIFICATION CHECKLIST

Before starting campaigns:
- [ ] Agent is ONLINE
- [ ] WhatsApp is authenticated (no QR showing)
- [ ] DND settings configured
- [ ] Time window set correctly
- [ ] Message delay appropriate
- [ ] Blacklist up to date
- [ ] Test campaign created
- [ ] Contacts uploaded

---

## 🚀 YOU'RE READY!

Your WhatsApp Dashboard is **fully operational** with:
- ✅ Real-time agent monitoring
- ✅ Live QR code authentication
- ✅ Dynamic DND control
- ✅ Configurable time windows
- ✅ Adjustable message delays
- ✅ Campaign management
- ✅ Blacklist management
- ✅ Group contact extraction
- ✅ Auto-refresh every 5 seconds

**Start using it now at:** http://localhost:3000/dashboard.html

**Need help?** Check the console logs (F12) for detailed debugging information.
