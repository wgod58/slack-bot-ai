import pkg from '@slack/bolt';

import { COMMANDS, RESPONSES, SLACK_CONFIG } from '../constants/config.js';
import { createEmbedding, generateResponse, generateSummary } from './openaiService.js';
import {
  findSimilarQuestionsInPinecone,
  storeQuestionVectorInPinecone,
} from './pineconeService.js';
import { findSimilarQuestionsInRedis, storeQuestionVectorInRedis } from './redisService.js';
const { App } = pkg;

const slackBot = new App({
  token: SLACK_CONFIG.BOT_TOKEN,
  signingSecret: SLACK_CONFIG.SIGNING_SECRET,
  socketMode: true,
  appToken: SLACK_CONFIG.APP_TOKEN,
});

// Get thread messages
export async function getThreadMessages(channel, threadTs) {
  const threadMessages = await slackBot.client.conversations.replies({
    channel,
    ts: threadTs,
  });

  return threadMessages.messages.map((m) => m.text);
}

// Setup Slack listeners
export async function setupSlackListeners() {
  // Listen to direct mentions (@bot)
  slackBot.event('app_mention', handleAppMention);

  // Listen to messages in channels
  slackBot.message(handleMessage);
}

// Handle app mentions
async function handleAppMention({ event, say }) {
  try {
    console.log('Bot mentioned:', event);
    await say({
      text: "Hello! I'm here to help. Use `!summarize` in a thread to get a summary.",
      thread_ts: event.thread_ts || event.ts,
    });
  } catch (error) {
    console.error('Error handling mention:', error);
  }
}

// Handle incoming messages
async function handleMessage({ message, say }) {
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
      await handleSummarizeCommand(message, say);
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
      await handleQuestion(message, say);
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
}

// Handle summarize command
async function handleSummarizeCommand(message, say) {
  const messages = await getThreadMessages(message.channel, message.thread_ts || message.ts);
  const summary = await generateSummary(messages);

  await say({
    text: `Thread Summary:\n${summary}`,
    thread_ts: message.thread_ts || message.ts,
  });
}

// Handle questions
async function handleQuestion(message, say) {
  try {
    // Create embedding for the question
    const questionEmbedding = await createEmbedding(message.text);

    // First check Redis for similar questions
    const redisSimilar = await findSimilarQuestionsInRedis(questionEmbedding);
    const bestRedisMatch = redisSimilar[0];

    if (bestRedisMatch && bestRedisMatch.score > 0.92) {
      await say({
        text: `I found a similar question in cache! Here's the answer:\n${bestRedisMatch.response}`,
        thread_ts: message.thread_ts || message.ts,
      });
      return;
    }

    // If not in Redis, check Pinecone
    const similarQuestions = await findSimilarQuestionsInPinecone(questionEmbedding);
    const bestMatch = similarQuestions[0];
    console.log('bestMatch.score', bestMatch.score);
    if (bestMatch && bestMatch.score > 0.92) {
      await say({
        text: `I found a similar question! Here's the answer:\n${bestMatch.response}`,
        thread_ts: message.thread_ts || message.ts,
      });
      return;
    }

    // Generate new response if no good match found
    const response = await generateResponse(message.text);

    // Store in both Redis and Pinecone
    await storeQuestionVectorInRedis(message.text, response, questionEmbedding);
    await storeQuestionVectorInPinecone(message.text, response, questionEmbedding);

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
}

export { slackBot };
