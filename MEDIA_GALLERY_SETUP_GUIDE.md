# Media Gallery Setup Guide

## Overview
Your WhatsApp Toolkit now has a complete Media Gallery system that allows you to upload product photos and have the AI Agent automatically send them when customers ask for pics.

## ✅ What's Been Implemented

### 1. **Supabase Storage & Database**
- `product_media` table for storing image metadata
- Supabase Storage bucket for hosting images
- Automatic file management and cleanup

### 2. **Dashboard Media Manager**
- Upload product photos with tags
- Image preview before upload
- Filter by product category
- Delete images
- Real-time gallery updates

### 3. **API Endpoints**
- `POST /api/media/upload` - Upload images to Supabase Storage
- `GET /api/media` - List all images (with optional tag filter)
- `DELETE /api/media/:id` - Delete image and metadata

### 4. **Smart AI Image Sending**
- Detects photo requests: "pic", "pix", "photo", "dikhao"
- Filters by product if mentioned: "Bedsheet pics dikhao"
- Sends one image per category if no filter
- Limits to 5 images max to avoid spam
- Uses WhatsApp MessageMedia.fromUrl()

---

## 🚀 Setup Instructions

### Step 1: Create Supabase Storage Bucket

1. **Login to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `xrphyjkrzolqyowkkvzf`

2. **Create Storage Bucket**
   - Click **Storage** in the left sidebar
   - Click **New Bucket**
   - Bucket name: `product-images`
   - **IMPORTANT**: Set to **Public** (so images can be accessed via URL)
   - Click **Create Bucket**

3. **Configure Bucket Settings**
   - Click on the `product-images` bucket
   - Go to **Policies** tab
   - The bucket should allow public access for:
     - INSERT (uploads)
     - SELECT (reads)
     - DELETE (removals)

### Step 2: Create Database Table

1. **Run SQL Schema**
   - Go to **SQL Editor** in Supabase Dashboard
   - Click **New Query**
   - Copy contents of `supabase_product_media_schema.sql`
   - Paste and click **Run**

2. **Verify Table Creation**
   - Go to **Table Editor**
   - You should see `product_media` table with columns:
     - id, product_tag, image_url, file_name, file_size, mime_type, created_at

### Step 3: Restart Server

The server.js changes require a restart:

```bash
# Stop current server (Ctrl+C)
node server.js
```

### Step 4: Test the Media Gallery

1. **Open Dashboard**
   - Navigate to: http://localhost:3000/dashboard.html
   - Go to **AI Agent** section
   - Scroll to **Product Media Gallery**

2. **Upload Test Image**
   - Click **Select Image** and choose a product photo
   - Enter a tag (e.g., "Bedsheet", "Shirt")
   - Click **Upload**
   - Image should appear in the gallery below

3. **Test Filtering**
   - Upload images with different tags
   - Click tag filter buttons to filter by category
   - Click **All** to show everything

---

## 📱 Testing WhatsApp Image Sending

### Test 1: General Photo Request
```
Customer: "Pics dikhao"
Expected: AI sends one image per category (max 5)
          Then says: "Ji bhai pics bhej di hain. Quality dekh lo!"
```

### Test 2: Specific Product Request
```
Customer: "Bedsheet ki pic dikhao"
Expected: AI sends all Bedsheet images (max 5)
          Then says: "Ji bhai Bedsheet ki pics bhej di hain. Quality dekh lo!"
```

### Test 3: No Images Available
```
Customer: "Sofa ki pic dikhao"
(If no sofa images in database)
Expected: AI responds with: "Bhai abhi system update ho raha hai isliye photos show nahi ho rahin, lekin quality ki meri zimmedari hai"
```

### Test 4: Photo Keywords
All these should trigger image sending:
- "pic dikhao"
- "pix bhejo"
- "photo send karo"
- "image dikhao"
- "dekh lo"

---

## 🎯 How It Works

### Upload Flow
1. User selects image and enters tag in dashboard
2. Image uploaded to Supabase Storage bucket
3. Public URL generated
4. Metadata saved to `product_media` table
5. Gallery refreshes automatically

### Image Sending Flow
1. Customer sends message with photo keywords
2. AI Agent detects photo request
3. System checks if specific product mentioned
4. Queries `product_media` table
5. Downloads images using MessageMedia.fromUrl()
6. Sends images via WhatsApp with captions
7. Sends confirmation message

