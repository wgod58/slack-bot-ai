import 'dotenv/config';
import express, { Express } from 'express';
import { App as SlackApp } from '@slack/bolt';

import router from './routes/router';
import { mongoService } from './services/mongoService';
import { createRedisVectorIndex } from './services/redisService';
import { initialSlackBot, setupSlackListeners } from './services/slackService';

export class App {
  private server: Express;
  private slackBot: SlackApp | null;

  constructor() {
    this.server = express();
    this.slackBot = null;
    // Setup basic middleware
    this.server.use(express.json());
  }

  async initialize(): Promise<App> {
    try {
      this.server.use('/api', router);

      // Initialize MongoDB connection
      await mongoService.connect();
      console.log('MongoDB connected successfully');

      // Initialize Redis vector index
      await createRedisVectorIndex();
      console.log('Redis vector index created successfully');

      // Start Slack bot
      this.slackBot = initialSlackBot();
      await this.slackBot.start();
      console.log('Slack bot is running!');

      // Setup Slack listeners
      console.log('Setting up Slack listeners...');
      await setupSlackListeners(this.slackBot);

      return this;
    } catch (error) {
      console.log('Error starting server:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const PORT = process.env.PORT || 3000;
      this.server.listen(PORT, (error?: Error) => {
        if (error) {
          console.log('Error starting server:', error);
          reject(error);
          return;
        }
        console.log(`Server is running on port ${PORT}`);
        resolve();
      });
    });
  }

  // Optional cleanup method that can be set by tests
  onShutdown: (() => Promise<void>) | null = null;
}

const app = new App();

// Start the server if this file is run directly
app.initialize().then(() => app.start());

export default app;
