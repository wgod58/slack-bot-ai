import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  AI_CONFIG,
  COMMANDS,
  PINECONE_CONFIG,
  REDIS_CONFIG,
  RESPONSES,
  SERVER_CONFIG,
  SLACK_CONFIG,
} from '../../src/constants/config.js';

describe('Config Constants', () => {
  describe('AI_CONFIG', () => {
    test('should have correct model configurations', () => {
      expect(AI_CONFIG.MODELS).toEqual({
        CHAT: 'gpt-4-turbo',
        EMBEDDING: 'text-embedding-3-small',
      });
    });

    test('should have system prompts', () => {
      expect(AI_CONFIG.SYSTEM_PROMPTS.DEFAULT).toContain('senior Site Reliability Engineer');
    });

    test('should use environment variable for API key', () => {
      expect(AI_CONFIG.OPENAI_API_KEY).toBe(process.env.OPENAI_API_KEY);
    });
  });

  describe('COMMANDS', () => {
    test('should have correct command strings', () => {
      expect(COMMANDS).toEqual({
        SUMMARIZE: '!summarize',
        HELP: '!help',
      });
    });
  });

  describe('RESPONSES', () => {
    test('should have welcome message', () => {
      expect(RESPONSES.WELCOME).toContain('👋 Hello!');
    });

    test('should have help message', () => {
      expect(RESPONSES.HELP).toContain('Available commands:');
    });

    test('should have error messages', () => {
      expect(RESPONSES.ERROR).toBeDefined();
      expect(RESPONSES.QUESTION_ERROR).toBeDefined();
    });

    test('should have dynamic default response', () => {
      const message = 'test message';
      expect(RESPONSES.DEFAULT(message)).toContain(message);
    });

    test('should handle similar questions responses', () => {
      expect(RESPONSES.NO_SIMILAR).toBeDefined();

      const mockQuestions = [
        { question: 'Q1', response: 'A1' },
        { question: 'Q2', response: 'A2' },
      ];
      const formattedResponse = RESPONSES.SIMILAR_QUESTIONS(mockQuestions);
      expect(formattedResponse).toContain('Q1');
      expect(formattedResponse).toContain('A1');
      expect(formattedResponse).toContain('Q2');
      expect(formattedResponse).toContain('A2');
    });
  });

  describe('SLACK_CONFIG', () => {
    test('should use environment variables', () => {
      expect(SLACK_CONFIG).toEqual({
        BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
        SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
        APP_TOKEN: process.env.SLACK_APP_TOKEN,
      });
    });
  });

  describe('PINECONE_CONFIG', () => {
    test('should use environment variable for API key', () => {
      expect(PINECONE_CONFIG.API_KEY).toBe(process.env.PINECONE_API_KEY);
    });
  });

  describe('SERVER_CONFIG', () => {
    test('should use environment variable or default port', () => {
      expect(SERVER_CONFIG.PORT).toBe(process.env.PORT || 3000);
    });
  });

  describe('REDIS_CONFIG', () => {
    test('should have correct Redis configuration', () => {
      expect(REDIS_CONFIG).toEqual({
        HOST: process.env.REDIS_HOST || 'localhost',
        USERNAME: process.env.REDIS_USERNAME,
        PASSWORD: process.env.REDIS_PASSWORD,
        PORT: process.env.REDIS_PORT,
        PREFIXES: {
          EMBEDDING: 'embedding:',
        },
      });
    });

    test('should handle missing environment variables', () => {
      expect(REDIS_CONFIG.HOST).toBeDefined();
      expect(typeof REDIS_CONFIG.HOST).toBe('string');
    });
  });

  describe('Environment Variables', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    test('should handle missing environment variables', () => {
      delete process.env.PORT;
      delete process.env.REDIS_HOST;

      // Re-import to test defaults
      const { SERVER_CONFIG, REDIS_CONFIG } = require('../../src/constants/config.js');

      expect(SERVER_CONFIG.PORT).toBe(3000);
      expect(REDIS_CONFIG.HOST).toBe('localhost');
    });

    afterAll(() => {
      process.env = originalEnv;
    });
  });
});
