import 'dotenv/config';

import express from 'express';

import { SERVER_CONFIG } from './src/constants/config.js';
import router from './src/routes/router.js';
import { createVectorIndex } from './src/services/redisService.js';
import { setupSlackListeners, slackBot } from './src/services/slackService.js';

const server = express();
server.use(express.json());

// Setup routes
server.use('/api', router);

// Start both Express and Slack app
async function startServer() {
  try {
    console.log('Starting server...');

    // Initialize Redis vector index
    console.log('Initializing Redis vector index...');
    await createVectorIndex();

    // Start Slack bot
    console.log('Starting Slack bot...');
    await slackBot.start();
    console.log('Slack bot is running!');

    // Setup listeners
    console.log('Setting up Slack listeners...');
    await setupSlackListeners();

    // Start Express server
    server.listen(SERVER_CONFIG.PORT, () => {
      console.log(`Express server is running on port ${SERVER_CONFIG.PORT}`);
    });
  } catch (error) {
    console.error('Startup Error:', {
      message: error.message,
      code: error.code,
      data: error.data,
      stack: error.stack,
    });
    process.exit(1);
  }
}

startServer();
