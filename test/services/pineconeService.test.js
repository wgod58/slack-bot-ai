import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  findSimilarQuestionsInPinecone,
  storeQuestionVectorInPinecone,
} from '../../src/services/pineconeService.js';

// Create mock functions
const mockUpsert = jest.fn();
const mockQuery = jest.fn();

// Mock Pinecone
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn(() => ({
    Index: jest.fn(() => ({
      upsert: mockUpsert,
      query: mockQuery,
    })),
  })),
}));

describe('Pinecone Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockUpsert.mockReset();
    mockQuery.mockReset();
  });

  describe('storeQuestionVectorInPinecone', () => {
    test('should store a question vector with correct metadata', async () => {
      mockUpsert.mockResolvedValueOnce({});

      const mockQuestion = 'What is Redis?';
      const mockResponse = 'Redis is an in-memory database.';
      const mockEmbedding = [0.1, 0.2, 0.3];

      await storeQuestionVectorInPinecone(mockQuestion, mockResponse, mockEmbedding);

      expect(mockUpsert).toHaveBeenCalledWith([
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
      mockUpsert.mockRejectedValueOnce(mockError);

      await expect(
        storeQuestionVectorInPinecone('test', 'response', [0.1, 0.2, 0.3]),
      ).rejects.toThrow('Storage failed');
    });

    test('should validate input parameters', async () => {
      mockUpsert.mockRejectedValue(new Error('Invalid parameters'));

      await expect(storeQuestionVectorInPinecone()).rejects.toThrow();
      await expect(storeQuestionVectorInPinecone('test')).rejects.toThrow();
      await expect(storeQuestionVectorInPinecone('test', 'response')).rejects.toThrow();
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

      mockQuery.mockResolvedValueOnce(mockResults);

      const results = await findSimilarQuestionsInPinecone(mockEmbedding, 5);

      expect(results).toEqual([
        {
          question: 'How does Redis work?',
          response: 'Redis stores data in-memory.',
          score: 0.95,
        },
      ]);

      expect(mockQuery).toHaveBeenCalledWith({
        vector: mockEmbedding,
        topK: 5,
        includeMetadata: true,
      });
    });

    test('should handle empty results', async () => {
      mockQuery.mockResolvedValueOnce({ matches: [] });
      const results = await findSimilarQuestionsInPinecone([0.1, 0.2, 0.3]);
      expect(results).toEqual([]);
    });

    test('should handle query errors', async () => {
      const mockError = new Error('Query failed');
      mockQuery.mockRejectedValueOnce(mockError);

      await expect(findSimilarQuestionsInPinecone([0.1, 0.2, 0.3])).rejects.toThrow('Query failed');
    });

    test('should handle invalid metadata in results', async () => {
      mockQuery.mockResolvedValueOnce({
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
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Test error');
      mockQuery.mockRejectedValueOnce(mockError);

      await expect(findSimilarQuestionsInPinecone([0.1, 0.2, 0.3])).rejects.toThrow('Test error');
      expect(consoleSpy).toHaveBeenCalledWith('Error querying Pinecone:', mockError);
      consoleSpy.mockRestore();
    });
  });
});
