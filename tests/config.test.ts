import {
  AI_CONFIG,
  COMMANDS,
  MONGODB_CONFIG,
  PINECONE_CONFIG,
  REDIS_CONFIG,
  RESPONSES,
  SERVER_CONFIG,
  SLACK_CONFIG,
} from '../src/constants/config';

describe('Config Constants', () => {
  test('COMMANDS should have correct values', () => {
    expect(COMMANDS.SUMMARIZE).toBe('!summarize');
    expect(COMMANDS.HELP).toBe('!help');
  });

  test('RESPONSES should have correct values', () => {
    expect(RESPONSES.WORKING).toBe('Working on it...');
    expect(RESPONSES.WELCOME).toContain("Hello! I'm your AI assistant.");
    expect(RESPONSES.HELP).toContain('Available commands:');
  });

  test('AI_CONFIG should have correct model names', () => {
    expect(AI_CONFIG.MODELS.CHAT).toBe('gpt-4-turbo');
    expect(AI_CONFIG.MODELS.EMBEDDING).toBe('text-embedding-3-small');
  });

  test('SLACK_CONFIG should have environment variables', () => {
    expect(SLACK_CONFIG.BOT_TOKEN).toBeDefined();
    expect(SLACK_CONFIG.SIGNING_SECRET).toBeDefined();
    expect(SLACK_CONFIG.APP_TOKEN).toBeDefined();
  });

  test('PINECONE_CONFIG should have environment variables', () => {
    expect(PINECONE_CONFIG.API_KEY).toBeDefined();
    expect(PINECONE_CONFIG.INDEX_NAME).toBeDefined();
  });

  test('SERVER_CONFIG should have a default port', () => {
    expect(SERVER_CONFIG.PORT).toBeDefined();
  });

  test('REDIS_CONFIG should have default host', () => {
    expect(REDIS_CONFIG.HOST).toBe('localhost');
  });

  test('MONGODB_CONFIG should have environment variables', () => {
    expect(MONGODB_CONFIG.URI).toBeDefined();
    expect(MONGODB_CONFIG.DB_NAME).toBeDefined();
    expect(MONGODB_CONFIG.USERNAME).toBeDefined();
    expect(MONGODB_CONFIG.PASSWORD).toBeDefined();
  });
});
