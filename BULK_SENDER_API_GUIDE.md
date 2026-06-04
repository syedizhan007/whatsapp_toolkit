# Bulk Sender API Guide

## Overview
Bulk Sender ab backend se fully integrated hai. Aap ab API ke through bulk WhatsApp campaigns run kar sakte ho with images, documents, aur files.

## Base URL
```
http://localhost:4000/api/bulk
```

## Features
✅ Bulk message sending with personalization
✅ Image attachments (JPEG, PNG, GIF)
✅ Document attachments (PDF, DOC, DOCX, XLS, XLSX)
✅ File attachments (ZIP, RAR, TXT, CSV)
✅ Multiple media files per contact
✅ CSV contact import
✅ Campaign management (start, pause, resume, delete)
✅ WhatsApp group member extraction
✅ Blacklist management
✅ Campaign results export

## API Endpoints

### 1. Get All Campaigns
```
GET /api/bulk/campaigns
```

**Response:**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": 1,
      "name": "Campaign Name",
      "status": "pending",
      "total_contacts": 100,
      "sent_count": 0,
      "failed_count": 0,
      "pending_count": 100
    }
  ]
}
```

### 2. Create Campaign with Media
```
POST /api/bulk/campaigns
Content-Type: multipart/form-data
```

**Form Data:**
- `name`: Campaign name (required)
- `message`: Message template (required)
- `contacts`: JSON array of contacts (required)
- `media`: Files (images/documents) - up to 10 files

**Example Contacts JSON:**
```json
[
  {
    "name": "John Doe",
    "phone": "919876543210",
    "city": "Mumbai"
  },
  {
    "name": "Jane Smith",
    "phone": "919876543211",
    "city": "Delhi"
  }
]
```

**Message Template Variables:**
- `{name}` - Contact name
- `{phone}` - Contact phone
- `{city}` - Contact city
- `{date}` - Current date
- `{time}` - Current time

**Example using curl:**
```bash
curl -X POST http://localhost:4000/api/bulk/campaigns \
  -F "name=Summer Sale Campaign" \
  -F "message=Hi {name}, Check out our summer sale in {city}!" \
  -F 'contacts=[{"name":"John","phone":"919876543210","city":"Mumbai"}]' \
  -F "media=@/path/to/image.jpg" \
  -F "media=@/path/to/brochure.pdf"
```

**Response:**
```json
{
  "success": true,
  "campaignId": 1,
  "message": "Campaign created with 1 contacts"
}
```

### 3. Start Campaign
```
POST /api/bulk/campaigns/:id/start
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign started"
}
```

### 4. Pause Campaign
```
POST /api/bulk/campaigns/pause
```

### 5. Resume Campaign
```
POST /api/bulk/campaigns/:id/resume
```

### 6. Delete Campaign
```
DELETE /api/bulk/campaigns/:id
```

### 7. Import Contacts from CSV
```
POST /api/bulk/contacts/import
Content-Type: multipart/form-data
```

**Form Data:**
- `csv`: CSV file with columns: name, phone, city (and any custom fields)

**CSV Format:**
```csv
name,phone,city
John Doe,919876543210,Mumbai
Jane Smith,919876543211,Delhi
```

**Response:**
```json
{
  "success": true,
  "contacts": [...],
  "count": 2
}
```

### 8. Export Campaign Results
```
GET /api/bulk/campaigns/:id/export
```

Downloads CSV file with campaign results.

### 9. Get WhatsApp Groups
```
GET /api/bulk/groups
```

**Response:**
```json
{
  "success": true,
  "groups": [
    {
      "id": "123456789@g.us",
      "name": "My Group",
      "participantsCount": 50
    }
  ]
}
```

### 10. Extract Group Members
```
GET /api/bulk/groups/:id/members
```

**Response:**
```json
{
  "success": true,
  "members": [
    {
      "phone": "919876543210",
      "isAdmin": false,
      "isSuperAdmin": false
    }
  ]
}
```

### 11. Blacklist Management

**Get Blacklist:**
```
GET /api/bulk/blacklist
```

**Add to Blacklist:**
```
POST /api/bulk/blacklist
Content-Type: application/json

{
  "phone": "919876543210",
  "reason": "User requested"
}
```

**Remove from Blacklist:**
```
DELETE /api/bulk/blacklist/:phone
```

## Usage Example (JavaScript/Fetch)

```javascript
// Create campaign with image
const formData = new FormData();
formData.append('name', 'Product Launch');
formData.append('message', 'Hi {name}! Check out our new product!');
formData.append('contacts', JSON.stringify([
  { name: 'John', phone: '919876543210', city: 'Mumbai' }
]));

// Add image file
const imageFile = document.getElementById('imageInput').files[0];
formData.append('media', imageFile);

// Add PDF file
const pdfFile = document.getElementById('pdfInput').files[0];
formData.append('media', pdfFile);

const response = await fetch('http://localhost:4000/api/bulk/campaigns', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Campaign created:', result.campaignId);

// Start campaign
await fetch(`http://localhost:4000/api/bulk/campaigns/${result.campaignId}/start`, {
  method: 'POST'
});
```

## Media File Limits
- Maximum file size: 50MB per file
- Maximum files per campaign: 10 files
- Supported formats:
  - Images: JPEG, JPG, PNG, GIF
  - Documents: PDF, DOC, DOCX, XLS, XLSX
  - Files: TXT, CSV, ZIP, RAR

## Campaign Flow
1. Create campaign with contacts and media
2. Start campaign
3. Monitor progress via GET /api/bulk/campaigns/:id
4. Pause/Resume if needed
5. Export results when complete

## Notes
- Messages are sent with random delays (5-15 seconds) to avoid spam detection
- Batch breaks occur after every 20 messages (5 minute break)
- DND hours (10 PM - 9 AM) are automatically respected
- Blacklisted numbers are automatically skipped
- Failed messages are automatically retried (max 3 attempts)

## Server Status
- Main Dashboard: http://localhost:3000
- Backend API: http://localhost:4000
- Status Server: http://localhost:3001
