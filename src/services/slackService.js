import pkg from '@slack/bolt';

import { COMMANDS, RESPONSES, SLACK_CONFIG } from '../constants/config.js';
import { generateResponse, generateSummary } from './openaiService.js';
import { findSimilarQuestions, storeQuestionAndResponse } from './pineconeService.js';
const { App } = pkg;

// Log environment variables (without the actual values)
console.log('Environment variables loaded:', {
  SLACK_BOT_TOKEN: SLACK_CONFIG.BOT_TOKEN ? '✓' : '✗',
  SLACK_SIGNING_SECRET: SLACK_CONFIG.SIGNING_SECRET ? '✓' : '✗',
  SLACK_APP_TOKEN: SLACK_CONFIG.APP_TOKEN ? '✓' : '✗',
});

const slackBot = new App({
  token: SLACK_CONFIG.BOT_TOKEN,
  signingSecret: SLACK_CONFIG.SIGNING_SECRET,
  socketMode: true,
  appToken: SLACK_CONFIG.APP_TOKEN,
});

export async function getThreadMessages(channel, threadTs) {
  const threadMessages = await slackBot.client.conversations.replies({
    channel,
    ts: threadTs,
  });

  return threadMessages.messages.map((m) => m.text);
}

export async function setupSlackListeners() {
  // Listen to direct mentions (@bot)
  slackBot.event('app_mention', async ({ event, say }) => {
    try {
      console.log('Bot mentioned:', event);
      await say({
        text: "Hello! I'm here to help. Use `!summarize` in a thread to get a summary.",
        thread_ts: event.thread_ts || event.ts,
      });
    } catch (error) {
      console.error('Error handling mention:', error);
    }
  });

  // Listen to messages in channels
  slackBot.message(async ({ message, say }) => {
    try {
      // Ignore bot messages
      if (message.subtype && message.subtype === 'bot_message') {
        console.log('Bot message detected:', message);
        return; // Exit if the message is from a bot
      }

      // Check if the message has a user and text
      if (!message.user || !message.text) {
        console.warn('Received a message without a user or text');
        return; // Exit if there's no user or text to process
      }

      console.log('Received message:', message);
      const text = message.text.toLowerCase(); // Safely access text

      // Handle the message based on its content
      if (text.includes(COMMANDS.HELP)) {
        await say({
          text: RESPONSES.HELP,
          thread_ts: message.thread_ts || message.ts,
        });
        return;
      }

      if (text.includes(COMMANDS.SUMMARIZE)) {
        const messages = await getThreadMessages(message.channel, message.thread_ts || message.ts);

        const summary = await generateSummary(messages);

        await say({
          text: `Thread Summary:\n${summary}`,
          thread_ts: message.thread_ts || message.ts,
        });
        return;
      }

      if (text.includes('hello') || text.includes('hi')) {
        await say({
          text: RESPONSES.WELCOME,
          thread_ts: message.thread_ts || message.ts,
        });
        return;
      }

      if (text.endsWith('?')) {
        try {
          const similarQuestions = await findSimilarQuestions(message.text);
          const bestMatch = similarQuestions[0];
          if (bestMatch && bestMatch.score > 0.92) {
            console.log('bestMatch', bestMatch);
            await say({
              text: `I found a similar question! Here's the answer:\n${bestMatch.response}`,
              thread_ts: message.thread_ts || message.ts,
            });
            return;
          }

          const response = await generateResponse(message.text);
          await storeQuestionAndResponse(message.text, response);
          await say({
            text: response,
            thread_ts: message.thread_ts || message.ts,
          });
        } catch (error) {
          console.error('Error handling question:', error);
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
      console.error('Slack Error:', {
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
  slackBot.event('reaction_added', async ({ event, client }) => {
    try {
      // You can trigger actions based on specific reactions
      if (event.reaction === 'summary') {
        const messages = await getThreadMessages(event.item.channel, event.item.ts);

        const summary = await generateSummary(messages);

        await client.chat.postMessage({
          channel: event.item.channel,
          thread_ts: event.item.ts,
          text: `Thread Summary (requested via reaction):\n${summary}`,
        });
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  });
}

// Add this new function
async function checkBotPermissions() {
  try {
    console.log('Checking bot permissions...');
    const auth = await slackBot.client.auth.test();
    console.log('Bot auth info:', auth);

    const botInfo = await slackBot.client.bots.info({
      bot: auth.bot_id,
    });
    console.log('Bot scopes:', {
      provided: botInfo.bot.scopes,
      userId: auth.user_id,
      botId: auth.bot_id,
    });

    return botInfo;
  } catch (error) {
    console.error('Error checking bot permissions:', {
      error: error.message,
      data: error.data,
    });
    throw error;
  }
}

// Export the function
export { checkBotPermissions, slackBot };