### Smart Filtering
- **"Bedsheet pics"** → Sends only Bedsheet images
- **"Pics dikhao"** → Sends one image per category
- **Max 5 images** → Prevents spam
- **1 second delay** → Between each image

---

## 📋 Best Practices

### Image Guidelines
- **Format**: JPG, PNG, or WebP
- **Size**: Under 5MB per image
- **Resolution**: 800x800px to 1200x1200px recommended
- **Quality**: High quality but compressed

### Tagging Strategy
- Use consistent tags: "Bedsheet" not "bed sheet" or "BedSheet"
- Match product names in your inventory
- Use singular form: "Shirt" not "Shirts"
- Keep tags simple and searchable

### Organization
- Upload multiple angles of same product with same tag
- Delete old/outdated images regularly
- Use descriptive file names before uploading

---

## 🐛 Troubleshooting

### Images Not Uploading
**Problem**: Upload fails or shows error

**Solutions**:
1. Check Supabase Storage bucket exists and is public
2. Verify bucket name is exactly `product-images`
3. Check file size is under 5MB
4. Ensure file format is JPG, PNG, or WebP
5. Check browser console for errors (F12)

### Images Not Sending in WhatsApp
**Problem**: AI doesn't send images when asked

**Solutions**:
1. Check images exist in database (Table Editor)
2. Verify image URLs are accessible (open in browser)
3. Check server.js console for errors
4. Ensure AI Agent is enabled
5. Test with exact keywords: "pic dikhao"

### Upload Progress Stuck
**Problem**: Progress bar doesn't complete

**Solutions**:
1. Check internet connection
2. Verify Supabase credentials in server.js
3. Check Supabase Storage policies allow INSERT
4. Try smaller image file
5. Refresh page and try again

### Images Not Displaying in Gallery
**Problem**: Gallery shows "Loading..." forever

**Solutions**:
1. Check `/api/media` endpoint: http://localhost:3000/api/media
2. Verify `product_media` table exists in Supabase
3. Check browser console for API errors
4. Ensure server is running
5. Try clicking Refresh button

---

## 🔧 Advanced Configuration

### Change Upload Limits

Edit `server.js` to change file size limit:

```javascript
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // Change to 10MB
    },
    // ...
});
```

### Add More File Types

Edit `server.js` to allow more formats:

```javascript
fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    // Added GIF support
    // ...
}
```

### Change Image Limit

Edit `server.js` to send more/fewer images:

```javascript
// Limit to 5 images max to avoid spam
imagesToSend = imagesToSend.slice(0, 10); // Change to 10
```

---

## 📊 Database Schema Reference

```sql
CREATE TABLE product_media (
    id BIGSERIAL PRIMARY KEY,
    product_tag TEXT NOT NULL,
    image_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Field Descriptions
- **id**: Auto-incrementing unique identifier
- **product_tag**: Category/product name (e.g., "Bedsheet")
- **image_url**: Public Supabase Storage URL
- **file_name**: Unique filename in storage
- **file_size**: File size in bytes
- **mime_type**: Image format (image/jpeg, image/png, etc.)
- **created_at**: Upload timestamp

---

## 🎉 Features Summary

✅ **Upload Product Photos** - Drag, drop, and tag images  
✅ **Supabase Storage** - Secure cloud hosting  
✅ **Smart Filtering** - Send specific or all categories  
✅ **Auto Detection** - AI detects photo requests  
✅ **WhatsApp Integration** - Real image sending via MessageMedia  
✅ **Tag-Based Search** - Filter by product category  
✅ **Delete Management** - Remove old images easily  
✅ **Real-Time Updates** - Gallery refreshes automatically  
✅ **Spam Prevention** - Max 5 images per request  

---

## 📞 Common Questions

**Q: Can I upload multiple images at once?**  
A: Currently one at a time. Upload multiple with same tag for product variations.

**Q: What happens if I delete an image?**  
A: Both the file (from Storage) and metadata (from database) are deleted.

**Q: Can customers see all my images?**  
A: No, images are only sent when they ask for pics.

**Q: How many images can I store?**  
A: Supabase free tier: 1GB storage. Upgrade for more.

**Q: Can I change image tags after upload?**  
A: Not currently. Delete and re-upload with correct tag.

**Q: Do images expire?**  
A: No, they stay until you delete them.

---

**Last Updated**: May 2026  
**Version**: 1.0.0
