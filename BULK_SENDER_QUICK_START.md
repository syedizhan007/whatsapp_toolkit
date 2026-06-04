# 🚀 Bulk Sender - Quick Start Guide

## ✅ Kya Complete Ho Gaya

Bulk Sender ab **fully functional** hai! Aap ab bulk WhatsApp messages send kar sakte ho with:
- 📸 Images (JPG, PNG, GIF)
- 📄 Documents (PDF, DOC, DOCX, XLS, XLSX)
- 📁 Files (ZIP, RAR, TXT, CSV)
- 🎯 Multiple media files ek contact ko

## 🎯 Kaise Use Karein (Step by Step)

### Method 1: Test Page Se (Sabse Easy)

1. **Browser mein test page kholo:**
   ```
   http://localhost:3000/bulk-sender-test.html
   ```

2. **Campaign details bharo:**
   - Campaign Name: "Summer Sale 2024"
   - Message: "Hi {name}, check out our offers in {city}!"
   - Contacts JSON:
   ```json
   [
     {"name":"John Doe","phone":"919876543210","city":"Mumbai"},
     {"name":"Jane Smith","phone":"919876543211","city":"Delhi"}
   ]
   ```

3. **Media files upload karo** (optional):
   - Click "📁 Click to select files"
   - Select images, PDFs, ya documents
   - Up to 10 files, 50MB each

4. **"Create Campaign" button click karo**
   - Campaign create ho jayega
   - Campaign ID milega

5. **"Start" button click karo**
   - Messages send hone lagenge
   - WhatsApp QR code scan karna padega (pehli baar)

### Method 2: API Se (For Developers)

```javascript
// Create campaign with media
const formData = new FormData();
formData.append('name', 'Product Launch');
formData.append('message', 'Hi {name}! New product available in {city}!');
formData.append('contacts', JSON.stringify([
  {name: 'John', phone: '919876543210', city: 'Mumbai'}
]));

// Add image
const imageFile = document.getElementById('imageInput').files[0];
formData.append('media', imageFile);

// Add PDF
const pdfFile = document.getElementById('pdfInput').files[0];
formData.append('media', pdfFile);

// Create campaign
const response = await fetch('http://localhost:4000/api/bulk/campaigns', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Campaign ID:', result.campaignId);

// Start campaign
await fetch(`http://localhost:4000/api/bulk/campaigns/${result.campaignId}/start`, {
  method: 'POST'
});
```

## 📊 Current Status

**Database:** 13 campaigns already exist
**Latest Campaign:** "Working Campaign" (ID: 15)
- Status: Draft
- Contacts: 1
- Ready to send

## 🎮 Available Actions

### View All Campaigns
```bash
curl http://localhost:4000/api/bulk/campaigns
```

### Create New Campaign
```bash
curl -X POST http://localhost:4000/api/bulk/campaigns \
  -F "name=My Campaign" \
  -F "message=Hello {name}!" \
  -F 'contacts=[{"name":"Test","phone":"919876543210"}]' \
  -F "media=@image.jpg"
```

### Start Campaign
```bash
curl -X POST http://localhost:4000/api/bulk/campaigns/15/start
```

### Pause Campaign
```bash
curl -X POST http://localhost:4000/api/bulk/campaigns/pause
```

### Delete Campaign
```bash
curl -X DELETE http://localhost:4000/api/bulk/campaigns/15
```

## ⚡ Smart Features

1. **Random Delays:** 8-20 seconds between messages (spam detection avoid)
2. **Batch Breaks:** Har 50 messages ke baad 10 minute break
3. **DND Hours:** Raat 11 PM se subah 8 AM tak nahi bhejega
4. **Auto Blacklist:** "stop", "unsubscribe" reply pe auto blacklist
5. **Auto Retry:** Failed messages 3 baar retry honge

## 🔥 Message Personalization

Aap message mein ye variables use kar sakte ho:
- `{name}` - Contact ka naam
- `{phone}` - Contact ka phone
- `{city}` - Contact ki city
- `{date}` - Current date
- `{time}` - Current time

**Example:**
```
Hi {name}! 

We have a special offer for you in {city}. 
Check it out today ({date} at {time}).

Thanks!
```

## 🎯 Next Steps

1. **Test Page kholo:** http://localhost:3000/bulk-sender-test.html
2. **Ek test campaign banao** with 1-2 contacts
3. **Media upload karo** (optional)
4. **Start button click karo**
5. **WhatsApp QR scan karo** (pehli baar)
6. **Messages send hone lagenge!**

## ⚠️ Important Notes

- **Pehli baar:** WhatsApp QR code scan karna padega (30-60 seconds)
- **Rate Limits:** WhatsApp ke spam detection se bachne ke liye delays hain
- **Testing:** Pehle 1-2 contacts se test karo
- **Production:** Bade campaigns ke liye proper testing karo

## 🆘 Troubleshooting

**Campaign create nahi ho raha?**
- Check contacts JSON format
- Make sure phone numbers valid hain

**Messages send nahi ho rahe?**
- WhatsApp QR scan kiya hai?
- Backend logs check karo: `tail -f backend/server.log`

**Timeout error aa raha hai?**
- Backend restart karo: `PORT=4000 node backend/server.js`

## 📚 Complete Documentation

- **API Guide:** `BULK_SENDER_API_GUIDE.md`
- **Complete Summary:** `BULK_SENDER_COMPLETE.md`

---

**Status:** ✅ FULLY WORKING
**Version:** 1.0.0
**Last Updated:** May 8, 2026
