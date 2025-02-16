import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock Pinecone BEFORE Importing the Service
const mockIndexInstance = {
  query: jest.fn().mockResolvedValue({ matches: [] }),
  upsert: jest.fn().mockResolvedValue({}),
};

const mockPineconeInstance = {
  Index: jest.fn(() => mockIndexInstance),
};

// Properly mock the Pinecone class
jest.mock('@pinecone-database/pinecone', () => {
  return {
    Pinecone: jest.fn(() => mockPineconeInstance),
  };
});

import {
  findSimilarQuestionsInPinecone,
  initIndex,
  storeQuestionVectorInPinecone,
} from '../../src/services/pineconeService.js';
import { Pinecone } from '@pinecone-database/pinecone';

describe('sum module', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Reset all mocks before each test
  });

  // Test: Initialize Pinecone Index
  test('should initialize Pinecone index successfully', async () => {
    const index = await initIndex();

    expect(index).toBeDefined();
    expect(mockPineconeInstance.Index).toHaveBeenCalled();
  });

  // Test: Store a question & response in Pinecone
  test('should store a question vector in Pinecone', async () => {
    const mockQuestion = 'What is Redis?';
    const mockResponse = 'Redis is an in-memory database.';
    const mockEmbedding = [0.1, 0.2, 0.3];

    await storeQuestionVectorInPinecone(mockQuestion, mockResponse, mockEmbedding);

    expect(mockIndexInstance.upsert).toHaveBeenCalledWith([
      {
        id: expect.stringMatching(/^qa_\d+$/), // Matches dynamic timestamp ID
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

  // Test: Find Similar Questions in Pinecone
  test('should retrieve similar questions from Pinecone', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3];
    const mockResults = {
      matches: [
        {
          metadata: { question: 'How does Redis work?', response: 'Redis stores data in-memory.' },
          score: 0.95,
        },
      ],
    };

    mockIndexInstance.query.mockResolvedValue(mockResults);

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
});
