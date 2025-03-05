import { App, AppOptions, SayFn } from '@slack/bolt';

import { AI_CONFIG, COMMANDS, RESPONSES, SLACK_CONFIG } from '../constants/config.ts';
import { createEmbedding, generateResponse, generateSummary } from './openaiService.ts';
import { pineconeService } from './pineconeService.ts';
import { redisService } from './redisService.ts';

interface ThreadMessage {
  text: string;
}

interface SlackMessage {
  thread_ts?: string;
  subtype?: string;
  channel: string;
  ts: string;
  text: string;
  user: string;
  type: string;
  team?: string;
  event_ts: string;
}

let slackBot: App | null = null;

export function initialSlackBot(socketMode = true, receiver?: any): App {
  if (!slackBot) {
    const options: AppOptions = {
      token: SLACK_CONFIG.BOT_TOKEN,
      signingSecret: SLACK_CONFIG.SIGNING_SECRET,
      socketMode,
      appToken: SLACK_CONFIG.APP_TOKEN,
    };

    if (receiver) {
      options.receiver = receiver;
    }

    slackBot = new App(options);
  }
  return slackBot;
}

// Get thread messages
export async function getThreadMessages(channel: string, threadTs: string): Promise<string[]> {
  if (!slackBot) throw new Error('Slack bot not initialized');

  const threadMessages = await slackBot.client.conversations.replies({
    channel,
    ts: threadTs,
  });
  return (threadMessages.messages as ThreadMessage[]).map((m) => m.text);
}

// Setup Slack listeners
export async function setupSlackListeners(bot: App): Promise<void> {
  // Listen to direct mentions (@bot)
  bot.event('app_mention', handleAppMention);

  // Listen to messages in channels
  bot.message(async ({ message, say }) => {
    await handleMessage({ message: message as SlackMessage, say });
  });
}

// Handle app mentions
async function handleAppMention({ event, say }: { event: any; say: SayFn }): Promise<void> {
  console.log('handleAppMention Bot mentioned:', event);
  await say({
    text: "Hello! I'm here to help. Use `!summarize` in a thread to get a summary.",
    thread_ts: event.thread_ts || event.ts,
  });
}

// Handle incoming messages
async function handleMessage({
  message,
  say,
}: {
  message: SlackMessage;
  say: SayFn;
}): Promise<void> {
  try {
    console.log('handleMessage received message:', message);
    // Ignore bot messages
    if (message.subtype && message.subtype === 'bot_message') {
      console.log('Bot message detected');
      return; // Exit if the message is from a bot
    }

    // Check if the message has a user and text
    if (!message.user || !message.text) {
      console.warn('Received a message without a user or text');
      return; // Exit if there's no user or text to process
    }
    await say({
      text: RESPONSES.WORKING,
      thread_ts: message.thread_ts || message.ts,
    });

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
  } catch (error: any) {
    console.log('Slack Error:', {
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
async function handleSummarizeCommand(message: SlackMessage, say: SayFn): Promise<void> {
  try {
    if (!message.thread_ts) {
      await say({
        text: RESPONSES.SUMMARIZE_NO_THREAD,
        thread_ts: message.ts,
      });
      return;
    }

    const threadMessages = await getThreadMessages(message.channel, message.thread_ts);
    const summary = await generateSummary(threadMessages.join('\n'));
    await say({
      text: summary,
      thread_ts: message.thread_ts,
    });
  } catch (error) {
    console.log('Error generating summary:', error);
    await say({
      text: RESPONSES.SUMMARIZE_ERROR,
      thread_ts: message.thread_ts || message.ts,
    });
  }
}

// Handle questions
async function handleQuestion(message: SlackMessage, say: SayFn): Promise<void> {
  try {
    const questionEmbedding = await createEmbedding(message.text);
    // First check Redis for similar questions
    console.log('Finding similar questions in Redis');
    const redisSimilar = await redisService.findSimilarQuestions(questionEmbedding);
    const bestRedisMatch = redisSimilar[0];

    if (bestRedisMatch && bestRedisMatch.score > AI_CONFIG.MATCH_SCORE) {
      console.log('bestRedisMatch.score', bestRedisMatch.score);
      await say({
        text: `I found a similar question in cache! Here's the answer:\n${bestRedisMatch.response}`,
        thread_ts: message.thread_ts || message.ts,
      });
      return;
    }

    // If not in Redis, check Pinecone
    console.log('Finding similar questions in Pinecone');
    const similarQuestions = await pineconeService.findSimilarQuestions(questionEmbedding);
    const bestMatch = similarQuestions[0];

    if (bestMatch && bestMatch.score > AI_CONFIG.MATCH_SCORE) {
      console.log('bestMatch.score', bestMatch.score);
      await say({
        text: `I found a similar question! Here's the answer:\n${bestMatch.response}`,
        thread_ts: message.thread_ts || message.ts,
      });
      console.log('Storing question in Redis');
      await redisService.storeQuestionVector(message.text, bestMatch.response, questionEmbedding);
      return;
    }

    // Generate new response if no good match found
    console.log('Generating new response from OpenAI');
    const response = await generateResponse(message.text);

    console.log('Sending response to Slack');
    await say({
      text: response,
      thread_ts: message.thread_ts || message.ts,
    });

    console.log('Storing question in Redis');
    await redisService.storeQuestionVector(message.text, response, questionEmbedding);
    console.log('Storing question in Pinecone');
    await pineconeService.storeQuestionVector(message.text, response, questionEmbedding);
  } catch (error) {
    console.log('Error handleQuestion:', error);
    await say({
      text: RESPONSES.QUESTION_ERROR,
      thread_ts: message.thread_ts || message.ts,
    });
  }
}

export { handleMessage, handleQuestion, handleSummarizeCommand };
