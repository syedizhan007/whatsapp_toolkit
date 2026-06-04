# Dynamic Products & Prices Setup Guide

## Overview
Your WhatsApp Toolkit now has a fully dynamic inventory system that syncs products and prices in real-time between the dashboard and the AI Agent.

## ✅ What's Been Implemented

### 1. **Supabase Products Table**
- Schema file created: `supabase_products_schema.sql`
- Fields: `id`, `item_name`, `price_pkr`, `created_at`, `updated_at`
- Automatic timestamp updates on edits
- Row Level Security enabled

### 2. **Dynamic Dashboard UI**
- Clean table interface with Item Name and Price (PKR) columns
- Add, Edit, and Delete buttons for each product
- Real-time updates every 10 seconds
- Input validation (price must be > 0)
- Removed all placeholder products (Premium, Basic, Enterprise)

### 3. **REST API Endpoints**
- `GET /api/products` - List all products
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update existing product
- `DELETE /api/products/:id` - Delete product

### 4. **AI Agent Integration**
- Fetches products from Supabase on every message
- Includes current prices in AI system prompt
- Real-time price updates (no restart needed)
- Formatted price list sent to AI for accurate responses

---

## 🚀 Setup Instructions

### Step 1: Create the Products Table in Supabase

1. **Login to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `xrphyjkrzolqyowkkvzf`

2. **Run the SQL Schema**
   - Click on **SQL Editor** in the left sidebar
   - Click **New Query**
   - Copy the contents of `supabase_products_schema.sql`
   - Paste into the SQL editor
   - Click **Run** or press `Ctrl+Enter`

3. **Verify Table Creation**
   - Go to **Table Editor** in the left sidebar
   - You should see a new table called `products`
   - It should have 3 sample products (Basic, Premium, Enterprise)

### Step 2: Test the Dashboard

1. **Start the Server**
   ```bash
   node server.js
   ```

2. **Open Dashboard**
   - Navigate to: http://localhost:3000/dashboard.html
   - Go to the **AI Agent** section
   - Scroll down to **Products & Prices Manager**

3. **Test CRUD Operations**
   - **Add**: Enter "Test Product" and price "1000", click Add
   - **Edit**: Click the edit button on any product
   - **Delete**: Click the trash button to remove a product

### Step 3: Test AI Agent Integration

1. **Enable AI Agent**
   - In the dashboard, toggle the AI Agent to **ON**
   - Make sure WhatsApp is connected (scan QR if needed)

2. **Send Test Message**
   - From another WhatsApp account, send a message like:
     - "What are your prices?"
     - "How much does the Premium Package cost?"
     - "Tell me about your products"

3. **Verify AI Response**
   - The AI should respond with current prices from the database
   - Prices should match what's shown in the dashboard

4. **Test Real-Time Updates**
   - Update a product price in the dashboard
   - Send another message asking about that product
   - The AI should use the NEW price immediately (no restart needed)

---

## 📋 Usage Guide

### Adding Products

1. Enter the **Item Name** (e.g., "Website Development")
2. Enter the **Price in PKR** (e.g., "25000")
3. Click the **Add** button
4. Product appears in the table immediately
5. AI Agent can now reference this product

### Editing Products

1. Click the **Edit** button (pencil icon) on any product
2. Enter the new item name in the prompt
3. Enter the new price in the next prompt
4. Changes are saved immediately
5. AI Agent uses the updated price in the next message

### Deleting Products

1. Click the **Delete** button (trash icon) on any product
2. Confirm the deletion
3. Product is removed from database
4. AI Agent will no longer mention this product

---

## 🔄 How Real-Time Sync Works

### Dashboard → Database
- When you add/edit/delete a product in the dashboard
- JavaScript makes an API call to server.js
- Server.js updates the Supabase database
- Dashboard refreshes automatically every 10 seconds

### Database → AI Agent
- When a WhatsApp message arrives
- AI Agent fetches the latest products from Supabase
- Products are formatted and added to the system prompt
- AI uses current prices in its response
- **No server restart needed!**

---

## 🎯 Best Practices

### Product Naming
- Use clear, descriptive names
- Example: "Basic Website Package" instead of "Package 1"
- Avoid special characters that might confuse the AI

### Pricing
- Always use numeric values (no commas or currency symbols)
- Example: Enter `15000` not `15,000` or `PKR 15,000`
- The system automatically formats prices for display

### AI Prompt Configuration
- Go to **Settings** → **AI Agent Configuration**
- Update your business prompt to mention:
  - "Always provide accurate pricing from the product list"
  - "If asked about products, list all available options"
  - "Use PKR currency format when discussing prices"

---

## 🐛 Troubleshooting

### Products Not Loading
- **Check Console**: Open browser DevTools (F12) and check for errors
- **Verify Supabase**: Make sure the products table exists
- **Check API**: Visit http://localhost:3000/api/products in browser
- **Expected Response**: `{"success":true,"products":[...]}`

### AI Not Using Current Prices
- **Check AI Agent Status**: Make sure it's enabled (toggle ON)
- **Check Logs**: Look at server.js console for "Loaded X products into AI context"
- **Test Database**: Verify products exist in Supabase Table Editor
- **Check Supabase Keys**: Ensure SUPABASE_URL and SUPABASE_KEY are correct in server.js

### Edit/Delete Not Working
- **Check Product ID**: Make sure the product exists in the database
- **Check Permissions**: Verify RLS policies in Supabase allow updates/deletes
- **Check Console**: Look for error messages in browser DevTools

### Price Formatting Issues
- **Use Numbers Only**: Don't include commas, currency symbols, or text
- **Decimal Places**: System supports up to 2 decimal places (e.g., 1500.50)
- **Minimum Value**: Price must be greater than 0

---

## 📊 Database Schema Reference

```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    price_pkr NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Field Descriptions
- **id**: Auto-incrementing unique identifier
- **item_name**: Product or service name (text)
- **price_pkr**: Price in Pakistani Rupees (numeric with 2 decimals)
- **created_at**: Timestamp when product was added
- **updated_at**: Timestamp when product was last modified (auto-updates)

---

## 🎉 Features Summary

✅ **No More Hardcoded Prices** - All prices come from database  
✅ **Real-Time Updates** - Changes reflect immediately in AI responses  
✅ **Easy Management** - Add/edit/delete products from dashboard  
✅ **Automatic Sync** - Dashboard refreshes every 10 seconds  
✅ **Error Handling** - Graceful fallbacks if database is unavailable  
✅ **Input Validation** - Prevents invalid data entry  
✅ **Formatted Display** - Prices shown with proper PKR formatting  
✅ **AI Integration** - Products automatically included in AI context  

---

## 📞 Support

If you encounter any issues:
1. Check the server.js console logs
2. Check browser DevTools console (F12)
3. Verify Supabase table exists and has data
4. Ensure all API endpoints return success responses

---

**Last Updated**: May 2026  
**Version**: 1.0.0
