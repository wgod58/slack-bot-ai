import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  checkHealth,
  configureRedis,
  createVectorIndex,
  findSimilarQuestionsInRedis,
  redisClient,
  storeQuestionVectorInRedis,
} from '../../src/services/redisService.js';

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = {
    ping: jest.fn(),
    call: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    keys: jest.fn(),
    get: jest.fn(),
  };

  return jest.fn().mockImplementation((...args) => {
    console.log('args', args);
    return mockRedis;
  });
});

describe('Redis Service', () => {
  const mockRedis = redisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // mockRedis = new Redis();
  });

  describe('configureRedis', () => {
    test('should configure Redis settings successfully', async () => {
      mockRedis.call
        .mockResolvedValueOnce('OK')
        .mockResolvedValueOnce('OK')
        .mockResolvedValueOnce('OK');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await configureRedis();

      expect(mockRedis.call).toHaveBeenCalledWith('CONFIG', 'SET', 'maxmemory', '500mb');
      expect(mockRedis.call).toHaveBeenCalledWith(
        'CONFIG',
        'SET',
        'maxmemory-policy',
        'allkeys-lfu',
      );
      expect(mockRedis.call).toHaveBeenCalledWith('CONFIG', 'SET', 'maxmemory-samples', '10');
      expect(consoleSpy).toHaveBeenCalledWith('Redis configured successfully.');

      consoleSpy.mockRestore();
    });

    test('should handle configuration errors', async () => {
      const mockError = new Error('Configuration failed');
      console.log('mockRedis', mockRedis);
      console.log('mockRedis.call', mockRedis.call);
      mockRedis.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(configureRedis()).rejects.toThrow('Configuration failed');
      expect(consoleSpy).toHaveBeenCalledWith('Error configuring Redis:', mockError);

      consoleSpy.mockRestore();
    });
  });

  describe('createVectorIndex', () => {
    test('should create vector index successfully', async () => {
      mockRedis.call.mockResolvedValueOnce('OK');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await createVectorIndex();

      expect(mockRedis.call).toHaveBeenCalledWith(
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
      mockRedis.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createVectorIndex()).rejects.toThrow('Index creation failed');
      expect(consoleSpy).toHaveBeenCalledWith('Error creating vector index:', mockError);

      consoleSpy.mockRestore();
    });
  });

  describe('checkHealth', () => {
    test('should return true when Redis is healthy', async () => {
      mockRedis.ping.mockResolvedValueOnce('PONG');
      const isHealthy = await checkHealth();
      console.log('isHealthy', isHealthy);
      expect(isHealthy).toBe(true);
    });

    test('should return false when Redis is unhealthy', async () => {
      // Simulate Redis disconnection
      await mockRedis.disconnect();
      const isHealthy = await checkHealth();
      expect(isHealthy).toBe(false);
    });
  });

  describe('storeQuestionVectorInRedis', () => {
    test('should store question and vector successfully', async () => {
      const question = 'What is Redis?';
      const response = 'Redis is an in-memory database';
      const vector = [0.1, 0.2, 0.3];

      mockRedis.call.mockResolvedValueOnce('OK');
      mockRedis.keys.mockResolvedValueOnce(['question:1234567890']);
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          text: question,
          response,
          vector,
        }),
      );

      await storeQuestionVectorInRedis(question, response, vector);

      expect(mockRedis.call).toHaveBeenCalledWith(
        'JSON.SET',
        expect.stringContaining('question:'),
        '$',
        expect.any(String),
      );
    });

    test('should handle storage errors', async () => {
      const mockError = new Error('Storage failed');
      mockRedis.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const question = 'What is Redis?';
      const response = 'Redis is an in-memory database';
      const vector = [0.1, 0.2, 0.3];

      await expect(storeQuestionVectorInRedis(question, response, vector)).rejects.toThrow(
        'Storage failed',
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error storing question vector:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('findSimilarQuestionsInRedis', () => {
    test('should find similar questions successfully', async () => {
      mockRedis.call.mockResolvedValueOnce([
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
      mockRedis.call.mockResolvedValueOnce([0]);
      const results = await findSimilarQuestionsInRedis([0.1, 0.2, 0.3]);
      expect(results).toEqual([]);
    });

    test('should handle search errors', async () => {
      const mockError = new Error('Search failed');
      mockRedis.call.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(findSimilarQuestionsInRedis([0.1, 0.2, 0.3])).rejects.toThrow('Search failed');

      expect(consoleSpy).toBeCalled();
      consoleSpy.mockRestore();
    });
  });
});
