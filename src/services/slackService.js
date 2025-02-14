import pkg from "@slack/bolt";
const { App } = pkg;
import { generateResponse, generateSummary } from "./openaiService.js";
import { COMMANDS, RESPONSES } from "../constants/config.js";
import {
  storeQuestionAndResponse,
  findSimilarQuestions,
} from "./pineconeService.js";

// Log environment variables (without the actual values)
console.log("Environment variables loaded:", {
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? "✓" : "✗",
  SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET ? "✓" : "✗",
  SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN ? "✓" : "✗",
});

const slackBot = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

export async function getThreadMessages(channel, threadTs) {
  const threadMessages = await slackBot.client.conversations.replies({
    channel: channel,
    ts: threadTs,
  });

  return threadMessages.messages.map((m) => m.text);
}

export async function setupSlackListeners() {
  // Listen to direct mentions (@bot)
  slackBot.event("app_mention", async ({ event, say }) => {
    try {
      console.log("Bot mentioned:", event);
      await say({
        text: `Hello! I'm here to help. Use \`!summarize\` in a thread to get a summary.`,
        thread_ts: event.thread_ts || event.ts,
      });
    } catch (error) {
      console.error("Error handling mention:", error);
    }
  });

  // Listen to messages in channels
  slackBot.message(async ({ message, say }) => {
    try {
      // Ignore bot messages
      if (message.subtype && message.subtype === "bot_message") {
        return;
      }

      console.log("Received message:", message);
      const text = message.text.toLowerCase();

      // Help command
      if (text.includes(COMMANDS.HELP)) {
        await say({
          text: RESPONSES.HELP,
          thread_ts: message.thread_ts || message.ts,
        });
        return;
      }

      // Summarize command
      if (text.includes(COMMANDS.SUMMARIZE)) {
        const messages = await getThreadMessages(
          message.channel,
          message.thread_ts || message.ts
        );

        const summary = await generateSummary(messages);

        await say({
          text: `Thread Summary:\n${summary}`,
          thread_ts: message.thread_ts || message.ts,
        });
        return;
      }

      // Greetings
      if (text.includes("hello") || text.includes("hi")) {
        await say({
          text: RESPONSES.WELCOME,
          thread_ts: message.thread_ts || message.ts,
        });
        return;
      }

      // Questions
      if (text.endsWith("?")) {
        try {
          // First check for similar questions
          const similarQuestions = await findSimilarQuestions(message.text);

          // If we have a very similar question (high score), use the existing answer
          const bestMatch = similarQuestions[0];
          if (bestMatch && bestMatch.score > 0.95) {
            await say({
              text: `I found a similar question! Here's the answer:\n${bestMatch.response}`,
              thread_ts: message.thread_ts || message.ts,
            });
            return;
          }

          // Generate new response if no good match found
          const response = await generateResponse(message.text);

          // Store the new Q&A pair
          await storeQuestionAndResponse(message.text, response);

          await say({
            text: response,
            thread_ts: message.thread_ts || message.ts,
          });
        } catch (error) {
          console.error("Error handling question:", error);
          await say({
            text: RESPONSES.QUESTION_ERROR,
            thread_ts: message.thread_ts || message.ts,
          });
        }
        return;
      }

      // Default response
      await say({
        text: RESPONSES.DEFAULT(message.text),
        thread_ts: message.thread_ts || message.ts,
      });
    } catch (error) {
      console.error("Slack Error:", {
        error: error.message,
        data: error.data,
        stack: error.stack,
      });
      await say({
        text: RESPONSES.ERROR,
        thread_ts: message.thread_ts || message.ts,
      });
    }
  });

  // Listen to reaction added events
  slackBot.event("reaction_added", async ({ event, client }) => {
    try {
      // You can trigger actions based on specific reactions
      if (event.reaction === "summary") {
        const messages = await getThreadMessages(
          event.item.channel,
          event.item.ts
        );

        const summary = await generateSummary(messages);

        await client.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: `Thread Summary (requested via reaction):\n${summary}`,
        });
      }
    } catch (error) {
      console.error("Error handling reaction:", error);
    }
  });
}

// Add this new function
async function checkBotPermissions() {
  try {
    console.log("Checking bot permissions...");
    const auth = await slackBot.client.auth.test();
    console.log("Bot auth info:", auth);

    const botInfo = await slackBot.client.bots.info({
      bot: auth.bot_id,
    });
    console.log("Bot scopes:", {
      provided: botInfo.bot.scopes,
      userId: auth.user_id,
      botId: auth.bot_id,
    });

    return botInfo;
  } catch (error) {
    console.error("Error checking bot permissions:", {
      error: error.message,
      data: error.data,
    });
    throw error;
  }
}

// Export the function
export { slackBot, checkBotPermissions };
