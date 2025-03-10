import {
  DefaultMessageHandler,
  GreetingMessageHandler,
  HelpMessageHandler,
  IMessageHandler,
  QuestionMessageHandler,
  SummarizeMessageHandler,
} from '../handlers/messageHandler';
import { SlackMessage } from '../types/slackType';
// Singleton factory class for creating message handlers
interface IMessageHandlerFactory {
  getHandler(message: SlackMessage): IMessageHandler;
}

export class MessageHandlerFactory implements IMessageHandlerFactory {
  private static instance: IMessageHandlerFactory;
  private handlers: IMessageHandler[];

  private constructor() {
    this.handlers = [
      new HelpMessageHandler(),
      new SummarizeMessageHandler(),
      new QuestionMessageHandler(),
      new GreetingMessageHandler(),
      new DefaultMessageHandler(), // Default handler should be last
    ];
  }

  public static getInstance(): IMessageHandlerFactory {
    if (!this.instance) {
      this.instance = new MessageHandlerFactory();
    }

    return this.instance;
  }

  public getHandler(message: SlackMessage): IMessageHandler {
    const handler = this.handlers.find((handler) => handler.canHandle(message));
    if (!handler) {
      throw new Error('No handler found for message');
    }
    return handler;
  }
}

export const messageHandlerFactory = MessageHandlerFactory.getInstance();
