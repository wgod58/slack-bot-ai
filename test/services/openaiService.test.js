import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { AI_CONFIG, RESPONSES } from '../../src/constants/config.js';
import {
  createEmbedding,
  generateResponse,
  generateSummary,
  openai,
} from '../../src/services/openaiService.js';
import { getEmbeddingFromDB } from '../../src/services/mongoService.js';
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

// Mock MongoDB service
jest.mock('../../src/services/mongoService.js', () => ({
  getEmbeddingFromDB: jest.fn(),
  storeEmbeddingInDB: jest.fn(),
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
      const mockResponse = {
        choices: [{ message: { content: 'mocked response' } }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const response = await generateResponse('test question');

      expect(response).toBe(mockResponse.choices[0].message.content);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: AI_CONFIG.MODELS.CHAT,
        messages: [
          {
            role: 'system',
            content: AI_CONFIG.SYSTEM_PROMPTS.GENERAL,
          },
          {
            content: 'test question',
            role: 'user',
          },
        ],
      });
    });

    test('should handle API errors in response generation', async () => {
      const mockError = new Error('API Error');
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(mockError);

      const result = await generateResponse('test question');
      expect(result).toBe(RESPONSES.QUESTION_ERROR);
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
    test('should handle DB embedding retrieval and caching', async () => {
      const text = 'test text';
      const dbEmbedding = [0.7, 0.8, 0.9];

      // Mock cache miss but DB hit
      getEmbeddingFromCache.mockResolvedValueOnce(null);
      getEmbeddingFromDB.mockResolvedValueOnce(dbEmbedding);

      const result = await createEmbedding(text);

      expect(result).toEqual(dbEmbedding);
      expect(getEmbeddingFromCache).toHaveBeenCalledWith(text);
      expect(getEmbeddingFromDB).toHaveBeenCalledWith(text);
      expect(storeEmbeddingInCache).toHaveBeenCalledWith(text, dbEmbedding);
      expect(openai.embeddings.create).not.toHaveBeenCalled();
    });

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
      const mockError = {
        message: 'API Error',
        status: 429,
        type: 'rate_limit_error',
      };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockOpenAI.chat.completions.create.mockRejectedValueOnce(mockError);

      const result = await generateResponse('test question');

      expect(consoleSpy).toHaveBeenCalledWith('OpenAI Error:', {
        message: mockError.message,
        status: mockError.status,
        type: mockError.type,
      });
      expect(result).toBe(RESPONSES.QUESTION_ERROR);
    });

    test('should handle missing response data', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{}],
      });

      const result = await generateResponse('test question');

      expect(consoleSpy).toHaveBeenCalledWith('OpenAI Error:', expect.any(Object));
      expect(result).toBe(RESPONSES.QUESTION_ERROR);
    });
  });
});
