import {
  DefaultMessageHandler,
  GreetingMessageHandler,
  HelpMessageHandler,
  IMessageHandler,
  QuestionMessageHandler,
  SummarizeMessageHandler,
} from '../handlers/MessageHandler.ts';
import { SlackMessage } from '../types/SlackTypes';

export class MessageHandlerFactory {
  private static instance: MessageHandlerFactory;
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
    if (!MessageHandlerFactory.instance) {
      MessageHandlerFactory.instance = new MessageHandlerFactory();
    }
    return MessageHandlerFactory.instance;
  }

  public getHandler(message: SlackMessage): IMessageHandler {
    return (
      this.handlers.find((handler) => handler.canHandle(message)) || new DefaultMessageHandler()
    );
  }
}
