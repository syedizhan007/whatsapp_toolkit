# Revert Instructions for JID Normalization Fix

## If Test Probe Fails

If you see this message on server startup:
```
❌ TEST PROBE FAILED - JID normalization wrapper has issues!
```

Follow these steps to revert:

### Step 1: Remove jidNormalizedUser from imports

**Line 21** - Change:
```javascript
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = require('@whiskeysockets/baileys');
```

Back to:
```javascript
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
```

### Step 2: Remove safeNormalizeJid function and test probe

**Lines 42-150** - Delete everything from:
```javascript
// ===== SAFE JID WRAPPER FOR BAILEYS onWhatsApp() =====
```

Until (but not including):
```javascript
// ===== SUPABASE CLIENT =====
```

### Step 3: Revert first onWhatsApp call

**Around line 5110** - Change:
```javascript
const normalizedJid = safeNormalizeJid(jid);
apiResult = await userData.client.onWhatsApp([normalizedJid]);
```

Back to:
```javascript
apiResult = await userData.client.onWhatsApp([jid]);
```

### Step 4: Revert second onWhatsApp call

**Around line 5177** - Change:
```javascript
const normalizedJidRetry = safeNormalizeJid(jid);
result = await userData.client.onWhatsApp([normalizedJidRetry]);
```

Back to:
```javascript
result = await userData.client.onWhatsApp([jid]);
```

### Step 5: Restart server and verify

```bash
node server.js
```

You should no longer see the test probe messages.

## Notify User

After reverting, notify the user:
- Test probe failed
- Changes have been reverted
- Server is back to previous state
- TypeError catching is still in place (from earlier implementation)
