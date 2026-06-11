# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp Toolkit - A multi-tenant Node.js application for WhatsApp automation with three core features:
1. **Number Validator** - Validate phone numbers against WhatsApp
2. **Bulk Sender** - Campaign-based bulk messaging with database tracking
3. **AI Agent** - Auto-reply bot with Groq AI integration and deal tracking

## Technology Stack

- **Backend**: Node.js + Express
- **WhatsApp Integration**: @whiskeysockets/baileys (v7.0.0-rc13)
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.IO
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Frontend**: Vanilla HTML/CSS/JS with dashboard interface

## Commands

### Development
```bash
# Start the main server
node server.js

# Server will start on http://localhost:3000
# Default credentials: admin/admin123
```

### Testing
```bash
# No automated test suite currently configured
# Manual testing via dashboard at http://localhost:3000/dashboard.html
```

## Architecture

### Multi-Tenant Design

The application uses **per-user isolation** for all WhatsApp clients and data:
- Each user gets their own Baileys WhatsApp socket (stored in `whatsappClients` Map)
- User-specific data stored in Maps: `userStats`, `userMessageHistory`, `userContactMapping`, `userDeals`
- Database queries filtered by `user_id` column for data isolation
- Socket.IO rooms used for per-user real-time updates (`io.to(userId).emit(...)`)

### Core Architecture Pattern

**Monolithic server.js** (4500+ lines):
- All WhatsApp client management happens in server.js
- Services (`agentService`, `bulkSenderService`, `validatorService`) integrate with the centralized WhatsApp clients
- Routes are mounted in server.js but defined in `backend/routes/`

### WhatsApp Client Lifecycle

```javascript
// 1. User connects → initializeWhatsAppClient(userId)
// 2. Baileys creates socket with multi-file auth in .baileys_auth/{userId}/
// 3. QR code emitted → io.to(userId).emit('whatsapp:qr')
// 4. Connection established → userData.isReady = true
// 5. Message handlers attached to sock.ev.on('messages.upsert')
```

### Contact Resolution System (Critical)

WhatsApp uses **LIDs** (Linked Device IDs) which are long numeric identifiers (>15 digits) that don't directly reveal phone numbers. The app implements:

1. **Contact Mapping Cache**: `userContactMapping` Map + `contacts_cache.json` (persistent)
2. **Universal Phone Extraction**: `extractPhoneFromMessage()` checks multiple Baileys message fields
3. **Baileys Contact Events**: `contacts.upsert` and `contacts.update` events populate the cache
4. **Fallback Strategy**: If LID can't be resolved, create tagged identifier like `CustomerName_LID_12345678`
5. **Poisoned Cache Detection**: Automatically removes entries where phone === LID digits (invalid mappings)

**Never block messages due to unresolved LIDs** - always provide a fallback identifier.

### AI Agent Flow

1. Message received → `resolveContactInfo()` → get phone + name
2. Check if deal already exists for customer → if yes, mute AI (unless informational query)
3. Fetch user's business config from `business_config` table
4. Fetch user's products from `products` table
5. Build system prompt with business instructions + product list
6. Get conversation history for this customer (sliding window of 10 messages)
7. Call Groq API → clean response with `cleanAIResponse()`
8. Send reply via Baileys
9. Detect buying intent → create deal in `deal_tracker` table
10. Future messages from this customer (with active deal) → AI muted for non-informational queries

### Database Schema (Supabase)

Key tables:
- `business_config` - Per-user AI prompt and payment details
- `products` - Per-user product catalog with prices
- `deal_tracker` - Detected deals with customer info and status
- `product_media` - Media gallery files (Supabase Storage URLs)
- `campaigns` - Bulk sending campaign metadata
- `campaign_contacts` - Contacts for each campaign

All tables have `user_id` column for multi-tenant isolation.

### File Structure

```
server.js                    # Main server (all WhatsApp client logic)
dashboard.html               # Main dashboard UI
validator.js                 # Standalone validator class
backend/
  routes/                    # API route handlers
    campaigns.js             # Campaign CRUD
    auth.js                  # User authentication
    deals.js                 # Deal management
    validator.js             # Number validation
    groups.js                # Group extraction
  services/                  # Business logic
    agentService.js          # AI agent lifecycle
    bulkSenderService.js     # Bulk message sending
    validatorService.js      # Number validation logic
    whatsappService.js       # WhatsApp client accessor
.baileys_auth/{userId}/      # Per-user Baileys session storage
contacts_cache.json          # Persistent contact mappings (LID → phone)
```

## Important Patterns

### 1. Always Pass userId

Nearly all API endpoints and service methods require `userId` parameter for data isolation:
```javascript
app.get('/api/products', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  // ... query filtered by user_id
});
```

### 2. Socket.IO Room-based Updates

Emit events to specific users only:
```javascript
io.to(userId).emit('whatsapp:ready', { status: 'connected', info });
```

### 3. Baileys Message Sending

```javascript
const sock = userData.client;
await sock.sendMessage(jid, { text: message });
// For images:
await sock.sendMessage(jid, { image: { url: imageUrl }, caption: 'text' });
```

### 4. Contact Cache Persistence

After updating `userContactMapping`, always call:
```javascript
saveContactCacheToDisk();  // Persists to contacts_cache.json
```

### 5. Deal Detection (Strict Buying Intent Only)

Only trigger deals on explicit buying signals:
- "done", "confirmed", "theek", "pack kar do", "payment karu"
- NOT on price inquiries or general questions
- Must not be a question (no "?", "kya", "how", "kitna")

## Environment Variables

Required in `.env`:
```
PORT=3000
GROQ_API_KEY=your_groq_api_key
HEADLESS=true
DEBUG=false
```

Supabase credentials are hardcoded in server.js (lines 38-40) - consider moving to env vars for production.

## Common Issues & Fixes

### Issue: Messages showing LID instead of phone number
- **Cause**: Contact not in cache or poisoned cache entry
- **Fix**: Check `contacts_cache.json`, verify Baileys events are firing, check console logs for "Resolved → Name, Phone"

### Issue: AI responding to customers with active deals
- **Cause**: Informational keyword bypass too broad
- **Fix**: Narrow `informationalKeywords` array in server.js (~line 972)

### Issue: WhatsApp client not reconnecting
- **Cause**: Exceeded MAX_RECONNECT_ATTEMPTS (8)
- **Fix**: User must click "Reconnect" in dashboard or restart server

### Issue: Deal not appearing in dashboard
- **Cause**: Socket.IO emit using wrong column names
- **Fix**: Ensure emit uses database column names (`customer_phone`, `customer_name`, not camelCase)

## Development Workflow

1. **Make changes** to server.js or backend files
2. **Restart server** (no hot reload configured)
3. **Test in dashboard** at http://localhost:3000/dashboard.html
4. **Check console logs** for detailed debugging output (emojis indicate success ✓, errors ❌, warnings ⚠️)

## Spec-Driven Development (SDD)

This project follows SDD principles:
- Read `spec.md` for requirements (if exists)
- Make atomic changes one task at a time
- Verify each change before moving to next task
- Commit after each successful fix
- Ask for user approval before proceeding to next task

## Security Notes

- JWT authentication is basic (default admin/admin123)
- Supabase keys are currently hardcoded (should be in env vars)
- No rate limiting on API endpoints
- File uploads limited to 50MB
- All API endpoints should validate `userId` to prevent cross-tenant data access
