import {
  DefaultMessageHandler,
  GreetingMessageHandler,
  HelpMessageHandler,
  IMessageHandler,
  QuestionMessageHandler,
  SummarizeMessageHandler,
} from '../handlers/MessageHandler';
import { SlackMessage } from '../types/SlackTypes';
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

  public static getInstance(): MessageHandlerFactory {
    if (!this.instance) {
      this.instance = new MessageHandlerFactory();
    }

    return this.instance as MessageHandlerFactory;
  }

  public getHandler(message: SlackMessage): IMessageHandler {
    return (
      this.handlers.find((handler) => handler.canHandle(message)) || new DefaultMessageHandler()
    );
  }
}
