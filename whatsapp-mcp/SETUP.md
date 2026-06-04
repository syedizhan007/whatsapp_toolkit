# WhatsApp MCP Server - Quick Setup Guide

## Step 1: Install Dependencies

```bash
cd whatsapp-mcp
npm install
```

## Step 2: Configure Claude Desktop

### Windows
Edit: `%APPDATA%\Claude\claude_desktop_config.json`

### macOS
Edit: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Linux
Edit: `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["C:\\Users\\kk\\Desktop\\whatsapptool\\whatsapp-mcp\\index.js"]
    }
  }
}
```

**Important**: Update the path to match your actual installation directory!

## Step 3: Restart Claude Desktop

1. Close Claude Desktop completely
2. Reopen Claude Desktop
3. The WhatsApp MCP server will start automatically

## Step 4: First Time Setup

1. When Claude Desktop starts, the MCP server initializes
2. A QR code will appear in the logs
3. Scan the QR code with WhatsApp on your phone
4. Session is saved - no need to scan again!

## Step 5: Start Using

Now you can chat with Claude and use WhatsApp commands:

```
"Send a WhatsApp message to +1234567890 saying 'Hello!'"

"Check if +9876543210 is on WhatsApp"

"Show me my recent WhatsApp chats"

"Get messages from my chat with +1234567890"
```

## Viewing Logs

To see what's happening with the MCP server:

### Windows
```
%APPDATA%\Claude\logs\mcp-server-whatsapp.log
```

### macOS/Linux
```
~/Library/Logs/Claude/mcp-server-whatsapp.log
```

## Testing Without Claude

You can test the server standalone:

```bash
npm start
```

This will start the server and show the QR code for testing.

## Common Issues

**Server not starting:**
- Check the path in config file is correct
- Ensure Node.js is installed: `node --version`
- Check Claude Desktop logs

**QR code not appearing:**
- Look in Claude Desktop logs
- Delete `.wwebjs_auth/` folder and restart

**Messages not sending:**
- Verify phone number format (+1234567890)
- Check if number is on WhatsApp
- Ensure WhatsApp Web isn't open elsewhere

## Example Commands

### Send a message
```
Send a WhatsApp message to +1234567890 saying "Meeting at 3 PM tomorrow"
```

### Send with media
```
Send the file C:\images\photo.jpg to +1234567890 with caption "Check this out!"
```

### Check number
```
Is +9876543210 on WhatsApp?
```

### Get chats
```
Show me my last 10 WhatsApp chats
```

### Get messages
```
Get the last 20 messages from +1234567890
```

### Group operations
```
List all my WhatsApp groups

Get members of group 123456789@g.us

Send "Hello team!" to group 123456789@g.us
```

## Next Steps

Once configured, the MCP server runs automatically whenever Claude Desktop is open. You can use natural language to interact with WhatsApp through Claude!
