import express, { Request, Response, Router } from 'express';

import { pineconeService } from '../services/pineconeService';
import { redisService } from '../services/redisService';
import { slackService } from '../services/slackService';

interface HealthServices {
  server: 'up';
  slack: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  pinecone: 'connected' | 'disconnected';
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: HealthServices;
  uptime?: number;
  memory?: NodeJS.MemoryUsage;
  error?: string;
}

const router: Router = express.Router();

router.get('/health', async (_: Request, res: Response) => {
  try {
    // Check Slack connection
    const slackBot = slackService.getClient();
    const slackStatus = slackBot ? await slackBot.client.auth.test().catch(() => null) : null;

    // Check Redis connection
    const redisStatus = await redisService.checkHealth();
    const pineconeStatus = await pineconeService.checkHealth();

    const services: HealthServices = {
      server: 'up',
      slack: slackStatus ? 'connected' : 'disconnected',
      redis: redisStatus ? 'connected' : 'disconnected',
      pinecone: pineconeStatus ? 'connected' : 'disconnected',
    };

    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    // Determine overall health status
    const isHealthy =
      services.server === 'up' &&
      services.slack === 'connected' &&
      services.pinecone === 'connected' &&
      services.redis === 'connected';

    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error: any) {
    console.log('Health check failed:', error);
    const unhealthyStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        server: 'up',
        slack: 'disconnected',
        redis: 'disconnected',
        pinecone: 'disconnected',
      },
      error: error.message,
    };
    res.status(503).json(unhealthyStatus);
  }
});

router.get('/up', (_: Request, res: Response) => {
  res.json({ status: 'server is up' });
});

export default router;
