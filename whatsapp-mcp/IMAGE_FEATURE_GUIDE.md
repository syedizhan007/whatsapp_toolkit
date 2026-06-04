# WhatsApp Auto-Reply - Image/Media Sending Feature

## 📸 How It Works

The bot automatically detects when customers request product images and sends them.

## 🗂️ Setup

### 1. Products Folder
```
whatsapp-mcp/
  └── products/
      ├── bedsheet.jpg
      ├── pillow.png
      ├── curtain.jpg
      └── towel.webp
```

### 2. Supported Formats
- `.jpg` / `.jpeg`
- `.png`
- `.gif`
- `.webp`

## 🔍 Detection Keywords

### Image Request Keywords (English)
- pic, photo, image, picture, show, send

### Image Request Keywords (Urdu/Roman)
- tasveer, tasvir, dikhao, dikha, dekho, bhejo

## 💬 Example Conversations

### Example 1: Simple Request
```
Customer: bedsheet ki pic do
Bot: 📤 [Sends products/bedsheet.jpg]
      "Here's the bedsheet 😊"
```

### Example 2: English Request
```
Customer: show me pillow photo
Bot: 📤 [Sends products/pillow.png]
      "Here's the pillow 😊"
```

### Example 3: Urdu Request
```
Customer: curtain ki tasveer bhejo
Bot: 📤 [Sends products/curtain.jpg]
      "Here's the curtain 😊"
```

### Example 4: No Image Found
```
Customer: sofa ki pic do
Bot: 💬 "Sorry, I don't have a picture of that right now.
      Let me check and get back to you."
```

## 📋 Naming Convention

### File names should match product names:
- `bedsheet.jpg` → matches "bedsheet"
- `bed-sheet.jpg` → matches "bed sheet" or "bedsheet"
- `blue_pillow.png` → matches "blue pillow" or "pillow"

### Tips:
- Use lowercase filenames
- Use hyphens or underscores for multi-word products
- Keep names simple and descriptive

## 🎯 How Detection Works

1. **Keyword Detection**: Checks if message contains image keywords
2. **Product Extraction**: Extracts product name from message
3. **File Search**: Searches products folder for matching image
4. **Auto Send**: Sends image with caption if found
5. **AI Fallback**: If no image, AI responds with text

## 📊 Console Output

### When Image Found:
```
📨 Message from Ali: bedsheet ki pic do
🖼️  Image request detected for: bedsheet
✅ Found image: ./products/bedsheet.jpg
📤 Image sent: bedsheet
```

### When Image Not Found:
```
📨 Message from Sara: sofa ki pic do
🖼️  Image request detected for: sofa
❌ No image found for: sofa
✅ Replied: Sorry, I don't have that image...
```

## 🚀 Quick Start

### Step 1: Add Product Images
```bash
# Copy your product images to products folder
cp /path/to/bedsheet.jpg products/
cp /path/to/pillow.png products/
```

### Step 2: Run Bot
```bash
npm run auto-reply
```

### Step 3: Test
Send message: "bedsheet ki pic do"

## 🔧 Customization

### Add More Keywords
Edit `config.js`:
```javascript
IMAGE_KEYWORDS: [
  'pic', 'photo', 'image',
  'your-custom-keyword'
]
```

### Change Products Folder
Edit `config.js`:
```javascript
PRODUCTS_FOLDER: './my-products'
```

### Add More Image Formats
Edit `config.js`:
```javascript
IMAGE_EXTENSIONS: ['.jpg', '.png', '.svg']
```

## 💡 Pro Tips

1. **Organize by Category**: Create subfolders if needed
2. **Optimize Images**: Keep file sizes reasonable (< 5MB)
3. **Multiple Angles**: Use descriptive names like `bedsheet-front.jpg`
4. **Test First**: Send yourself test messages before going live
5. **Backup Images**: Keep original high-res versions elsewhere

## 🐛 Troubleshooting

### Image Not Sending?
- Check filename matches product name
- Verify file extension is supported
- Check file exists in products folder
- Look for console error messages

### Wrong Image Sent?
- Make filenames more specific
- Avoid similar product names
- Use exact product names in filenames

### Products Folder Not Found?
```bash
mkdir products
```

## 📝 Notes

- Bot sends image immediately (no AI reply after image)
- If no image found, AI generates text response
- Works with all image request keywords
- Case-insensitive matching
- Supports partial name matching

---

**Ready to use!** Just add your product images to the `products/` folder.
