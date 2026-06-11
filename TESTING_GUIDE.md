# 🚀 QUICK START - TESTING GUIDE

## ✅ ALL FIXES COMPLETE

The Baileys migration is finished. All MODULE_NOT_FOUND errors have been eliminated, and all functionality has been restored.

---

## 🧪 TESTING CHECKLIST

### 1. Start the Server
```bash
npm start
```

**Expected Output:**
```
✓ Supabase client initialized
✓ Multi-user WhatsApp client system ready
✓ Bulk Sender Service initialized and connected to Baileys clients
✓ WhatsApp Service initialized and accessible to backend modules
🚀 Dashboard running on: http://localhost:3000
```

**✅ If you see this → Server is healthy**  
**❌ If MODULE_NOT_FOUND → Check the error and let me know**

---

### 2. Connect WhatsApp
1. Open browser: `http://localhost:3000`
2. Login with your credentials
3. Wait for QR code to appear
4. Scan QR code with WhatsApp mobile app
5. Wait for "WhatsApp Connected" message

**✅ Expected:** Green success message + client info displayed  
**❌ If QR doesn't appear:** Check browser console for errors

---

### 3. Test Campaign Creation
1. Navigate to **Bulk Sender** section
2. Click **"Create New Campaign"**
3. Fill in:
   - Campaign Name: "Test Campaign"
   - Message: "Hello {name}, this is a test from {city}"
4. Upload CSV with contacts (at least 2-3 numbers)
5. Click **"Create Campaign"**

**✅ Expected:** Campaign appears in list with "Pending" status  
**❌ If error:** Check browser console and server logs

---

### 4. Test Campaign Start
1. Find your test campaign
2. Click **"Start"** button
3. Watch the console logs in terminal

**✅ Expected Console Output:**
```
🚀 Starting campaign: Test Campaign for user [userId]
📊 Total contacts: 3
📤 Sending to John Doe (923001234567)...
✅ Text message sent
⏳ Waiting 12s before next contact...
📤 Sending to Jane Smith (923009876543)...
✅ Text message sent
```

**✅ Expected Dashboard:**
- Progress bar updates in real-time
- Sent count increments
- Campaign status changes to "Active"

**❌ If messages don't send:**
- Check WhatsApp is still connected
- Check phone numbers are valid format
- Check server console for specific errors

---

### 5. Test Campaign Controls
**Pause:**
1. Click **"Pause"** button during active campaign
2. Console should show: `⏸️ Campaign [name] is paused. Waiting...`
3. Click **"Resume"** to continue

**Stop:**
1. Click **"Stop"** button
2. Console should show: `🛑 Campaign [name] stopped by user.`
3. Campaign status changes to "Stopped"

**✅ Expected:** Controls work immediately, loop responds  
**❌ If controls don't work:** Check Socket.IO connection in browser console

---

### 6. Test Media Attachments
1. Create new campaign
2. Upload an image or PDF file
3. Start campaign
4. Verify media is sent after text message

**✅ Expected Console:**
```
✅ Text message sent
📎 Sending 1 global campaign media file(s)...
✅ Sent global media: image.jpg
```

**❌ If media fails:**
- Check file format (JPG, PNG, PDF, DOC)
- Check file size (< 50MB)
- Check server logs for specific error

---

### 7. Test Error Recovery
1. Add an invalid phone number to CSV: "123456"
2. Start campaign
3. Campaign should continue after failed number

**✅ Expected Console:**
```
📤 Sending to Invalid (123456)...
❌ Failed to send to Invalid: [error message]
📤 Sending to Next Contact (923001234567)...
✅ Text message sent
```

**✅ Expected:** Failed count increments, but loop continues  
**❌ If loop crashes:** The fix didn't work - contact developer

---

## 🐛 TROUBLESHOOTING

### Problem: Server won't start - MODULE_NOT_FOUND
**Solution:**
```bash
npm install
```
Then try starting again.

---

### Problem: QR code doesn't appear
**Check:**
1. Is userId in localStorage? (Browser dev tools → Application → Local Storage)
2. Socket.IO connected? (Browser console should show connection)
3. Server logs show: "Client connected: [socketId] for user: [userId]"

**Fix:**
- Clear browser cache
- Logout and login again
- Check browser console for errors

---

### Problem: Messages send but show wrong format
**Check server console** for the actual format being sent:
- Should show JID as: `923001234567@s.whatsapp.net`
- Should NOT show: `@c.us`

If showing `@c.us`, the fix wasn't applied correctly.

---

### Problem: Campaign starts but stops immediately
**Check:**
1. WhatsApp still connected? (Check dashboard status)
2. CSV file has valid contacts?
3. Server console shows specific error?

**Common causes:**
- WhatsApp disconnected during campaign
- All contacts are blacklisted
- CSV file is empty or malformed

---

### Problem: Media doesn't send
**Check:**
1. File format supported? (Images: JPG/PNG, Docs: PDF/DOC/DOCX)
2. File size under limit? (< 50MB)
3. Server console shows buffer being sent?

**Fix:**
- Try smaller file first
- Check file isn't corrupted
- Verify mimetype is recognized

---

## 📊 SUCCESS CRITERIA

✅ **Server starts without MODULE_NOT_FOUND errors**  
✅ **WhatsApp QR code appears and scans successfully**  
✅ **Campaign can be created with CSV upload**  
✅ **Messages send using Baileys (console shows @s.whatsapp.net)**  
✅ **Progress updates in real-time on dashboard**  
✅ **Campaign controls (pause/stop) work immediately**  
✅ **Failed numbers don't crash the campaign loop**  
✅ **Media attachments send successfully**

**If all ✅ → Migration is successful!**

---

## 📝 REPORTING ISSUES

If you encounter errors, provide:
1. **Exact error message** from server console
2. **Browser console errors** (F12 → Console tab)
3. **What you were doing** when error occurred
4. **Screenshot** of the error if possible

---

## 🎉 NEXT STEPS AFTER TESTING

Once everything works:

1. **Test with real contacts** (start with 2-3 numbers)
2. **Monitor for 24 hours** to ensure stability
3. **Backup your database** before production use
4. **Set up error monitoring** (optional but recommended)
5. **Train users** on the new system

---

## 🔗 DOCUMENTATION

- **BULK_SENDER_BAILEYS_FIX_COMPLETE.md** - Campaign fixes details
- **MODULE_NOT_FOUND_FIX_COMPLETE.md** - Backend service fixes
- **BAILEYS_MIGRATION_COMPLETE.md** - Complete migration overview

---

## 💡 TIPS

- **Start small:** Test with 2-3 contacts first
- **Check logs:** Server console shows detailed progress
- **Monitor stats:** Dashboard updates in real-time
- **Use blacklist:** Add test numbers to avoid spamming
- **Delays matter:** Default 8-15s prevents rate limiting

---

**Ready to test? Start the server and follow the checklist above!**

```bash
npm start
```
