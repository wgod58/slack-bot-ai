import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { RESPONSES } from '../../src/constants/config.js';
import {
  createEmbedding,
  generateResponse,
  generateSummary,
} from '../../src/services/openaiService.js';
import { findSimilarQuestionsInPinecone } from '../../src/services/pineconeService.js';
import { findSimilarQuestionsInRedis } from '../../src/services/redisService.js';
import { handleMessage, handleQuestion } from '../../src/services/slackService.js';

// Mock all dependent services
jest.mock('../../src/services/openaiService.js', () => ({
  generateResponse: jest.fn(),
  generateSummary: jest.fn(),
  createEmbedding: jest.fn(),
}));

jest.mock('../../src/services/redisService.js', () => ({
  findSimilarQuestionsInRedis: jest.fn(),
  storeQuestionVectorInRedis: jest.fn(),
}));

jest.mock('../../src/services/pineconeService.js', () => ({
  findSimilarQuestionsInPinecone: jest.fn(),
  storeQuestionVectorInPinecone: jest.fn(),
}));

describe('Slack Bot Service', () => {
  let mockSay;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSay = jest.fn();

    // Setup default mock implementations
    generateResponse.mockResolvedValue('Mocked response');
    generateSummary.mockResolvedValue('Mocked summary');
    createEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    findSimilarQuestionsInRedis.mockResolvedValue([]);
    findSimilarQuestionsInPinecone.mockResolvedValue([]);
  });

  describe('Message Handling', () => {
    test('should handle direct messages', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'Hello bot',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
        subtype: undefined,
        thread_ts: undefined,
      };

      const context = {
        say: mockSay,
        message,
      };

      await handleMessage(context);

      expect(mockSay).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should ignore bot messages', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'Bot message',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
        subtype: 'bot_message',
        thread_ts: undefined,
      };

      const context = {
        say: mockSay,
        message,
      };

      await handleMessage(context);

      expect(mockSay).not.toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'What is Redis?',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
        subtype: undefined,
        thread_ts: undefined,
      };

      const context = {
        say: mockSay,
        message,
      };

      // Simulate an error in question handling
      generateResponse.mockRejectedValueOnce(new Error('Test error'));
      createEmbedding.mockRejectedValueOnce(new Error('Test error'));

      await handleMessage(context);

      expect(mockSay).toHaveBeenCalledWith(
        expect.objectContaining({
          text: RESPONSES.QUESTION_ERROR,
          thread_ts: '1234567890.123456',
        }),
      );
    });
  });

  describe('Question Handling', () => {
    test('should handle questions with Redis cache hit', async () => {
      const message = {
        text: 'What is Redis?',
        ts: '1234567890.123456',
      };

      const cachedResponse = [
        {
          text: 'Similar question',
          response: 'Redis is an in-memory database',
          score: 0.95,
        },
      ];

      createEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      findSimilarQuestionsInRedis.mockResolvedValueOnce(cachedResponse);

      await handleQuestion(message, mockSay);

      expect(createEmbedding).toHaveBeenCalledWith('What is Redis?');
      expect(findSimilarQuestionsInRedis).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
      expect(mockSay).toHaveBeenCalledWith({
        text: expect.stringContaining('Redis is an in-memory database'),
        thread_ts: '1234567890.123456',
      });
    });

    test('should handle questions with Pinecone hit', async () => {
      const message = {
        text: 'What is Redis?',
        ts: '1234567890.123456',
      };

      const pineconeResponse = [
        {
          question: 'Similar question',
          response: 'Redis is a key-value store',
          score: 0.95,
        },
      ];

      createEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      findSimilarQuestionsInRedis.mockResolvedValueOnce([]); // No Redis hits
      findSimilarQuestionsInPinecone.mockResolvedValueOnce(pineconeResponse);

      await handleQuestion(message, mockSay);

      expect(findSimilarQuestionsInPinecone).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
      expect(mockSay).toHaveBeenCalledWith({
        text: expect.stringContaining('Redis is a key-value store'),
        thread_ts: '1234567890.123456',
      });
    });

    // test('should generate new response when no matches found', async () => {
    //   const message = {
    //     text: 'What is Redis?',
    //     ts: '1234567890.123456',
    //   };

    //   // Mock all the necessary functions in the chain
    //   createEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
    //   findSimilarQuestionsInRedis.mockResolvedValueOnce([]);
    //   findSimilarQuestionsInPinecone.mockResolvedValueOnce([]);
    //   generateResponse.mockResolvedValueOnce('Redis is a database system');

    //   // Mock storage functions to resolve successfully
    //   jest
    //     .requireMock('../../src/services/redisService.js')
    //     .storeQuestionVectorInRedis.mockResolvedValueOnce();
    //   jest
    //     .requireMock('../../src/services/pineconeService.js')
    //     .storeQuestionVectorInPinecone.mockResolvedValueOnce();

    //   await handleQuestion(message, mockSay);

    //   // Verify the entire flow
    //   expect(createEmbedding).toHaveBeenCalledWith('What is Redis?');
    //   expect(findSimilarQuestionsInRedis).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
    //   expect(findSimilarQuestionsInPinecone).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
    //   expect(generateResponse).toHaveBeenCalledWith('What is Redis?');
    //   expect(mockSay).toHaveBeenCalledWith({
    //     text: 'Redis is a database system',
    //     thread_ts: '1234567890.123456',
    //   });
    // });

    test('should handle OpenAI errors gracefully', async () => {
      const message = {
        text: 'What is Redis?',
        ts: '1234567890.123456',
      };

      createEmbedding.mockRejectedValueOnce(new Error('OpenAI Error'));

      await handleQuestion(message, mockSay);

      expect(mockSay).toHaveBeenCalledWith({
        text: RESPONSES.QUESTION_ERROR,
        thread_ts: '1234567890.123456',
      });
    });

    test('should handle Redis/Pinecone errors gracefully', async () => {
      const message = {
        text: 'What is Redis?',
        ts: '1234567890.123456',
      };

      createEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      findSimilarQuestionsInRedis.mockRejectedValueOnce(new Error('Redis Error'));

      await handleQuestion(message, mockSay);

      expect(mockSay).toHaveBeenCalledWith({
        text: RESPONSES.QUESTION_ERROR,
        thread_ts: '1234567890.123456',
      });
    });
  });
});
