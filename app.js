import 'dotenv/config';

import express from 'express';

import router from './src/routes/router.js';
import { createVectorIndex } from './src/services/redisService.js';
import { initialSlackBot, setupSlackListeners } from './src/services/slackService.js';

class App {
  constructor() {
    this.server = express();
    this.slackBot = null;
  }

  async initialize() {
    try {
      console.log('Starting server...');

      // Setup middleware
      this.server.use(express.json());
      this.server.use(router);

      // Initialize Redis vector index
      console.log('Initializing Redis vector index...');
      await createVectorIndex();
      console.log('Vector index created successfully');

      // Start Slack bot
      console.log('Starting Slack bot...');
      this.slackBot = initialSlackBot();
      await this.slackBot.start();
      console.log('Slack bot is running!');

      // Setup Slack listeners
      console.log('Setting up Slack listeners...');
      await setupSlackListeners(this.slackBot);

      return this;
    } catch (error) {
      console.error('Error starting server:', error);
      throw error;
    }
  }

  async start() {
    return new Promise((resolve, reject) => {
      const PORT = process.env.PORT;
      this.server.listen(PORT, (error) => {
        if (error) {
          console.error('Error starting server:', error);
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
