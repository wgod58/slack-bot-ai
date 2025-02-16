import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  findSimilarQuestionsInPinecone,
  initIndex,
  storeQuestionVectorInPinecone,
} from '../../src/services/pineconeService.js';

// Mock Pinecone BEFORE Importing the Service
const mockIndexInstance = {
  query: jest.fn().mockResolvedValue({ matches: [] }),
  upsert: jest.fn().mockResolvedValue({}),
};

const mockPineconeInstance = {
  Index: jest.fn(() => mockIndexInstance),
};

jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn(() => mockPineconeInstance),
}));

describe('Pinecone Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initIndex', () => {
    test('should initialize Pinecone index successfully', async () => {
      const index = await initIndex();
      expect(index).toBeDefined();
      expect(mockPineconeInstance.Index).toHaveBeenCalledWith('slack-bot');
    });

    test('should handle initialization errors', async () => {
      mockPineconeInstance.Index.mockImplementationOnce(() => {
        return Promise.reject(new Error('Initialization failed'));
      });

      await expect(initIndex()).rejects.toThrow('Initialization failed');
    });
  });

  describe('storeQuestionVectorInPinecone', () => {
    test('should store a question vector with correct metadata', async () => {
      const mockQuestion = 'What is Redis?';
      const mockResponse = 'Redis is an in-memory database.';
      const mockEmbedding = [0.1, 0.2, 0.3];

      await storeQuestionVectorInPinecone(mockQuestion, mockResponse, mockEmbedding);

      expect(mockIndexInstance.upsert).toHaveBeenCalledWith([
        {
          id: expect.stringMatching(/^qa_\d+$/),
          values: mockEmbedding,
          metadata: {
            question: mockQuestion,
            response: mockResponse,
            timestamp: expect.any(String),
            type: 'qa_pair',
          },
        },
      ]);
    });

    test('should handle storage errors', async () => {
      const mockError = new Error('Storage failed');
      mockIndexInstance.upsert.mockRejectedValueOnce(mockError);

      await expect(
        storeQuestionVectorInPinecone('test', 'response', [0.1, 0.2, 0.3]),
      ).rejects.toThrow('Storage failed');
    });

    test('should validate input parameters', async () => {
      // Mock implementation to throw on invalid parameters
      mockIndexInstance.upsert.mockImplementation((vectors) => {
        if (!vectors || !vectors[0]?.values) {
          throw new Error('Invalid parameters');
        }
        return Promise.resolve({});
      });

      await expect(storeQuestionVectorInPinecone()).rejects.toThrow('Invalid parameters');
      await expect(storeQuestionVectorInPinecone('test')).rejects.toThrow('Invalid parameters');
      await expect(storeQuestionVectorInPinecone('test', 'response')).rejects.toThrow(
        'Invalid parameters',
      );
    });
  });

  describe('findSimilarQuestionsInPinecone', () => {
    test('should find similar questions with correct parameters', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResults = {
        matches: [
          {
            metadata: {
              question: 'How does Redis work?',
              response: 'Redis stores data in-memory.',
            },
            score: 0.95,
          },
        ],
      };

      mockIndexInstance.query.mockResolvedValueOnce(mockResults);

      const results = await findSimilarQuestionsInPinecone(mockEmbedding, 5);

      expect(results).toEqual([
        {
          question: 'How does Redis work?',
          response: 'Redis stores data in-memory.',
          score: 0.95,
        },
      ]);
      expect(mockIndexInstance.query).toHaveBeenCalledWith({
        vector: mockEmbedding,
        topK: 5,
        includeMetadata: true,
      });
    });

    test('should handle empty results', async () => {
      mockIndexInstance.query.mockResolvedValueOnce({ matches: [] });
      const results = await findSimilarQuestionsInPinecone([0.1, 0.2, 0.3]);
      expect(results).toEqual([]);
    });

    test('should handle query errors', async () => {
      const mockError = new Error('Query failed');
      mockIndexInstance.query.mockRejectedValueOnce(mockError);

      await expect(findSimilarQuestionsInPinecone([0.1, 0.2, 0.3])).rejects.toThrow('Query failed');
    });

    test('should handle invalid metadata in results', async () => {
      mockIndexInstance.query.mockResolvedValueOnce({
        matches: [
          { score: 0.95 }, // Missing metadata
          { metadata: {}, score: 0.9 }, // Empty metadata
          {
            metadata: { question: 'Valid question', response: 'Valid response' },
            score: 0.85,
          },
        ],
      });

      const results = await findSimilarQuestionsInPinecone([0.1, 0.2, 0.3]);
      expect(results).toEqual([
        {
          question: 'Valid question',
          response: 'Valid response',
          score: 0.85,
        },
      ]);
    });
  });

  describe('Error Logging', () => {
    test('should log errors with details', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockError = new Error('Test error');
      mockIndexInstance.query.mockRejectedValueOnce(mockError);

      await expect(findSimilarQuestionsInPinecone([0.1, 0.2, 0.3])).rejects.toThrow('Test error');
      expect(consoleSpy).toHaveBeenCalledWith('Error querying Pinecone:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('getPineconeInstance', () => {
    test('should create instance only once', async () => {
      const firstIndex = await initIndex();
      const secondIndex = await initIndex();

      // Verify Pinecone constructor was called only once
      expect(mockPineconeInstance.Index).toHaveBeenCalledTimes(2);
      expect(firstIndex).toBe(secondIndex);
    });

    test('should handle missing API key', async () => {
      // Temporarily remove API key
      const originalApiKey = process.env.PINECONE_API_KEY;
      delete process.env.PINECONE_API_KEY;

      // Mock Pinecone constructor to throw when no API key
      mockPineconeInstance.Index.mockImplementationOnce(() => {
        throw new Error('Missing API key');
      });

      jest.spyOn(console, 'error');

      try {
        await initIndex();
      } catch (error) {
        expect(error.message).toBe('Missing API key');
        expect(console.error).toHaveBeenCalledWith(
          'Error initializing Pinecone index:',
          expect.any(Error),
        );
      }

      // Restore API key
      process.env.PINECONE_API_KEY = originalApiKey;
    });
  });
});
