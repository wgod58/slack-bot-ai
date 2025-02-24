import 'dotenv/config';

import express from 'express';

import router from './routes/router.js';
import { connectToMongoDB } from './services/mongoService.js';
import { createRedisVectorIndex } from './services/redisService.js';
import { initialSlackBot, setupSlackListeners } from './services/slackService.js';

export class App {
  constructor() {
    this.server = express();
    this.slackBot = null;
    // Setup basic middleware
    this.server.use(express.json());
  }

  async initialize() {
    try {
      this.server.use('/api', router);

      // Initialize MongoDB connection
      await connectToMongoDB();
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

  async start() {
    return new Promise((resolve, reject) => {
      const PORT = process.env.PORT;
      this.server.listen(PORT, (error) => {
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
  onShutdown = null;
}

const app = new App();

// Start the server if this file is run directly

app.initialize().then(() => app.start());

export default app;
