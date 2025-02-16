import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { OpenAI } from 'openai';

import { AI_CONFIG } from '../../src/constants/config.js';
import {
  createEmbedding,
  generateResponse,
  generateSummary,
} from '../../src/services/openaiService.js';

// Mock OpenAI class
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  const mockEmbedCreate = jest.fn();

  return {
    OpenAI: jest.fn(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      embeddings: {
        create: mockEmbedCreate,
      },
    })),
  };
});

describe('OpenAI Service', () => {
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = new OpenAI();
  });

  describe('generateSummary', () => {
    test('should generate summary successfully', async () => {
      const messages = ['Hello', 'How are you?'];
      const mockResponse = 'Summary of conversation';

      // Set up mock response with correct structure
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const summary = await generateSummary(messages);

      expect(summary).toBe(mockResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: AI_CONFIG.MODELS.CHAT,
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('Please summarize this conversation'),
          },
        ],
      });
    });

    test('should handle API errors in summary generation', async () => {
      const messages = ['Test message'];
      const mockError = new Error('API Error');

      // Properly reject the promise
      mockOpenAI.chat.completions.create.mockRejectedValue(mockError);

      await expect(generateSummary(messages)).rejects.toThrow('API Error');
    });
  });

  describe('generateResponse', () => {
    test('should generate response successfully', async () => {
      const question = 'What is Node.js?';
      const mockResponse = 'Node.js is a JavaScript runtime';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const response = await generateResponse(question);

      expect(response).toBe(mockResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: AI_CONFIG.MODELS.CHAT,
        messages: [
          {
            role: 'system',
            content: AI_CONFIG.SYSTEM_PROMPTS.DEFAULT,
          },
          {
            role: 'user',
            content: question,
          },
        ],
      });
    });

    test('should handle API errors in response generation', async () => {
      const question = 'Test question';
      const mockError = new Error('API Error');
      mockOpenAI.chat.completions.create.mockRejectedValue(mockError);

      await expect(generateResponse(question)).rejects.toThrow('API Error');
    });
  });

  describe('createEmbedding', () => {
    test('should create embedding successfully', async () => {
      const text = 'Sample text';
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const embedding = await createEmbedding(text);

      expect(embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: AI_CONFIG.MODELS.EMBEDDING,
        input: text,
      });
    });

    test('should handle API errors in embedding creation', async () => {
      const text = 'Test text';
      const mockError = new Error('API Error');
      mockOpenAI.embeddings.create.mockRejectedValue(mockError);

      await expect(createEmbedding(text)).rejects.toThrow('API Error');
    });
  });

  describe('Error Handling', () => {
    test('should include error details in console.error', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockError = {
        message: 'API Error',
        status: 429,
        type: 'rate_limit_error',
        name: 'OpenAIError',
      };

      mockOpenAI.chat.completions.create.mockRejectedValue(mockError);

      await expect(generateResponse('test')).rejects.toEqual(mockError);
      expect(consoleSpy).toHaveBeenCalledWith('OpenAI Error:', {
        message: mockError.message,
        status: mockError.status,
        type: mockError.type,
      });
      consoleSpy.mockRestore();
    });
  });
});
