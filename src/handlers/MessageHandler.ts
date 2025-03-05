import { SayFn } from '@slack/bolt';

import { AI_CONFIG, RESPONSES } from '../constants/config';
import { QAMatch } from '../interfaces/ServiceInterfaces';
import { createEmbedding, generateResponse, generateSummary } from '../services/openaiService';
import { pineconeService } from '../services/pineconeService';
import { redisService } from '../services/redisService';
import { slackService } from '../services/slackService';
import { SlackMessage } from '../types/SlackTypes';

export interface IMessageHandler {
  canHandle(message: SlackMessage): boolean;
  handle(message: SlackMessage, say: SayFn): Promise<void>;
}

export class HelpMessageHandler implements IMessageHandler {
  canHandle(message: SlackMessage): boolean {
    return message.text.toLowerCase().includes('!help');
  }

  async handle(message: SlackMessage, say: SayFn): Promise<void> {
    await say({
      text: RESPONSES.HELP,
      thread_ts: message.thread_ts || message.ts,
    });
  }
}

export class SummarizeMessageHandler implements IMessageHandler {
  canHandle(message: SlackMessage): boolean {
    return message.text.toLowerCase().includes('!summarize');
  }

  async handle(message: SlackMessage, say: SayFn): Promise<void> {
    try {
      if (!message.thread_ts) {
        await say({
          text: RESPONSES.SUMMARIZE_NO_THREAD,
          thread_ts: message.ts,
        });
        return;
      }

      const threadMessages = await slackService.getThreadMessages(
        message.channel,
        message.thread_ts,
      );
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
}

export class QuestionMessageHandler implements IMessageHandler {
  canHandle(message: SlackMessage): boolean {
    return message.text.toLowerCase().endsWith('?');
  }

  async handle(message: SlackMessage, say: SayFn): Promise<void> {
    try {
      const questionEmbedding = await createEmbedding(message.text);

      // Check Redis first
      const redisSimilar: QAMatch[] = await redisService.findSimilarQuestions(questionEmbedding);
      const bestRedisMatch = redisSimilar[0];
      if (bestRedisMatch && bestRedisMatch.score > AI_CONFIG.MATCH_SCORE) {
        await say({
          text: `I found a similar question in cache! Here's the answer:\n${bestRedisMatch.response}`,
          thread_ts: message.thread_ts || message.ts,
        });
        return;
      }

      // Check Pinecone next
      const similarQuestions: QAMatch[] =
        await pineconeService.findSimilarQuestions(questionEmbedding);
      const bestMatch = similarQuestions[0];

      if (bestMatch && bestMatch.score > AI_CONFIG.MATCH_SCORE) {
        await say({
          text: `I found a similar question! Here's the answer:\n${bestMatch.response}`,
          thread_ts: message.thread_ts || message.ts,
        });
        await redisService.storeQuestionVector(message.text, bestMatch.response, questionEmbedding);
        return;
      }

      // Generate new response if no match found
      const response = await generateResponse(message.text);
      await say({
        text: response,
        thread_ts: message.thread_ts || message.ts,
      });

      // Store the new Q&A pair
      await Promise.all([
        redisService.storeQuestionVector(message.text, response, questionEmbedding),
        pineconeService.storeQuestionVector(message.text, response, questionEmbedding),
      ]);
    } catch (error) {
      console.log('Error handling question:', error);
      await say({
        text: RESPONSES.QUESTION_ERROR,
        thread_ts: message.thread_ts || message.ts,
      });
    }
  }
}

export class GreetingMessageHandler implements IMessageHandler {
  canHandle(message: SlackMessage): boolean {
    const text = message.text.toLowerCase();
    return text.includes('hello') || text.includes('hi');
  }

  async handle(message: SlackMessage, say: SayFn): Promise<void> {
    await say({
      text: RESPONSES.WELCOME,
      thread_ts: message.thread_ts || message.ts,
    });
  }
}

export class DefaultMessageHandler implements IMessageHandler {
  canHandle(): boolean {
    return true; // Default handler handles all messages
  }

  async handle(message: SlackMessage, say: SayFn): Promise<void> {
    await say({
      text: RESPONSES.DEFAULT(message.text),
      thread_ts: message.thread_ts || message.ts,
    });
  }
}
