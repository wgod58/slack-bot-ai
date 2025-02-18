import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import router from '../../src/routes/router.js'; // Adjust the path as necessary
import { checkHealth as checkRedisHealth } from '../../src/services/redisService.js';
import { initialSlackBot } from '../../src/services/slackService.js';

// Mock all services
jest.mock('../../src/services/slackService.js', () => ({
  initialSlackBot: jest.fn(() => ({
    client: {
      auth: {
        test: jest.fn().mockResolvedValue({ ok: true }),
      },
    },
  })),
}));

jest.mock('../../src/services/redisService.js', () => ({
  checkHealth: jest.fn(),
}));

jest.mock('../../src/services/pineconeService.js', () => ({
  pinecone: {},
}));

describe('Router', () => {
  let app;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(router);
  });

  describe('GET /health', () => {
    test('should return healthy status when all services are up', async () => {
      // Mock successful service checks
      checkRedisHealth.mockResolvedValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        services: {
          server: 'up',
          slack: 'connected',
          redis: 'connected',
          pinecone: 'connected',
        },
        uptime: expect.any(Number),
        memory: expect.any(Object),
      });
    });

    test('should return unhealthy status when a service is down', async () => {
      // Mock failed Redis check
      checkRedisHealth.mockResolvedValue(false);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        services: {
          server: 'up',
          slack: 'connected',
          redis: 'disconnected',
          pinecone: 'connected',
        },
        uptime: expect.any(Number),
        memory: expect.any(Object),
      });
    });

    test('should handle Slack connection failure', async () => {
      // Mock Slack auth test failure
      initialSlackBot.mockImplementationOnce(() => ({
        client: {
          auth: {
            test: jest.fn().mockRejectedValue(new Error('Slack connection failed')),
          },
        },
      }));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.services.slack).toBe('disconnected');
    });

    test('should handle Redis connection failure', async () => {
      // Mock Redis check failure
      checkRedisHealth.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'unhealthy',
        timestamp: expect.any(String),
        error: 'Redis connection failed',
      });
    });

    test('should handle complete service failure', async () => {
      // Mock all services failing
      initialSlackBot.mockImplementationOnce(() => {
        throw new Error('Slack initialization failed');
      });
      checkRedisHealth.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'unhealthy',
        timestamp: expect.any(String),
        error: expect.any(String),
      });
    });
  });

  describe('GET /up', () => {
    test('should return server up status', async () => {
      const response = await request(app).get('/up');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'server is up',
      });
    });
  });
});
