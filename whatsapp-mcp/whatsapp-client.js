import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch';
import config from './config.js';
import fs from 'fs';
import path from 'path';
import * as dealTracker from './deal-tracker.js';
import { BUSINESS_INSTRUCTIONS } from './BUSINESS_INSTRUCTIONS.js';

class WhatsAppClient {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.conversationHistory = new Map(); // Store conversation history per contact
  }

  async initialize(enableAutoReply = false) {
    return new Promise((resolve, reject) => {
      console.error('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      this.client.on('qr', (qr) => {
        console.error('\nScan the QR code below with WhatsApp:\n');
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        console.error('WhatsApp client is ready!');
        this.isReady = true;
        resolve();
      });

      this.client.on('authenticated', () => {
        console.error('Authentication successful!');
      });

      this.client.on('auth_failure', (msg) => {
        console.error('Authentication failed:', msg);
        reject(new Error('Authentication failed'));
      });

      this.client.on('disconnected', (reason) => {
        console.error('Client disconnected:', reason);
        this.isReady = false;
      });

      if (enableAutoReply) {
        this.setupAutoReply();
      }

      this.client.initialize();
    });
  }

  setupAutoReply() {
    this.client.on('message', async (message) => {
      try {
        // Ignore own messages and group messages
        if (message.fromMe) return;
        if (message.from.includes('@g.us')) return;

        const incomingText = message.body;
        const contactId = message.from;
        const contact = await message.getContact();
        const contactName = contact.pushname || contact.name || message.from;

        console.log(`\n📨 Message from ${contactName}: ${message.body}`);

        // AI-based deal detection
        const isDeal = await this.detectDealWithAI(incomingText);

        if (isDeal) {
          // DEBUG: Log all available phone number sources
          console.log('\n🔍 DEBUG - Phone Number Sources:');
          console.log('message.from:', message.from);
          console.log('message.author:', message.author);
          console.log('contact.number:', contact.number);
          console.log('contact.id.user:', contact.id?.user);
          console.log('contact.id._serialized:', contact.id?._serialized);

          // Get real phone number - use contact.id.user for @lid messages
          let phoneNumber;
          if (message.from.includes('@c.us')) {
            phoneNumber = message.from.split('@')[0];
          } else {
            phoneNumber = contact.id.user;
          }

          const cleanPhone = this.cleanAndValidatePhone(phoneNumber);

          console.log('\n🔔 DEAL ALERT 🔔');
          console.log(`Contact: ${contactName}`);
          console.log(`Phone: ${cleanPhone}`);
          console.log(`Message: ${message.body}\n`);

          // Save deal to tracker
          try {
            await dealTracker.addDeal(
              contactName,
              cleanPhone,
              message.body,
              'pending'
            );
            console.log('✅ Deal saved to tracker\n');
          } catch (error) {
            console.error('❌ Error saving deal:', error.message);
          }
        }

        // Check if customer is requesting an image
        const imageRequest = this.checkImageRequest(incomingText);
        if (imageRequest.isRequest && imageRequest.productName) {
          console.log(`🖼️  Image request detected for: ${imageRequest.productName}`);

          const imagePath = this.findProductImage(imageRequest.productName);
          if (imagePath) {
            console.log(`✅ Found image: ${imagePath}`);

            // Send the image
            const media = MessageMedia.fromFilePath(imagePath);
            const caption = `Here's the ${imageRequest.productName} 😊`;

            const delay = config.MIN_DELAY + Math.random() * (config.MAX_DELAY - config.MIN_DELAY);
            await new Promise(resolve => setTimeout(resolve, delay));

            await message.reply(media, undefined, { caption });
            console.log(`📤 Image sent: ${imageRequest.productName}\n`);

            // Don't send AI reply if image was sent
            return;
          } else {
            console.log(`❌ No image found for: ${imageRequest.productName}`);
            // Continue to AI reply to inform customer
          }
        }

        // Add user message to conversation history
        this.addToHistory(contactId, 'user', incomingText);

        // Generate AI reply
        const reply = await this.generateAIReply(contactId);

        // Add assistant reply to conversation history
        this.addToHistory(contactId, 'assistant', reply);

        // Random delay for natural feel (1-3 seconds)
        const delay = config.MIN_DELAY + Math.random() * (config.MAX_DELAY - config.MIN_DELAY);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Send reply
        await message.reply(reply);
        console.log(`✅ Replied: ${reply}\n`);

      } catch (error) {
        console.error('❌ Error in auto-reply:', error.message);

        // Fallback to simple reply if AI fails
        try {
          const fallbackReply = this.generateFallbackReply(message.body.toLowerCase());
          await message.reply(fallbackReply);
          console.log(`✅ Fallback reply sent: ${fallbackReply}\n`);
        } catch (fallbackError) {
          console.error('❌ Fallback reply also failed:', fallbackError.message);
        }
      }
    });
  }

  addToHistory(contactId, role, content) {
    if (!this.conversationHistory.has(contactId)) {
      this.conversationHistory.set(contactId, []);
    }

    const history = this.conversationHistory.get(contactId);
    history.push({ role, content });

    // Keep only last N messages per contact
    if (history.length > config.MAX_HISTORY_PER_CONTACT * 2) {
      history.splice(0, 2); // Remove oldest user-assistant pair
    }
  }

  async generateAIReply(contactId) {
    // Check if API key is configured
    if (!config.GROQ_API_KEY || config.GROQ_API_KEY === 'your-groq-api-key-here') {
      console.log('⚠️  Groq API key not configured, using fallback responses');
      const history = this.conversationHistory.get(contactId) || [];
      const lastMessage = history[history.length - 1]?.content || '';
      return this.generateFallbackReply(lastMessage.toLowerCase());
    }

    const history = this.conversationHistory.get(contactId) || [];

    // Build messages array for API - use BUSINESS_INSTRUCTIONS
    const messages = [
      { role: 'system', content: BUSINESS_INSTRUCTIONS },
      ...history
    ];

    try {
      const response = await fetch(config.GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: config.GROQ_MODEL,
          messages: messages,
          temperature: 0.7,
          max_tokens: 150,
          top_p: 1,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const aiReply = data.choices[0]?.message?.content?.trim();

      if (!aiReply) {
        throw new Error('Empty response from Groq API');
      }

      return aiReply;

    } catch (error) {
      console.error('❌ Groq API error:', error.message);
      // Fallback to simple reply
      const lastMessage = history[history.length - 1]?.content || '';
      return this.generateFallbackReply(lastMessage.toLowerCase());
    }
  }

  checkDealKeywords(text) {
    return config.DEAL_KEYWORDS.some(keyword => text.includes(keyword));
  }

  cleanPhoneNumber(phoneId) {
    // Remove WhatsApp suffixes: @c.us, @s.whatsapp.net, @lid
    let cleaned = phoneId.replace(/@c\.us/g, '')
                         .replace(/@s\.whatsapp\.net/g, '')
                         .replace(/@lid/g, '')
                         .replace(/:/g, '');

    // Remove any non-digit characters
    cleaned = cleaned.replace(/\D/g, '');

    return cleaned;
  }

  cleanAndValidatePhone(phoneNumber) {
    // If no phone number provided, return empty
    if (!phoneNumber) {
      console.log('⚠️  No phone number provided');
      return '';
    }

    // Clean the phone number
    let cleaned = this.cleanPhoneNumber(phoneNumber);

    // Fix duplicate country codes
    cleaned = this.fixDuplicateCountryCodes(cleaned);

    // Validate and fix if needed
    cleaned = this.validatePhoneNumber(cleaned);

    return cleaned;
  }

  async getRealPhoneNumber(messageFrom, contact) {
    try {
      // Try to get the real number from contact.number first
      let phoneNumber = contact.number || contact.id?.user || contact.id?._serialized;

      // If we got a number, clean it
      if (phoneNumber) {
        phoneNumber = this.cleanPhoneNumber(phoneNumber);
      } else {
        // Fallback to message.from
        phoneNumber = this.cleanPhoneNumber(messageFrom);
      }

      // Handle duplicate country codes (e.g., 96792... should be split)
      phoneNumber = this.fixDuplicateCountryCodes(phoneNumber);

      // Validate and return
      const validatedNumber = this.validatePhoneNumber(phoneNumber);

      return validatedNumber;

    } catch (error) {
      console.error('❌ Error getting real phone number:', error.message);
      // Fallback to basic cleaning
      return this.cleanPhoneNumber(messageFrom);
    }
  }

  fixDuplicateCountryCodes(phoneNumber) {
    // Check for common duplicate country code patterns

    // Yemen (967) + Pakistan (92) combined: 96792...
    // Pattern: 967 + 92 + 10 digits = 15 digits total
    if (phoneNumber.startsWith('96792') && phoneNumber.length >= 14) {
      phoneNumber = phoneNumber.substring(3); // Remove '967', keep '92...'
    }

    // UAE (971) + Pakistan (92) combined: 97192...
    if (phoneNumber.startsWith('97192') && phoneNumber.length >= 14) {
      phoneNumber = phoneNumber.substring(3); // Remove '971', keep '92...'
    }

    // Remove leading zeros
    phoneNumber = phoneNumber.replace(/^0+/, '');

    return phoneNumber;
  }

  validatePhoneNumber(phoneNumber) {
    // Pakistan: starts with 92, total 12 digits (92 + 10 digits)
    if (phoneNumber.startsWith('92') && phoneNumber.length === 12) {
      return phoneNumber;
    }

    // UAE: starts with 971, total 12 digits (971 + 9 digits)
    if (phoneNumber.startsWith('971') && phoneNumber.length === 12) {
      return phoneNumber;
    }

    // Yemen: starts with 967, total 12 digits (967 + 9 digits)
    if (phoneNumber.startsWith('967') && phoneNumber.length === 12) {
      return phoneNumber;
    }

    // Saudi Arabia: starts with 966, total 12 digits
    if (phoneNumber.startsWith('966') && phoneNumber.length === 12) {
      return phoneNumber;
    }

    // Try to fix common issues
    // If it's a Pakistan number without country code (10 digits starting with 3)
    if (phoneNumber.length === 10 && phoneNumber.startsWith('3')) {
      return '92' + phoneNumber;
    }

    // If validation fails, return as-is (log warning in development only)
    return phoneNumber;
  }

  async detectDealWithAI(messageText) {
    // First check with keywords as a quick filter
    if (this.checkDealKeywords(messageText.toLowerCase())) {
      return true;
    }

    // If Groq API is not configured, use keyword-only detection
    if (!config.GROQ_API_KEY || config.GROQ_API_KEY === 'your-groq-api-key-here') {
      return false;
    }

    try {
      const dealDetectionPrompt = `Analyze if this customer message indicates they want to place an order, buy something, or confirm a deal.

Customer message: "${messageText}"

STRICT RULES:
- "Ok", "Okay", "Theek hai", "Haan" ALONE are NOT deals
- Only detect deals with CLEAR purchase intent

Deal indicators (must have action words):
- Order requests: "order kardo", "order kar do", "mangwao", "send karo"
- Purchase intent: "le lunga", "le leti hoon", "khareed lunga", "chahiye"
- Confirmation with action: "confirm kardo", "book kar do", "done kar do"
- Final commitment: "pakka order hai", "final hai le lo"

NOT deals:
- Simple acknowledgments: "ok", "okay", "theek hai", "haan", "achha"
- Questions: "kitne ka hai?", "available hai?"
- General chat: "hello", "thanks", "shukriya"

Reply with ONLY "YES" if this is a clear deal/order with action words, or "NO" if it's not.`;

      const response = await fetch(config.GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: config.GROQ_MODEL,
          messages: [
            { role: 'system', content: 'You are a strict deal detection assistant. Only detect clear purchase orders with action words. Reply only with YES or NO.' },
            { role: 'user', content: dealDetectionPrompt }
          ],
          temperature: 0.2,
          max_tokens: 10,
          top_p: 1,
          stream: false
        })
      });

      if (!response.ok) {
        console.error('Deal detection API error, falling back to keywords');
        return false;
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content?.trim().toUpperCase();

      return aiResponse === 'YES';

    } catch (error) {
      console.error('❌ Error in AI deal detection:', error.message);
      return false;
    }
  }

  checkImageRequest(text) {
    const lowerText = text.toLowerCase();

    // Check if message contains image request keywords
    const hasImageKeyword = config.IMAGE_KEYWORDS.some(keyword => lowerText.includes(keyword));

    if (!hasImageKeyword) {
      return { isRequest: false, productName: null };
    }

    // Extract product name from the message
    // Remove image keywords and common words to get product name
    let cleanedText = lowerText;

    // Remove image keywords
    config.IMAGE_KEYWORDS.forEach(keyword => {
      cleanedText = cleanedText.replace(new RegExp(keyword, 'gi'), '');
    });

    // Remove common words
    const commonWords = ['ki', 'ka', 'ke', 'do', 'de', 'dena', 'the', 'a', 'an', 'of', 'mujhe', 'please', 'bhai'];
    commonWords.forEach(word => {
      cleanedText = cleanedText.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    });

    // Clean up and extract product name
    const productName = cleanedText.trim().replace(/\s+/g, ' ').split(' ')[0];

    if (productName && productName.length > 2) {
      return { isRequest: true, productName: productName };
    }

    return { isRequest: true, productName: null };
  }

  findProductImage(productName) {
    try {
      // Check if products folder exists
      if (!fs.existsSync(config.PRODUCTS_FOLDER)) {
        console.log(`⚠️  Products folder not found: ${config.PRODUCTS_FOLDER}`);
        return null;
      }

      // Get all files in products folder
      const files = fs.readdirSync(config.PRODUCTS_FOLDER);

      // Search for matching product image
      const productLower = productName.toLowerCase();

      for (const file of files) {
        const fileLower = file.toLowerCase();
        const ext = path.extname(fileLower);

        // Check if file extension is supported
        if (!config.IMAGE_EXTENSIONS.includes(ext)) {
          continue;
        }

        // Check if filename contains product name
        const fileNameWithoutExt = path.basename(fileLower, ext);

        if (fileNameWithoutExt.includes(productLower) || productLower.includes(fileNameWithoutExt)) {
          return path.join(config.PRODUCTS_FOLDER, file);
        }
      }

      return null;

    } catch (error) {
      console.error('❌ Error finding product image:', error.message);
      return null;
    }
  }

  generateFallbackReply(messageText) {
    const greetings = ['salam', 'hello', 'hi', 'assalam', 'hey'];
    const thanks = ['thanks', 'thank', 'shukriya', 'شکریہ'];
    const price = ['price', 'rate', 'kitne', 'kya rate', 'kitna'];
    const availability = ['available', 'mil', 'stock', 'موجود'];

    if (greetings.some(g => messageText.includes(g))) {
      return this.randomChoice([
        'Walaikum Salam! Kaise madad kar sakta hoon? 😊',
        'Hello! Kya chahiye aapko?',
        'Salam! Batayein kya service chahiye?',
        'Hi! How can I help you today?'
      ]);
    }

    if (thanks.some(t => messageText.includes(t))) {
      return this.randomChoice([
        'Welcome! Koi aur help chahiye?',
        'Koi baat nahi! Aur kuch?',
        'You\'re welcome! 😊',
        'Pleasure! Aur kuch batayein?'
      ]);
    }

    if (price.some(p => messageText.includes(p))) {
      return this.randomChoice([
        'Price details ke liye thora wait karein, abhi check kar ke batata hoon.',
        'Rate confirm kar ke bataunga, ek minute.',
        'Let me check the current rates for you.',
        'Price details abhi send karta hoon, wait karein.'
      ]);
    }

    if (availability.some(a => messageText.includes(a))) {
      return this.randomChoice([
        'Stock check kar raha hoon, thora wait karein.',
        'Availability confirm kar ke batata hoon.',
        'Let me verify the stock for you.',
        'Abhi check karta hoon available hai ya nahi.'
      ]);
    }

    return this.randomChoice([
      'Ji bilkul, thora wait karein main check kar ke batata hoon.',
      'Samajh gaya, abhi dekh ke reply karta hoon.',
      'Sure, let me get back to you on this.',
      'Okay, main confirm kar ke bataunga aapko.',
      'Received! Thori der mein proper reply dunga.',
      'Got it! Will update you shortly. 👍'
    ]);
  }

  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  formatPhone(phone) {
    let cleaned = phone.replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');
    return cleaned.includes('@c.us') ? phone : `${cleaned}@c.us`;
  }

  async sendMessage(phone, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhone(phone);
    await this.client.sendMessage(chatId, message);
    return { success: true };
  }

  async sendMessageWithMedia(phone, message, mediaPath) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhone(phone);
    const media = MessageMedia.fromFilePath(mediaPath);

    await this.client.sendMessage(chatId, media, { caption: message });
    return { success: true };
  }

  async getChats(limit = 20) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await this.client.getChats();
    return chats.slice(0, limit).map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount,
      timestamp: chat.timestamp,
    }));
  }

  async getChatMessages(chatId, limit = 50) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });

    return messages.map(msg => ({
      id: msg.id._serialized,
      body: msg.body,
      from: msg.from,
      to: msg.to,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
      hasMedia: msg.hasMedia,
      type: msg.type,
    }));
  }

  async getContactInfo(phone) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhone(phone);
    const contact = await this.client.getContactById(chatId);

    return {
      id: contact.id._serialized,
      name: contact.name,
      pushname: contact.pushname,
      number: contact.number,
      isMyContact: contact.isMyContact,
      isBlocked: contact.isBlocked,
    };
  }

  async isRegisteredUser(phone) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhone(phone);
    return await this.client.isRegisteredUser(chatId);
  }

  async getAllGroups() {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await this.client.getChats();
    return chats
      .filter(chat => chat.isGroup)
      .map(chat => ({
        id: chat.id._serialized,
        name: chat.name,
        participantsCount: chat.participants.length,
        timestamp: chat.timestamp,
      }));
  }

  async getGroupMembers(groupId) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await this.client.getChatById(groupId);

    if (!chat.isGroup) {
      throw new Error('Provided ID is not a group');
    }

    return chat.participants.map(p => ({
      id: p.id._serialized,
      isAdmin: p.isAdmin,
      isSuperAdmin: p.isSuperAdmin,
    }));
  }

  async getProfilePicture(phone) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhone(phone);
    try {
      const url = await this.client.getProfilePicUrl(chatId);
      return url;
    } catch (error) {
      return null;
    }
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.isReady = false;
    }
  }
}

export default WhatsAppClient;
