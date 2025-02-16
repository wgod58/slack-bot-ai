import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { App } from '@slack/bolt';
import JestReceiver from '@slack-wrench/jest-bolt-receiver';

import { RESPONSES } from '../../src/constants/config.js';
import {
  createEmbedding,
  generateResponse,
  generateSummary,
} from '../../src/services/openaiService.js';
import { findSimilarQuestionsInPinecone } from '../../src/services/pineconeService.js';
import { findSimilarQuestionsInRedis } from '../../src/services/redisService.js';
import { handleMessage } from '../../src/services/slackService.js';

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
  let receiver;
  let mockSay;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSay = jest.fn();
    receiver = new JestReceiver();

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

  // describe('Question Handling', () => {
  //   test('should handle questions with Redis cache hit', async () => {
  //     const cachedResponse = [{ text: 'Similar question', response: 'Cached answer', score: 0.95 }];
  //     findSimilarQuestionsInRedis.mockResolvedValueOnce(cachedResponse);

  //     const message = {
  //       text: 'What is Redis?',
  //       channel: 'C123456',
  //       ts: '1234567890.123456',
  //     };

  //     await handleQuestion(message, mockPostMessage);

  //     expect(createEmbedding).toHaveBeenCalledWith('What is Redis?');
  //     expect(findSimilarQuestionsInRedis).toHaveBeenCalled();
  //     expect(mockPostMessage).toHaveBeenCalledWith(
  //       expect.objectContaining({
  //         text: expect.stringContaining('Cached answer'),
  //       }),
  //     );
  //   });

  //   test('should handle questions with Pinecone hit', async () => {
  //     findSimilarQuestionsInRedis.mockResolvedValueOnce([]);
  //     const pineconeResponse = [
  //       { question: 'Similar question', response: 'Pinecone answer', score: 0.95 },
  //     ];
  //     findSimilarQuestionsInPinecone.mockResolvedValueOnce(pineconeResponse);

  //     const message = {
  //       text: 'What is Redis?',
  //       channel: 'C123456',
  //       ts: '1234567890.123456',
  //     };

  //     await handleQuestion(message, mockPostMessage);

  //     expect(findSimilarQuestionsInPinecone).toHaveBeenCalled();
  //     expect(mockPostMessage).toHaveBeenCalledWith(
  //       expect.objectContaining({
  //         text: expect.stringContaining('Pinecone answer'),
  //       }),
  //     );
  //   });

  //   test('should generate new response when no matches found', async () => {
  //     findSimilarQuestionsInRedis.mockResolvedValueOnce([]);
  //     findSimilarQuestionsInPinecone.mockResolvedValueOnce([]);
  //     generateResponse.mockResolvedValueOnce('New AI response');

  //     const message = {
  //       text: 'What is Redis?',
  //       channel: 'C123456',
  //       ts: '1234567890.123456',
  //     };

  //     await handleQuestion(message, mockPostMessage);

  //     expect(generateResponse).toHaveBeenCalled();
  //     expect(storeQuestionVectorInRedis).toHaveBeenCalled();
  //     expect(storeQuestionVectorInPinecone).toHaveBeenCalled();
  //     expect(mockPostMessage).toHaveBeenCalledWith(
  //       expect.objectContaining({
  //         text: 'New AI response',
  //       }),
  //     );
  //   });
  // });

  // describe('Error Handling', () => {
  //   test('should handle OpenAI errors gracefully', async () => {
  //     generateResponse.mockRejectedValueOnce(new Error('OpenAI Error'));

  //     const message = {
  //       text: 'What is Redis?',
  //       channel: 'C123456',
  //       ts: '1234567890.123456',
  //     };

  //     await handleQuestion(message, mockPostMessage);

  //     expect(mockPostMessage).toHaveBeenCalledWith(
  //       expect.objectContaining({
  //         text: RESPONSES.QUESTION_ERROR,
  //       }),
  //     );
  //   });

  //   test('should handle Redis errors gracefully', async () => {
  //     findSimilarQuestionsInRedis.mockRejectedValueOnce(new Error('Redis Error'));

  //     const message = {
  //       text: 'What is Redis?',
  //       channel: 'C123456',
  //       ts: '1234567890.123456',
  //     };

  //     await handleQuestion(message, mockPostMessage);

  //     expect(mockPostMessage).toHaveBeenCalledWith(
  //       expect.objectContaining({
  //         text: RESPONSES.QUESTION_ERROR,
  //       }),
  //     );
  //   });
  // });
});
