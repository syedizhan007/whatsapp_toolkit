# Frontend Updates Required

## Overview
The backend has been updated to require `userId` for multi-user isolation. All API endpoints now expect a `userId` parameter. The frontend must be updated to pass this parameter in all API calls.

---

## ✅ Already Working
- Socket.IO connection already passes userId correctly:
  ```javascript
  auth: { userId: user.id }  // ✓ This is already correct
  ```

---

## ❌ Needs Fixing

### Critical API Endpoints Requiring userId

The following endpoints in `dashboard.html` need to include `userId` in their requests:

#### 1. WhatsApp Status & Control
```javascript
// LINE ~4066, ~4719: GET /api/stats
// BEFORE:
const response = await fetch('/api/stats');

// AFTER:
const response = await fetch(`/api/stats?userId=${user.id}`);
```

```javascript
// LINE ~2878: POST /api/whatsapp/logout
// BEFORE:
const response = await fetch('/api/whatsapp/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});

// AFTER:
const response = await fetch('/api/whatsapp/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
});
```

```javascript
// NEW: All API calls that check WhatsApp status
fetch(`/api/whatsapp/status?userId=${user.id}`)
fetch(`/api/whatsapp/client?userId=${user.id}`)
```

#### 2. Bulk Sender & Campaigns
```javascript
// LINE ~3713: POST /api/bulk/campaigns/:id/start
// BEFORE:
const response = await fetch(`/api/bulk/campaigns/${id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});

// AFTER:
const response = await fetch(`/api/bulk/campaigns/${id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
});
```

```javascript
// For bulk sender status check
fetch(`/api/bulk/whatsapp/status?userId=${user.id}`)
```

#### 3. Stats & Validation
```javascript
// LINE ~3348: POST /api/stats/validation
// BEFORE:
fetch('/api/stats/validation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: validCount })
});

// AFTER:
fetch('/api/stats/validation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        count: validCount,
        userId: user.id 
    })
});
```

#### 4. Messages & Deals
```javascript
// LINE ~4676: GET /api/messages
// BEFORE:
const response = await fetch('/api/messages');

// AFTER:
const response = await fetch(`/api/messages?userId=${user.id}`);
```

```javascript
// LINE ~4776: GET /api/deals
// BEFORE:
const response = await fetch(`/api/deals?status=${currentDealsStatus}&page=${page}&limit=10`);

// AFTER:
const response = await fetch(`/api/deals?status=${currentDealsStatus}&page=${page}&limit=10&userId=${user.id}`);
```

#### 5. Dashboard Stats
```javascript
// For dashboard stats endpoint
fetch(`/api/dashboard/stats?userId=${user.id}`)
```

#### 6. Group Extraction
```javascript
// For getting WhatsApp groups
fetch(`/api/bulk/groups?userId=${user.id}`)

// For extracting group members
fetch(`/api/bulk/groups/${groupId}/members?userId=${user.id}`)
```

#### 7. Send Message
```javascript
// For sending test messages
fetch('/api/whatsapp/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userId: user.id,
        number: phoneNumber,
        message: messageText
    })
})
```

---

## 📝 Implementation Strategy

### Option 1: Helper Function (Recommended)
Create a helper function to automatically append userId to all API calls:

```javascript
// Add this near the top of your script section
const user = JSON.parse(localStorage.getItem('whatsapp_user'));

function apiGet(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return fetch(`${endpoint}${separator}userId=${user.id}`);
}

function apiPost(endpoint, data = {}) {
    return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: user.id })
    });
}

function apiDelete(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return fetch(`${endpoint}${separator}userId=${user.id}`, {
        method: 'DELETE'
    });
}

// Then replace all fetch calls:
// OLD: fetch('/api/stats')
// NEW: apiGet('/api/stats')

// OLD: fetch('/api/whatsapp/logout', { method: 'POST', ... })
// NEW: apiPost('/api/whatsapp/logout')
```

### Option 2: Manual Update (Tedious but Straightforward)
Go through each fetch call and manually add userId parameter.

---

## 🔍 Search & Replace Guide

Use your code editor to find and replace:

### For GET requests:
1. Find: `fetch('/api/stats')`
   Replace: `fetch('/api/stats?userId=' + user.id)`

2. Find: `fetch('/api/messages')`
   Replace: `fetch('/api/messages?userId=' + user.id)`

3. Find: `fetch('/api/deals?`
   Replace: `fetch('/api/deals?userId=' + user.id + '&'`

### For POST requests with empty body:
Find pattern:
```javascript
fetch('/api/whatsapp/logout', {
    method: 'POST',
```

Replace with:
```javascript
fetch('/api/whatsapp/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
```

---

## ⚠️ Endpoints That DON'T Need userId

These endpoints work without userId (they're product/media management, not user-specific):
- `/api/products` (GET, POST, PUT, DELETE)
- `/api/media/upload` (POST)
- `/api/media` (GET, DELETE)
- `/api/business-config` (GET, POST)
- `/api/ai-agent/status` (GET)
- `/api/ai-agent/toggle` (POST)

---

## ✅ Testing Checklist

After making changes, test:

1. [ ] Login works and stores user.id
2. [ ] Dashboard loads stats correctly
3. [ ] WhatsApp QR code appears
4. [ ] Can send messages
5. [ ] Stats update properly
6. [ ] Logout works
7. [ ] Campaign creation and execution works
8. [ ] Group extraction works
9. [ ] No "Unexpected token <" errors in console
10. [ ] No 401/500 errors in network tab

---

## 🚨 Common Errors to Watch For

### Error: "Unexpected token <"
**Cause**: Backend returned HTML error page instead of JSON
**Solution**: Check that userId is being passed correctly

### Error: 401 Unauthorized
**Cause**: Missing userId parameter
**Solution**: Add userId to the request

### Error: 500 Internal Server Error
**Cause**: Backend tried to access undefined variable
**Solution**: Ensure userId is valid and passed correctly

---

## 📋 Priority Order for Fixes

Fix in this order for quickest results:

1. **HIGH PRIORITY** (breaks core functionality):
   - `/api/whatsapp/status`
   - `/api/bulk/whatsapp/status`
   - `/api/stats`
   - `/api/dashboard/stats`

2. **MEDIUM PRIORITY** (breaks features):
   - `/api/whatsapp/logout`
   - `/api/whatsapp/send-message`
   - `/api/bulk/campaigns/:id/start`
   - `/api/messages`
   - `/api/deals`

3. **LOW PRIORITY** (edge cases):
   - `/api/stats/validation`
   - `/api/bulk/groups`
   - `/api/bulk/groups/:id/members`

---

## End of Guide
