import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { AI_CONFIG } from '../../src/constants/config.js';
import {
  createEmbedding,
  generateResponse,
  generateSummary,
  openai,
} from '../../src/services/openaiService.js';
import { getEmbeddingFromCache, storeEmbeddingInCache } from '../../src/services/redisService.js';

// Mock OpenAI class
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  const mockEmbedCreate = jest.fn();

  return {
    OpenAI: jest.fn().mockImplementation(() => ({
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

// Mock Redis service
jest.mock('../../src/services/redisService.js', () => ({
  getEmbeddingFromCache: jest.fn(),
  storeEmbeddingInCache: jest.fn(),
}));

describe('OpenAI Service', () => {
  const mockOpenAI = openai;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('Embedding Caching', () => {
    test('should use cached embedding when available', async () => {
      const text = 'test text';
      const cachedEmbedding = [0.1, 0.2, 0.3];

      getEmbeddingFromCache.mockResolvedValueOnce(cachedEmbedding);

      const result = await createEmbedding(text);

      expect(result).toEqual(cachedEmbedding);
      expect(getEmbeddingFromCache).toHaveBeenCalledWith(text);
      expect(openai.embeddings.create).not.toHaveBeenCalled();
    });

    test('should generate and cache new embedding when not in cache', async () => {
      const text = 'test text';
      const newEmbedding = [0.4, 0.5, 0.6];

      getEmbeddingFromCache.mockResolvedValueOnce(null);
      openai.embeddings.create.mockResolvedValueOnce({
        data: [{ embedding: newEmbedding }],
      });

      const result = await createEmbedding(text);

      expect(result).toEqual(newEmbedding);
      expect(getEmbeddingFromCache).toHaveBeenCalledWith(text);
      expect(storeEmbeddingInCache).toHaveBeenCalledWith(text, newEmbedding);
      expect(openai.embeddings.create).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should include error details in console.log', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
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
