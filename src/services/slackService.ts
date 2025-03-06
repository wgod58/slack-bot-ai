import { App, AppOptions, Receiver, SayFn } from '@slack/bolt';

import { RESPONSES, SLACK_CONFIG } from '../constants/config';
import { messageHandlerFactory } from '../factories/messageHandlerFactory';
import { ISlackService } from '../interfaces/serviceInterfaces';
import { SlackMessage, ThreadMessage } from '../types/slackType';

class SlackService implements ISlackService {
  private static instance: ISlackService;
  private client: App | null = null;

  public static getInstance(): SlackService {
    if (!SlackService.instance) {
      SlackService.instance = new SlackService();
    }
    return SlackService.instance as SlackService;
  }

  public initialize(socketMode = true, receiver?: Receiver): App {
    if (!this.client) {
      const options: AppOptions = {
        token: SLACK_CONFIG.BOT_TOKEN,
        signingSecret: SLACK_CONFIG.SIGNING_SECRET,
        socketMode,
        appToken: SLACK_CONFIG.APP_TOKEN,
      };

      if (receiver) {
        options.receiver = receiver;
      }

      this.client = new App(options);
    }
    return this.client;
  }

  public async getThreadMessages(channel: string, threadTs: string): Promise<string[]> {
    if (!this.client) throw new Error('Slack bot not initialized');

    const threadMessages = await this.client.client.conversations.replies({
      channel,
      ts: threadTs,
    });
    return (threadMessages.messages as ThreadMessage[]).map((m) => m.text);
  }

  public async setupListeners(): Promise<void> {
    if (!this.client) throw new Error('Slack bot not initialized');

    // Listen to direct mentions (@bot)
    this.client.event('app_mention', async ({ event, say }) => {
      await this.handleAppMention(event as SlackMessage, say);
    });

    // Listen to messages in channels
    this.client.message(async ({ message, say }) => {
      await this.handleMessage(message as SlackMessage, say);
    });
  }

  public async handleAppMention(event: SlackMessage, say: SayFn): Promise<void> {
    console.log('handleAppMention Bot mentioned:', event);
    await say({
      text: "Hello! I'm here to help. Use `!summarize` in a thread to get a summary.",
      thread_ts: event.thread_ts || event.ts,
    });
  }

  public async handleMessage(message: SlackMessage, say: SayFn): Promise<void> {
    try {
      // Ignore bot messages
      if (message.subtype && message.subtype === 'bot_message') {
        console.log('Bot message detected');
        return;
      }

      // Check if the message has a user and text
      if (!message.user || !message.text) {
        console.warn('Received a message without a user or text');
        return;
      }

      await say({
        text: RESPONSES.WORKING,
        thread_ts: message.thread_ts || message.ts,
      });
      console.log('handleMessage received message:', message);

      // Get appropriate handler and handle the message
      const handler = messageHandlerFactory.getHandler(message);
      console.log('handleMessage handler:', handler);
      await handler.handle(message, say);
    } catch (error) {
      console.log('Slack Error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      await say({
        text: RESPONSES.ERROR,
        thread_ts: message.thread_ts || message.ts,
      });
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.client.auth.test();
      return true;
    } catch (error) {
      console.log('Slack health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const slackService = SlackService.getInstance();
