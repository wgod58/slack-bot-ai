import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';

import { App } from '../src/app.js';
import { SERVER_CONFIG } from '../src/constants/config.js';
import { createRedisVectorIndex } from '../src/services/redisService.js';
import { initialSlackBot, setupSlackListeners } from '../src/services/slackService.js';

let app;

// Mock express
jest.mock('express', () => {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockRes = { status: mockStatus, json: mockJson };
  const mockReq = {};

  const mockServer = {
    use: jest.fn(),
    get: jest.fn((path, handler) => {
      if (path === '/') {
        handler(mockReq, mockRes);
      }
    }),
    listen: jest.fn((port, cb) => cb()),
  };

  const mockExpress = jest.fn(() => mockServer);
  mockExpress.json = jest.fn();
  return mockExpress;
});

// Mock services
jest.mock('../src/services/redisService.js', () => ({
  createRedisVectorIndex: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/slackService.js', () => ({
  initialSlackBot: jest.fn(() => ({
    start: jest.fn().mockResolvedValue(undefined),
  })),
  setupSlackListeners: jest.fn().mockResolvedValue(undefined),
}));

// Mock router
jest.mock('../src/routes/router.js', () => ({
  __esModule: true,
  default: 'mockRouter',
}));

// Mock MongoDB
jest.mock('mongodb', () => {
  const mockCollection = {
    createIndex: jest.fn().mockResolvedValue(true),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };

  const mockClient = {
    db: jest.fn().mockReturnValue(mockDb),
    close: jest.fn(),
  };

  return {
    MongoClient: {
      connect: jest.fn().mockResolvedValue(mockClient),
    },
  };
});

describe('App', () => {
  let consoleSpy;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = new App();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Initialization', () => {
    test('should initialize express app with middleware', async () => {
      await app.initialize();

      expect(express.json).toHaveBeenCalled();
      expect(app.server.use).toHaveBeenCalledWith(express.json());
      expect(app.server.use).toHaveBeenCalledWith('/api', 'mockRouter');
    });

    test('should create vector index', async () => {
      await app.initialize();

      expect(createRedisVectorIndex).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Redis vector index created successfully');
    });

    test('should start Slack bot', async () => {
      const mockSlackBot = {
        start: jest.fn().mockResolvedValue(undefined),
      };
      initialSlackBot.mockReturnValueOnce(mockSlackBot);

      await app.initialize();

      expect(initialSlackBot).toHaveBeenCalled();
      expect(mockSlackBot.start).toHaveBeenCalled();
      expect(setupSlackListeners).toHaveBeenCalledWith(mockSlackBot);
    });

    test('should handle initialization errors', async () => {
      const mockError = new Error('Initialization failed');
      createRedisVectorIndex.mockRejectedValueOnce(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(app.initialize()).rejects.toThrow('Initialization failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error starting server:', mockError);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Server Start', () => {
    test('should start server on specified port', async () => {
      await app.initialize();
      await app.start();

      expect(app.server.listen).toHaveBeenCalledWith(
        SERVER_CONFIG.PORT || 3000,
        expect.any(Function),
      );
    });

    test('should handle server start errors', async () => {
      const mockError = new Error('Server start failed');
      app.server.listen = jest.fn((_, cb) => cb(mockError));

      const consoleErrorSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await app.initialize();
      await expect(app.start()).rejects.toThrow('Server start failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error starting server:', mockError);
      consoleErrorSpy.mockRestore();
    });
  });
});
