import express from 'express';

import { checkHealth as checkRedisHealth } from '../services/redisService.js';
import { slackBot } from '../services/slackService.js';
import { initIndex } from '../services/pineconeService.js';

const router = express.Router();

router.get('/health', async (_, res) => {
  try {
    // Check Slack connection
    const slackStatus = await slackBot.client.auth.test().catch(() => null);
    // Check Redis connection
    const pineconeStatus = await initIndex();
    const redisStatus = await checkRedisHealth();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        server: 'up',
        slack: slackStatus ? 'connected' : 'disconnected',
        redis: redisStatus ? 'connected' : 'disconnected',
        pinecone: pineconeStatus ? 'connected' : 'disconnected',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    // Determine overall health status
    const isHealthy =
      health.services.server === 'up' &&
      health.services.slack === 'connected' &&
      health.services.pinecone === 'connected' &&
      health.services.redis === 'connected';

    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

router.get('/up', (_, res) => {
  res.json({ status: 'server is up' });
});

export default router;
