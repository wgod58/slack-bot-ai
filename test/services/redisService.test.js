import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  checkHealth,
  createRedisVectorIndex,
  findSimilarQuestionsInRedis,
  redisClient,
  storeQuestionVectorInRedis,
} from '../../src/services/redisService.js';

// Mock Redis with ioredis-mock
// jest.setup.js or your test setup file
jest.mock('ioredis', () => require('ioredis-mock'));

describe('Redis Service', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear Redis mock data
    redisClient.call = jest.fn();
    redisClient.ping = jest.fn();
    redisClient.keys = jest.fn();
    redisClient.get = jest.fn();
  });

  describe('createRedisVectorIndex', () => {
    test('should create vector index successfully', async () => {
      redisClient.call.mockResolvedValueOnce('OK');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await createRedisVectorIndex();

      expect(redisClient.call).toHaveBeenCalledWith(
        'FT.CREATE',
        'idx:questions',
        'ON',
        'JSON',
        'PREFIX',
        '1',
        'question:',
        'SCHEMA',
        '$.vector',
        'AS',
        'vector',
        'VECTOR',
        'FLAT',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        '1536',
        'DISTANCE_METRIC',
        'COSINE',
        '$.text',
        'AS',
        'text',
        'TEXT',
        '$.response',
        'AS',
        'response',
        'TEXT',
      );

      consoleSpy.mockRestore();
    });

    test('should handle index creation errors', async () => {
      const mockError = new Error('Index creation failed');
      redisClient.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(createRedisVectorIndex()).rejects.toThrow('Index creation failed');
      expect(consoleSpy).toHaveBeenCalledWith('Error creating vector index:', mockError);

      consoleSpy.mockRestore();
    });

    test('should handle existing index gracefully', async () => {
      const mockError = new Error('Index already exists');
      redisClient.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await createRedisVectorIndex();

      expect(consoleSpy).toHaveBeenCalledWith('Index already exists');
      consoleSpy.mockRestore();
    });
  });

  describe('checkHealth', () => {
    test('should return true when Redis is healthy', async () => {
      redisClient.ping.mockResolvedValueOnce('PONG');
      const isHealthy = await checkHealth();
      expect(isHealthy).toBe(true);
    });

    test('should return false when Redis is unhealthy', async () => {
      // Simulate Redis disconnection
      await redisClient.disconnect();
      const isHealthy = await checkHealth();
      expect(isHealthy).toBe(false);
    });

    test('should handle Redis connection errors', async () => {
      const mockError = new Error('Redis connection failed');
      redisClient.ping.mockRejectedValueOnce(mockError);

      const isHealthy = await checkHealth();
      expect(isHealthy).toBe(false);
    });
  });

  describe('storeQuestionVectorInRedis', () => {
    test('should store question and vector successfully', async () => {
      const question = 'What is Redis?';
      const response = 'Redis is an in-memory database';
      const vector = [0.1, 0.2, 0.3];

      redisClient.call.mockResolvedValueOnce('OK');
      redisClient.keys.mockResolvedValueOnce(['question:1234567890']);
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify({
          text: question,
          response,
          vector,
        }),
      );

      await storeQuestionVectorInRedis(question, response, vector);

      expect(redisClient.call).toHaveBeenCalledWith(
        'JSON.SET',
        expect.stringContaining('question:'),
        '$',
        expect.any(String),
      );
    });

    test('should handle storage errors', async () => {
      const mockError = new Error('Storage failed');
      redisClient.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const question = 'What is Redis?';
      const response = 'Redis is an in-memory database';
      const vector = [0.1, 0.2, 0.3];

      await expect(storeQuestionVectorInRedis(question, response, vector)).rejects.toThrow(
        'Storage failed',
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error storing redis question vector:', mockError);
      consoleSpy.mockRestore();
    });

    test('should validate input parameters', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(storeQuestionVectorInRedis()).rejects.toThrow();
      await expect(storeQuestionVectorInRedis('test')).rejects.toThrow();
      await expect(storeQuestionVectorInRedis('test', 'response')).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('findSimilarQuestionsInRedis', () => {
    test('should find similar questions successfully', async () => {
      redisClient.call.mockResolvedValueOnce([
        1,
        'question:1',
        ['text', 'What is Redis?', 'response', 'Redis is a database', 'vector_score', '0.05'],
      ]);

      const results = await findSimilarQuestionsInRedis([0.1, 0.2, 0.3]);
      expect(results).toEqual([
        {
          id: 'question:1',
          text: 'What is Redis?',
          response: 'Redis is a database',
          score: 0.95,
        },
      ]);
    });

    test('should handle empty results', async () => {
      redisClient.call.mockResolvedValueOnce([0]);
      const results = await findSimilarQuestionsInRedis([0.1, 0.2, 0.3]);
      expect(results).toEqual([]);
    });

    test('should handle search errors', async () => {
      const mockError = new Error('Search failed');
      redisClient.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(findSimilarQuestionsInRedis([0.1, 0.2, 0.3])).rejects.toThrow('Search failed');

      expect(consoleSpy).toBeCalled();
      consoleSpy.mockRestore();
    });

    test('should handle malformed search results', async () => {
      // Mock malformed results
      redisClient.call.mockResolvedValueOnce([
        1,
        'question:1',
        null, // Invalid fields array
      ]);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await findSimilarQuestionsInRedis([0.1, 0.2, 0.3]);

      expect(results).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unexpected field structure for document:',
        'question:1',
      );
      consoleSpy.mockRestore();
    });
  });
});
