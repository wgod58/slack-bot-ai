import pkg from "@slack/bolt";
const { App } = pkg;
import { generateResponse, generateSummary } from "./openaiService.js";

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

// Add these helper functions at the top of the file
const COMMANDS = {
  SUMMARIZE: "!summarize",
  HELP: "!help",
};

const RESPONSES = {
  WELCOME: `👋 Hello! I'm your AI assistant. I can help you with:
• Summarizing threads (use \`!summarize\` in a thread)
• Answering questions
• Finding similar messages`,

  HELP: `Available commands:
• Ask questions with ? sign
• \`!summarize\` - Summarize the current thread
• \`!help\` - Show this help message
You can also:
• Ask me questions
• Say hello`,

  DEFAULT: (text) => `I received your message: "${text}"
Need help? Try \`!help\` for a list of commands`,
};

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
          message.thread_ts || message.ts,
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
          // You could integrate with OpenAI here for better responses
          const response = await generateResponse(message.text);
          await say({
            text: response,
            thread_ts: message.thread_ts || message.ts,
          });
        } catch (error) {
          console.error("Error generating response:", error);
          await say({
            text: "I'm having trouble answering your question right now. Please try again later.",
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
        text: "Sorry, I encountered an error processing your request.",
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
          event.item.ts,
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

// Helper function to join a channel
export async function joinChannel(channelId) {
  try {
    console.log(`Attempting to join channel: ${channelId}`);

    // First check if we can access the channel
    try {
      const channelInfo = await slackBot.client.conversations.info({
        channel: channelId,
      });
      console.log("Channel info:", channelInfo);
    } catch (infoError) {
      console.error("Error getting channel info:", {
        error: infoError,
        scopes: infoError.data?.response_metadata?.scopes,
        needed: infoError.data?.needed,
        provided: infoError.data?.provided,
      });
    }

    // Try to join the channel
    const joinResult = await slackBot.client.conversations.join({
      channel: channelId,
    });
    console.log("Join result:", joinResult);
    console.log(`Bot joined channel ${channelId}`);
  } catch (error) {
    console.error("Error joining channel:", {
      error: error.message,
      code: error.code,
      needed: error.data?.needed,
      provided: error.data?.provided,
      scopes: error.data?.response_metadata?.scopes,
    });
    throw error;
  }
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
