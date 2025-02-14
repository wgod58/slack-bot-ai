import "dotenv/config";
import express from "express";
import { slackBot, setupSlackListeners } from "./src/services/slackService.js";
import apiRouter from "./src/routes/api.js";
import { initIndex } from "./src/services/pineconeService.js";
import { SERVER_CONFIG } from "./src/constants/config.js";

const server = express();
server.use(express.json());

// Setup routes
server.use("/api", apiRouter);

// Start both Express and Slack app
async function startServer() {
  try {
    console.log("Starting server...");

    // Initialize Pinecone
    console.log("Initializing Pinecone...");
    const index = await initIndex();
    global.pineconeIndex = index; // Store for global access if needed

    // Start Slack bot
    console.log("Starting Slack bot...");
    await slackBot.start();
    console.log("⚡️ Slack bot is running!");

    // Setup listeners
    console.log("Setting up Slack listeners...");
    await setupSlackListeners();

    // Start Express server
    server.listen(SERVER_CONFIG.PORT, () => {
      console.log(`🚀 Express server is running on port ${SERVER_CONFIG.PORT}`);
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
