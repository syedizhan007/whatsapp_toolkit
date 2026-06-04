# WhatsApp Bulk Sender - Quick Start Guide

## Step 1: Installation
```bash
cd bulk-sender
npm install
```

## Step 2: Prepare Your Contacts
Create a CSV file named `contacts.csv`:

```csv
name,phone,tag,city,custom_image,custom_doc
John Doe,+1234567890,customer,New York,,
Jane Smith,+919876543210,lead,Mumbai,,
```

## Step 3: Start the Application
```bash
npm start
```

## Step 4: First Time Setup
- Scan the QR code with WhatsApp
- Session will be saved automatically

## Step 5: Create Your First Campaign

1. Select: **📤 Create New Campaign**
2. Enter campaign name: `My First Campaign`
3. Enter CSV file path: `contacts.csv`
4. Write your message:
```
Hello {name}!

We have a special offer for you in {city}.

Valid until {date}.

Reply STOP to unsubscribe.
```

## Step 6: Start Sending
1. Select: **▶️ Start Campaign**
2. Choose your campaign
3. Watch the live progress!

## Common Tasks

### Schedule a Campaign
1. Select: **⏰ Schedule Campaign**
2. Choose campaign
3. Enter cron: `0 9 * * *` (9 AM daily)

### Extract Group Members
1. Select: **👥 Extract Group Members**
2. Choose group
3. CSV file will be created in `results/` folder

### View Campaign Status
1. Select: **📋 View All Campaigns**
2. See all campaigns with statistics

### Export Results
1. Select: **📊 Export Results**
2. Choose campaign
3. CSV file will be created in `results/` folder

## Tips

✅ Always include country code in phone numbers
✅ Test with 2-3 contacts first
✅ Use message variables for personalization
✅ Respect DND hours (11 PM - 8 AM)
✅ Keep batch size at 50 messages
✅ Monitor the blacklist regularly

## Troubleshooting

**Problem**: QR code not showing
**Solution**: Delete `.wwebjs_auth/` folder and restart

**Problem**: Messages failing
**Solution**: Check phone number format and internet connection

**Problem**: Campaign stuck
**Solution**: Use "Pause Campaign" and check logs

## Need Help?

Check the full README.md for detailed documentation.
