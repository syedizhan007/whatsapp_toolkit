import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import WhatsAppClient from './whatsapp-client.js';

class WhatsAppMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'whatsapp-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.whatsapp = new WhatsAppClient();
    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'send_whatsapp_message',
          description: 'Send a WhatsApp message to a phone number',
          inputSchema: {
            type: 'object',
            properties: {
              phone: {
                type: 'string',
                description: 'Phone number with country code (e.g., +1234567890)',
              },
              message: {
                type: 'string',
                description: 'Message text to send',
              },
            },
            required: ['phone', 'message'],
          },
        },
        {
          name: 'send_whatsapp_media',
          description: 'Send a WhatsApp message with media (image/document)',
          inputSchema: {
            type: 'object',
            properties: {
              phone: {
                type: 'string',
                description: 'Phone number with country code',
              },
              message: {
                type: 'string',
                description: 'Caption for the media',
              },
              mediaPath: {
                type: 'string',
                description: 'Local file path to the media file',
              },
            },
            required: ['phone', 'mediaPath'],
          },
        },
        {
          name: 'get_whatsapp_chats',
          description: 'Get list of all WhatsApp chats',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of chats to return (default: 20)',
              },
            },
          },
        },
        {
          name: 'get_chat_messages',
          description: 'Get messages from a specific chat',
          inputSchema: {
            type: 'object',
            properties: {
              chatId: {
                type: 'string',
                description: 'Chat ID (phone number with @c.us suffix)',
              },
              limit: {
                type: 'number',
                description: 'Number of messages to fetch (default: 50)',
              },
            },
            required: ['chatId'],
          },
        },
        {
          name: 'get_contact_info',
          description: 'Get information about a WhatsApp contact',
          inputSchema: {
            type: 'object',
            properties: {
              phone: {
                type: 'string',
                description: 'Phone number with country code',
              },
            },
            required: ['phone'],
          },
        },
        {
          name: 'check_whatsapp_number',
          description: 'Check if a phone number is registered on WhatsApp',
          inputSchema: {
            type: 'object',
            properties: {
              phone: {
                type: 'string',
                description: 'Phone number with country code',
              },
            },
            required: ['phone'],
          },
        },
        {
          name: 'get_groups',
          description: 'Get list of all WhatsApp groups',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_group_members',
          description: 'Get members of a specific WhatsApp group',
          inputSchema: {
            type: 'object',
            properties: {
              groupId: {
                type: 'string',
                description: 'Group ID',
              },
            },
            required: ['groupId'],
          },
        },
        {
          name: 'send_group_message',
          description: 'Send a message to a WhatsApp group',
          inputSchema: {
            type: 'object',
            properties: {
              groupId: {
                type: 'string',
                description: 'Group ID',
              },
              message: {
                type: 'string',
                description: 'Message text to send',
              },
            },
            required: ['groupId', 'message'],
          },
        },
        {
          name: 'get_profile_picture',
          description: 'Get profile picture URL of a contact',
          inputSchema: {
            type: 'object',
            properties: {
              phone: {
                type: 'string',
                description: 'Phone number with country code',
              },
            },
            required: ['phone'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'send_whatsapp_message':
            return await this.sendMessage(args.phone, args.message);

          case 'send_whatsapp_media':
            return await this.sendMedia(args.phone, args.message, args.mediaPath);

          case 'get_whatsapp_chats':
            return await this.getChats(args.limit || 20);

          case 'get_chat_messages':
            return await this.getChatMessages(args.chatId, args.limit || 50);

          case 'get_contact_info':
            return await this.getContactInfo(args.phone);

          case 'check_whatsapp_number':
            return await this.checkNumber(args.phone);

          case 'get_groups':
            return await this.getGroups();

          case 'get_group_members':
            return await this.getGroupMembers(args.groupId);

          case 'send_group_message':
            return await this.sendGroupMessage(args.groupId, args.message);

          case 'get_profile_picture':
            return await this.getProfilePicture(args.phone);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async sendMessage(phone, message) {
    const result = await this.whatsapp.sendMessage(phone, message);
    return {
      content: [
        {
          type: 'text',
          text: `Message sent successfully to ${phone}`,
        },
      ],
    };
  }

  async sendMedia(phone, message, mediaPath) {
    const result = await this.whatsapp.sendMessageWithMedia(phone, message, mediaPath);
    return {
      content: [
        {
          type: 'text',
          text: `Media sent successfully to ${phone}`,
        },
      ],
    };
  }

  async getChats(limit) {
    const chats = await this.whatsapp.getChats(limit);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(chats, null, 2),
        },
      ],
    };
  }

  async getChatMessages(chatId, limit) {
    const messages = await this.whatsapp.getChatMessages(chatId, limit);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(messages, null, 2),
        },
      ],
    };
  }

  async getContactInfo(phone) {
    const info = await this.whatsapp.getContactInfo(phone);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }

  async checkNumber(phone) {
    const isRegistered = await this.whatsapp.isRegisteredUser(phone);
    return {
      content: [
        {
          type: 'text',
          text: `Phone ${phone} is ${isRegistered ? 'registered' : 'not registered'} on WhatsApp`,
        },
      ],
    };
  }

  async getGroups() {
    const groups = await this.whatsapp.getAllGroups();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(groups, null, 2),
        },
      ],
    };
  }

  async getGroupMembers(groupId) {
    const members = await this.whatsapp.getGroupMembers(groupId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(members, null, 2),
        },
      ],
    };
  }

  async sendGroupMessage(groupId, message) {
    await this.whatsapp.sendMessage(groupId, message);
    return {
      content: [
        {
          type: 'text',
          text: `Message sent to group ${groupId}`,
        },
      ],
    };
  }

  async getProfilePicture(phone) {
    const url = await this.whatsapp.getProfilePicture(phone);
    return {
      content: [
        {
          type: 'text',
          text: url || 'No profile picture available',
        },
      ],
    };
  }

  async start() {
    // Initialize WhatsApp client
    await this.whatsapp.initialize();

    // Start MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('WhatsApp MCP Server running on stdio');
  }
}

// Check if running in standalone auto-reply mode
const isStandaloneMode = process.argv.includes('--standalone') || process.argv.includes('--auto-reply');

if (isStandaloneMode) {
  console.log('🤖 Starting WhatsApp Auto-Reply Bot...\n');

  const whatsapp = new WhatsAppClient();

  whatsapp.initialize(true).then(() => {
    console.log('\n✅ Auto-Reply Bot is now active!');
    console.log('📱 Listening for incoming messages...');
    console.log('🔔 Deal keywords will trigger alerts\n');
    console.log('Press Ctrl+C to stop\n');

    // Keep the process alive - check status every 30 seconds
    const keepAlive = setInterval(() => {
      if (whatsapp.isReady) {
        console.log(`[${new Date().toLocaleTimeString()}] Bot is running...`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] ⚠️  Bot disconnected, attempting to reconnect...`);
      }
    }, 30000);

    // Store interval reference for cleanup
    process.keepAliveInterval = keepAlive;

  }).catch(error => {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down Auto-Reply Bot...');

    // Clear keep-alive interval
    if (process.keepAliveInterval) {
      clearInterval(process.keepAliveInterval);
    }

    await whatsapp.destroy();
    process.exit(0);
  });

  // Handle unexpected errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

} else {
  // Start the MCP server
  const server = new WhatsAppMCPServer();
  server.start().catch(console.error);
}
