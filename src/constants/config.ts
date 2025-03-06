export const COMMANDS = {
  SUMMARIZE: '!summarize',
  HELP: '!help',
};

export const RESPONSES = {
  WORKING: 'Working on it...',
  WELCOME: `👋 Hello! I'm your AI assistant. I can help you with:
• Summarizing threads (use \`!summarize\` in a thread)
• Answering questions (just end with a ? mark)
• Finding similar messages`,

  HELP: `Available commands:
• Ask a question (end with a ? mark)
• \`!summarize\` - Summarize the current thread
• \`!help\` - Show this help message
• Say hello`,

  DEFAULT: (text: string) =>
    `I received your message: "${text}" Need help? Try \`!help\` for a list of commands`,

  ERROR: 'Sorry, I encountered an error processing your request.',
  QUESTION_ERROR: "I'm having trouble answering your question right now. Please try again later.",

  NO_SIMILAR: "I couldn't find any similar questions in my memory.",
  SIMILAR_QUESTIONS: (questions: { question: string; response: string }[]) =>
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

Be concise but friendly in your responses. Try to make the response as short as possible`,
  },
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  MATCH_SCORE: 0.92,
};

export const SLACK_CONFIG = {
  BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
  APP_TOKEN: process.env.SLACK_APP_TOKEN,
};

export const PINECONE_CONFIG = {
  API_KEY: process.env.PINECONE_API_KEY,
  INDEX_NAME: process.env.PINECONE_INDEX_NAME,
};

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
};

export const REDIS_CONFIG = {
  HOST: process.env.REDIS_HOST || 'localhost',
  USERNAME: process.env.REDIS_USERNAME,
  PASSWORD: process.env.REDIS_PASSWORD,
  PORT: process.env.REDIS_PORT,
  PREFIXES: {
    EMBEDDING: 'embedding:',
  },
};

export const MONGODB_CONFIG: {
  URI: string | undefined;
  DB_NAME: string | undefined;
  USERNAME: string | undefined;
  PASSWORD: string | undefined;
  OPTIONS: string | undefined;
} = {
  URI: process.env.ORMONGO_RS_URL,
  DB_NAME: process.env.MONGODB_DB_NAME,
  USERNAME: process.env.MONGODB_USERNAME,
  PASSWORD: process.env.MONGODB_PASSWORD,
  OPTIONS: process.env.MONGODB_OPTIONS,
};
