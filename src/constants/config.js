export const COMMANDS = {
  SUMMARIZE: "!summarize",
  HELP: "!help",
};

export const RESPONSES = {
  WELCOME: `👋 Hello! I'm your AI assistant. I can help you with:
• Summarizing threads (use \`!summarize\` in a thread)
• Answering questions
• Finding similar messages`,

  HELP: `Available commands:
• Ask questions with ? sign
• \`!summarize\` - Summarize the current thread
• \`!help\` - Show this help message
You can also:
• Ask me questions
• Say hello`,

  DEFAULT: (text) => `I received your message: "${text}"
Need help? Try \`!help\` for a list of commands`,

  ERROR: "Sorry, I encountered an error processing your request.",
  QUESTION_ERROR: "I'm having trouble answering your question right now. Please try again later.",
};

export const AI_CONFIG = {
  MODELS: {
    CHAT: "gpt-3.5-turbo",
    EMBEDDING: "text-embedding-ada-002",
  },
  SYSTEM_PROMPTS: {
    DEFAULT: "You are a helpful AI assistant in a Slack channel. Be concise but friendly in your responses.",
  },
};

export const CHANNELS_TO_JOIN = [
  // Add your channel IDs here
  // 'C08CN03GZT7',
];

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
}; 