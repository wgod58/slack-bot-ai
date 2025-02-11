import "dotenv/config";
import express from "express";
import {
  slackBot,
  setupSlackListeners,
  joinChannel,
} from "./src/services/slackService.js";
import apiRouter from "./src/routes/api.js";
import { initIndex } from "./src/services/pineconeService.js";

const server = express();
server.use(express.json());

// Setup routes
server.use("/api", apiRouter);

// Channels the bot should join
const CHANNELS_TO_JOIN = [
  // 'C08CN03GZT7', // Commented out for testing
];

// Start both Express and Slack app
async function startServer() {
  try {
    console.log("Starting server...");

    // Initialize Pinecone
    console.log("Initializing Pinecone...");
    await initIndex();

    // Start Slack bot
    console.log("Starting Slack bot...");
    await slackBot.start();
    console.log("⚡️ Slack bot is running!");

    // Join channels one by one with error handling
    console.log("Attempting to join channels...");
    for (const channelId of CHANNELS_TO_JOIN) {
      try {
        await joinChannel(channelId);
      } catch (channelError) {
        console.error(`Failed to join channel ${channelId}:`, {
          error: channelError.message,
          data: channelError.data,
        });
        // Continue with other channels even if one fails
        continue;
      }
    }

    // Setup listeners
    console.log("Setting up Slack listeners...");
    await setupSlackListeners();

    // Start Express server
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      console.log(`🚀 Express server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Startup Error:", {
      message: error.message,
      code: error.code,
      data: error.data,
      stack: error.stack,
    });
    process.exit(1);
  }
}

startServer();
