export const COMMANDS = {
  SUMMARIZE: '!summarize',
  HELP: '!help',
};

export const RESPONSES = {
  WELCOME: `👋 Hello! I'm your AI assistant. I can help you with:
• Summarizing threads (use \`!summarize\` in a thread)
• Answering questions (just end with a ? mark)
• Finding similar messages`,

  HELP: `Available commands:
• Ask a question (end with a ? mark)
• \`!summarize\` - Summarize the current thread
• \`!help\` - Show this help message
• Say hello`,

  DEFAULT: (text) => `I received your message: "${text}"
Need help? Try \`!help\` for a list of commands`,

  ERROR: 'Sorry, I encountered an error processing your request.',
  QUESTION_ERROR: "I'm having trouble answering your question right now. Please try again later.",

  NO_SIMILAR: "I couldn't find any similar questions in my memory.",
  SIMILAR_QUESTIONS: (questions) =>
    `Here are similar questions I've answered before:\n${questions
      .map((q, i) => `${i + 1}. Q: ${q.question}\nA: ${q.response}`)
      .join('\n\n')}`,

  SUMMARIZE_ERROR: 'Error generating summary',
  SUMMARIZE_NO_THREAD: 'This command must be used in a thread',
};

export const AI_CONFIG = {
  MODELS: {
    CHAT: 'gpt-4-turbo',
    EMBEDDING: 'text-embedding-3-small',
  },
  SYSTEM_PROMPTS: {
    DEFAULT: `You are a senior Site Reliability Engineer (SRE) with 10+ years of experience in cloud infrastructure, DevOps practices, and system architecture. Your expertise includes:
• Cloud platforms (AWS, GCP, Azure)
• Kubernetes and container orchestration
• Infrastructure as Code (Terraform, CloudFormation)
• Monitoring and observability (Prometheus, Grafana, ELK)
• CI/CD pipelines and automation
• Performance optimization and scalability
• Incident response and troubleshooting

Be concise but friendly in your responses, and provide practical, production-ready solutions when applicable. If relevant, include best practices and potential pitfalls to watch out for.`,
  },
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

export const SLACK_CONFIG = {
  BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
  APP_TOKEN: process.env.SLACK_APP_TOKEN,
};

export const PINECONE_CONFIG = {
  API_KEY: process.env.PINECONE_API_KEY,
};

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
};

export const REDIS_CONFIG = {
  URL: process.env.REDIS_URL || 'redis://localhost:6379',
  USERNAME: process.env.REDIS_USERNAME,
  PASSWORD: process.env.REDIS_PASSWORD,
  POST: process.env.REDIS_POST,
};
