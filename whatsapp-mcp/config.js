export default {
  // Groq API Configuration
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_MODEL: 'llama-3.3-70b-versatile',

  // Auto-Reply Settings
  MIN_DELAY: 1000,  // 1 second
  MAX_DELAY: 3000,  // 3 seconds
  MAX_HISTORY_PER_CONTACT: 10,  // Keep last 10 messages per contact

  // System Prompt for AI
  SYSTEM_PROMPT: `You are a professional customer service agent for a business. Reply in the same language the customer uses (Urdu, English, or Roman Urdu).
Be helpful, friendly and professional.
Keep replies short and to the point (1-3 sentences max).
Never say you are an AI or mention that you're automated.
If asked about products, prices, or availability, acknowledge and say you'll check and confirm.
Use natural conversational tone with appropriate emojis occasionally.`,

  // Deal Detection Keywords - Only clear purchase intent
  DEAL_KEYWORDS: [
    'order kardo', 'order kar do', 'order kar', 'order de',
    'le lunga', 'le lungi', 'le leta', 'le leti', 'le lo',
    'mangwao', 'mangwa do', 'send karo', 'send kar do',
    'book kar', 'book karo', 'book kar do',
    'confirm kardo', 'confirm kar do',
    'pakka order', 'final order', 'done kar do',
    'chahiye mujhe', 'khareed lunga', 'purchase'
  ],

  // Image Request Keywords
  IMAGE_KEYWORDS: [
    'pic', 'photo', 'image', 'picture', 'tasveer', 'tasvir',
    'dikhao', 'dikha', 'dekho', 'show', 'bhejo', 'send'
  ],

  // Products folder path
  PRODUCTS_FOLDER: './products',

  // Supported image extensions
  IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
};
