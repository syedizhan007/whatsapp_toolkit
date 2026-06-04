# WhatsApp MCP Server

Model Context Protocol (MCP) server for WhatsApp integration with Claude AI.

## Features

- **Send Messages**: Send text messages to any WhatsApp number
- **Send Media**: Send images and documents with captions
- **Get Chats**: Retrieve list of all chats
- **Get Messages**: Fetch messages from specific chats
- **Contact Info**: Get information about contacts
- **Number Validation**: Check if number is on WhatsApp
- **Group Management**: List groups, get members, send group messages
- **Profile Pictures**: Retrieve profile picture URLs

## Installation

```bash
cd whatsapp-mcp
npm install
```

## Configuration

### Add to Claude Desktop Config

Edit your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add this MCP server:

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

## First Run

1. Start Claude Desktop
2. The WhatsApp MCP server will initialize
3. Scan the QR code with WhatsApp
4. Session will be saved for future use

## Available Tools

### send_whatsapp_message
Send a text message to a phone number.

**Parameters:**
- `phone` (string): Phone number with country code (e.g., +1234567890)
- `message` (string): Message text

**Example:**
```
Send a WhatsApp message to +1234567890 saying "Hello from Claude!"
```

### send_whatsapp_media
Send a message with media attachment.

**Parameters:**
- `phone` (string): Phone number with country code
- `message` (string): Caption for the media
- `mediaPath` (string): Local file path to image/document

**Example:**
```
Send the file C:\images\photo.jpg to +1234567890 with caption "Check this out!"
```

### get_whatsapp_chats
Get list of all WhatsApp chats.

**Parameters:**
- `limit` (number, optional): Maximum chats to return (default: 20)

**Example:**
```
Show me my recent WhatsApp chats
```

### get_chat_messages
Get messages from a specific chat.

**Parameters:**
- `chatId` (string): Chat ID (phone@c.us format)
- `limit` (number, optional): Number of messages (default: 50)

**Example:**
```
Get the last 10 messages from chat 1234567890@c.us
```

### get_contact_info
Get information about a contact.

**Parameters:**
- `phone` (string): Phone number with country code

**Example:**
```
Get contact info for +1234567890
```

### check_whatsapp_number
Check if a number is registered on WhatsApp.

**Parameters:**
- `phone` (string): Phone number with country code

**Example:**
```
Check if +1234567890 is on WhatsApp
```

### get_groups
Get list of all WhatsApp groups.

**Example:**
```
Show me all my WhatsApp groups
```

### get_group_members
Get members of a specific group.

**Parameters:**
- `groupId` (string): Group ID

**Example:**
```
Get members of group 123456789@g.us
```

### send_group_message
Send a message to a WhatsApp group.

**Parameters:**
- `groupId` (string): Group ID
- `message` (string): Message text

**Example:**
```
Send "Hello everyone!" to group 123456789@g.us
```

### get_profile_picture
Get profile picture URL of a contact.

**Parameters:**
- `phone` (string): Phone number with country code

**Example:**
```
Get profile picture for +1234567890
```

## Usage Examples

Once configured in Claude Desktop, you can use natural language:

```
"Send a WhatsApp message to +1234567890 saying 'Meeting at 3 PM'"

"Check if +9876543210 is on WhatsApp"

"Show me my recent WhatsApp chats"

"Get the last 20 messages from my chat with +1234567890"

"Send the file C:\docs\report.pdf to +1234567890"

"List all my WhatsApp groups"

"Send 'Good morning team!' to my work group"
```

## Phone Number Format

Always use international format with country code:
- ✅ +1234567890
- ✅ +919876543210
- ❌ 1234567890 (missing +)
- ❌ 01234567890 (leading zero)

## Chat ID Format

Chat IDs use WhatsApp's internal format:
- Individual: `1234567890@c.us`
- Group: `123456789@g.us`

The server automatically formats phone numbers, but you can use the full format if needed.

## Troubleshooting

**QR code not appearing:**
- Check Claude Desktop logs
- Delete `.wwebjs_auth/` folder
- Restart Claude Desktop

**Messages not sending:**
- Verify phone number format
- Check if number is on WhatsApp
- Ensure WhatsApp Web is not open elsewhere

**Server not connecting:**
- Verify config file path is correct
- Check Node.js is installed
- Review Claude Desktop logs

## Security Notes

- Session data is stored locally in `.wwebjs_auth/`
- Never share your session files
- QR code scan required only once
- Session persists across restarts

## Limitations

- WhatsApp Web limitations apply
- Rate limiting by WhatsApp
- Media files must be local paths
- Cannot receive messages (send-only)

## Development

To run standalone (without Claude):

```bash
npm start
```

This starts the MCP server on stdio for testing.

## License

MIT
