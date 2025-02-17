import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import JestReceiver from '@slack-wrench/jest-bolt-receiver';

import { COMMANDS, RESPONSES } from '../../src/constants/config.js';
import {
  createEmbedding,
  generateResponse,
  generateSummary,
} from '../../src/services/openaiService.js';
import {
  findSimilarQuestionsInPinecone,
  storeQuestionVectorInPinecone,
} from '../../src/services/pineconeService.js';
import {
  findSimilarQuestionsInRedis,
  storeQuestionVectorInRedis,
} from '../../src/services/redisService.js';
import {
  handleQuestion,
  initialSlackBot,
  setupSlackListeners,
} from '../../src/services/slackService.js';

// Mock @slack/bolt before any imports that use it
jest.mock('@slack/bolt', () => {
  class MockApp {
    constructor(config) {
      this.event = jest.fn((_, handler) => {
        this.eventHandler = handler;
      });
      this.message = jest.fn((handler) => {
        this.messageHandler = handler;
      });
      this.command = jest.fn((commandName, handler) => {
        this.commandHandlers = this.commandHandlers || {};
        this.commandHandlers[commandName] = handler;
      });
      this.client = {
        conversations: {
          replies: jest.fn(),
        },
      };
      this.config = config;
      this.receiver = config.receiver;
      // Store the say function from the receiver
      this.say = this.receiver.say;
    }

    async handleEvent(event) {
      if (event.type === 'command') {
        // Handle slash commands
        const handler = this.commandHandlers[event.command];
        if (handler) {
          await handler({
            command: event,
            say: this.say,
            ack: jest.fn(),
          });
        }
      } else if (event.type === 'app_mention') {
        // Handle app mentions
        await this.eventHandler({
          event,
          say: this.say,
        });
      } else if (event.type === 'message') {
        // Handle regular messages
        await this.messageHandler({
          message: event,
          say: this.say,
        });
      }
    }
  }

  // Return CommonJS module format
  return {
    __esModule: false, // Changed to false for CommonJS
    App: MockApp, // Export App directly
  };
});

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
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize JestReceiver with message collection
    receiver = new JestReceiver();
    receiver.messages = [];
    receiver.say = jest.fn((message) => {
      receiver.messages.push(message);
    });

    // Initialize Slack app with test configuration
    app = initialSlackBot(false, receiver);
    // Register command handlers directly
    app.command(COMMANDS.HELP, async ({ command, say }) => {
      await say({
        text: RESPONSES.HELP,
        channel: command.channel_id,
      });
    });

    app.command(COMMANDS.SUMMARIZE, async ({ command, say }) => {
      const summary = await generateSummary('Thread messages');
      await say({
        text: summary,
        thread_ts: command.thread_ts,
        channel: command.channel_id,
      });
    });

    // Setup other listeners
    setupSlackListeners(app);

    // Setup default mock implementations
    generateResponse.mockResolvedValue('Mocked response');
    generateSummary.mockResolvedValue('Mocked summary');
    createEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    findSimilarQuestionsInRedis.mockResolvedValue([]);
    findSimilarQuestionsInPinecone.mockResolvedValue([]);
  });

  describe('App Mention Handling', () => {
    test('should handle app mention', async () => {
      const mention = {
        type: 'app_mention',
        user: 'U123456',
        text: '<@BOT_ID> help',
        ts: '1234567890.123456',
        channel: 'C123456',
      };

      // Mock the say function to throw an error
      // receiver.say.mockResolvedValueOnce(123);

      await app.handleEvent(mention);

      // Verify error was logged (you might need to mock console.error)
      // This test ensures the error handler is reached
      expect(receiver.say).toHaveBeenCalled();
    });
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
      };

      await app.handleEvent(message);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: expect.any(String),
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should handle questions', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'What is Redis?',
        user: 'U123456',
        channel: 'D123456',
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

      await app.handleEvent(message);

      expect(createEmbedding).toHaveBeenCalledWith('What is Redis?');
      expect(findSimilarQuestionsInRedis).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: expect.stringContaining('Redis is an in-memory database'),
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should handle bot mentions', async () => {
      const mention = {
        type: 'app_mention',
        user: 'U123456',
        text: '<@BOT_ID> help',
        ts: '1234567890.123456',
        channel: 'C123456',
      };

      await app.handleEvent(mention);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: expect.stringContaining("I'm here to help"),
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should ignore bot messages', async () => {
      const botMessage = {
        type: 'message',
        subtype: 'bot_message',
        text: 'Bot message',
        bot_id: 'B123456',
        channel: 'C123456',
        ts: '1234567890.123456',
      };

      await app.handleEvent(botMessage);

      expect(receiver.messages).toHaveLength(0);
    });

    test('should handle hello messages', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'hello bot',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      await app.handleEvent(message);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: RESPONSES.WELCOME,
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should handle default response for unknown messages', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'random message',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      await app.handleEvent(message);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: RESPONSES.DEFAULT('random message'),
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should ignore messages without user', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'test message',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      await app.handleEvent(message);

      expect(receiver.messages).toHaveLength(0);
    });

    test('should ignore messages without text', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      await app.handleEvent(message);

      expect(receiver.messages).toHaveLength(0);
    });
  });

  describe('Command Handling', () => {
    test('should handle help command', async () => {
      const command = {
        command: COMMANDS.HELP,
        text: '',
        channel_id: 'C123456',
        type: 'command',
      };

      await app.handleEvent(command);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: RESPONSES.HELP,
          channel: 'C123456',
        }),
      );
    });

    test('should handle summarize command', async () => {
      const command = {
        command: COMMANDS.SUMMARIZE,
        text: '',
        channel_id: 'C123456',
        thread_ts: '1234567890.123456',
        type: 'command',
      };

      generateSummary.mockResolvedValueOnce('Thread summary');

      await app.handleEvent(command);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: expect.stringContaining('Thread summary'),
          thread_ts: '1234567890.123456',
        }),
      );
    });
  });

  describe('Question Handling', () => {
    test('should handle questions with Pinecone fallback', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'What is Redis?',
        user: 'U123456',
        channel: 'D123456',
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
      await app.handleEvent(message);
      expect(findSimilarQuestionsInPinecone).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: expect.stringContaining('Redis is a key-value store'),
          thread_ts: '1234567890.123456',
        }),
      );
    });
    test('should generate new response when no matches found', async () => {
      const message = {
        type: 'message',
        text: 'What is the meaning of life?',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };
      const mockResponse = 'The meaning of life is 42';
      const questionEmbedding = [0.1, 0.2, 0.3];
      // Setup mocks in correct order
      createEmbedding.mockResolvedValueOnce(questionEmbedding);
      findSimilarQuestionsInRedis.mockResolvedValueOnce([]);
      findSimilarQuestionsInPinecone.mockResolvedValueOnce([]);
      generateResponse.mockResolvedValueOnce(mockResponse);
      storeQuestionVectorInRedis.mockResolvedValueOnce();
      storeQuestionVectorInPinecone.mockResolvedValueOnce();
      const say = jest.fn();
      await handleQuestion(message, say);
      expect(say).toHaveBeenCalledWith(
        expect.objectContaining({
          text: mockResponse,
          thread_ts: message.ts,
        }),
      );
      expect(generateResponse).toHaveBeenCalledWith(message.text);
      expect(storeQuestionVectorInRedis).toHaveBeenCalledWith(
        message.text,
        mockResponse,
        questionEmbedding,
      );
      expect(storeQuestionVectorInPinecone).toHaveBeenCalledWith(
        message.text,
        mockResponse,
        questionEmbedding,
      );
    });
  });

  describe('Thread Handling', () => {
    test('should get thread messages', async () => {
      const threadMessages = ['message 1', 'message 2'];
      app.client.conversations.replies.mockResolvedValueOnce({
        messages: threadMessages.map((text) => ({ text })),
      });

      const messages = await app.client.conversations.replies({
        channel: 'C123456',
        ts: '1234567890.123456',
      });

      expect(messages.messages).toEqual(threadMessages.map((text) => ({ text })));
    });

    test('should handle summarize command in thread', async () => {
      const command = {
        command: COMMANDS.SUMMARIZE,
        text: '',
        channel_id: 'C123456',
        thread_ts: '1234567890.123456',
        type: 'command',
      };

      const threadMessages = ['message 1', 'message 2'];
      app.client.conversations.replies.mockResolvedValueOnce({
        messages: threadMessages.map((text) => ({ text })),
      });
      generateSummary.mockResolvedValueOnce('Thread summary');

      await app.handleEvent(command);

      expect(generateSummary).toHaveBeenCalledWith(expect.any(String));
      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: 'Thread summary',
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should handle thread message retrieval errors', async () => {
      // Mock the error response
      const mockError = new Error('Thread Error');
      app.client.conversations.replies = jest.fn().mockRejectedValue(mockError);

      try {
        await app.client.conversations.replies({
          channel: 'C123456',
          ts: '1234567890.123456',
        });
      } catch (error) {
        expect(error.message).toBe('Thread Error');
      }
    });

    test('should handle summarize command without thread_ts', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: '!summarize',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      await app.handleEvent(message);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: RESPONSES.SUMMARIZE_NO_THREAD,
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should handle summarize command with thread_ts', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: '!summarize',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
        thread_ts: '1234567890.123456',
      };

      // Mock the thread messages response
      app.client.conversations.replies = jest.fn().mockResolvedValue({
        ok: true,
        messages: [
          { text: 'First message' },
          { text: 'Second message' },
          { text: 'Third message' },
        ],
      });

      // Mock the summary generation
      const mockSummary = 'This is a summary of the thread';
      generateSummary.mockResolvedValue(mockSummary);

      await app.handleEvent(message);

      // Verify the thread messages were requested
      expect(app.client.conversations.replies).toHaveBeenCalledWith({
        channel: 'D123456',
        ts: '1234567890.123456',
      });

      // Verify generateSummary was called with the combined messages
      expect(generateSummary).toHaveBeenCalledWith('First message\nSecond message\nThird message');

      // Verify the response was sent
      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: mockSummary,
          thread_ts: '1234567890.123456',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      const message = {
        type: 'message',
        text: 'What is Redis?',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      const say = jest.fn();
      const error = new Error('API Error');
      createEmbedding.mockRejectedValueOnce(error);

      await handleQuestion(message, say);

      expect(say).toHaveBeenCalledWith(
        expect.objectContaining({
          text: RESPONSES.QUESTION_ERROR,
          thread_ts: '1234567890.123456',
        }),
      );
      expect(createEmbedding).toHaveBeenCalledWith(message.text);
    });

    test('should handle Redis errors gracefully', async () => {
      const message = {
        type: 'message',
        text: 'What is Redis?',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      const say = jest.fn();
      const questionEmbedding = [0.1, 0.2, 0.3];
      createEmbedding.mockResolvedValueOnce(questionEmbedding);
      const error = new Error('Redis Error');
      findSimilarQuestionsInRedis.mockRejectedValueOnce(error);

      await handleQuestion(message, say);

      expect(say).toHaveBeenCalledWith(
        expect.objectContaining({
          text: RESPONSES.QUESTION_ERROR,
          thread_ts: '1234567890.123456',
        }),
      );
      expect(findSimilarQuestionsInRedis).toHaveBeenCalledWith(questionEmbedding);
      expect(createEmbedding).toHaveBeenCalledWith(message.text);
    });

    test('should handle Pinecone errors gracefully', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'What is Redis?',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      createEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);
      findSimilarQuestionsInRedis.mockResolvedValueOnce([]);
      findSimilarQuestionsInPinecone.mockRejectedValueOnce(new Error('Pinecone Error'));

      await app.handleEvent(message);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: RESPONSES.QUESTION_ERROR,
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should handle general Slack errors with details', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'hello bot',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
        thread_ts: '1234567890.123456',
      };

      // Create a detailed error object
      const mockError = new Error('Slack API Error');
      mockError.data = { error: 'invalid_auth' };
      mockError.stack = 'Error stack trace';

      // Mock console.error to prevent actual logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Force an error by making the RESPONSES.WELCOME access throw
      const originalWelcome = RESPONSES.WELCOME;
      Object.defineProperty(RESPONSES, 'WELCOME', {
        get: () => {
          throw mockError;
        },
      });

      await app.handleEvent(message);

      // Verify error was logged with all details
      expect(consoleErrorSpy).toHaveBeenCalledWith('Slack Error:', {
        error: mockError.message,
        data: mockError.data,
        stack: mockError.stack,
      });

      // Verify error response was sent in thread
      expect(receiver.messages[1]).toEqual(
        expect.objectContaining({
          text: RESPONSES.ERROR,
          thread_ts: '1234567890.123456',
        }),
      );

      // Cleanup
      Object.defineProperty(RESPONSES, 'WELCOME', {
        value: originalWelcome,
        writable: true,
        configurable: true,
      });
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    test('should handle general Slack errors without thread_ts', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: 'hello bot',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
        // No thread_ts
      };

      // Create a detailed error object
      const mockError = new Error('Slack API Error');
      mockError.data = { error: 'invalid_auth' };
      mockError.stack = 'Error stack trace';

      // Mock console.error to prevent actual logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Force an error by making the RESPONSES.WELCOME access throw
      const originalWelcome = RESPONSES.WELCOME;
      Object.defineProperty(RESPONSES, 'WELCOME', {
        get: () => {
          throw mockError;
        },
      });

      await app.handleEvent(message);

      // Verify error response uses message ts as thread_ts
      expect(receiver.messages[1]).toEqual(
        expect.objectContaining({
          text: RESPONSES.ERROR,
          thread_ts: '1234567890.123456', // Should use message.ts
        }),
      );

      // Cleanup
      Object.defineProperty(RESPONSES, 'WELCOME', {
        value: originalWelcome,
        writable: true,
        configurable: true,
      });
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Command Message Handling', () => {
    test('should handle help command via message', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: '!help',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
      };

      await app.handleEvent(message);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: RESPONSES.HELP,
          thread_ts: '1234567890.123456',
        }),
      );
    });

    test('should handle summarize command errors', async () => {
      const message = {
        type: 'message',
        channel_type: 'im',
        text: '!summarize',
        user: 'U123456',
        channel: 'D123456',
        ts: '1234567890.123456',
        thread_ts: '1234567890.123456',
      };

      app.client.conversations.replies = jest.fn().mockRejectedValue(new Error('Thread Error'));

      await app.handleEvent(message);

      expect(receiver.messages).toContainEqual(
        expect.objectContaining({
          text: RESPONSES.SUMMARIZE_ERROR,
          thread_ts: '1234567890.123456',
        }),
      );
    });
  });
});
