import {
  IMongoService,
  IOpenAIService,
  IPineconeService,
  IRedisService,
  ISlackService,
} from '../interfaces/ServiceInterfaces';

export class ServiceFactory {
  private static instance: ServiceFactory | null = null;
  private mongoService: IMongoService | null = null;
  private openaiService: IOpenAIService | null = null;
  private pineconeService: IPineconeService | null = null;
  private redisService: IRedisService | null = null;
  private slackService: ISlackService | null = null;

  private constructor() {}

  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  public getMongoService(): IMongoService {
    if (!this.mongoService) {
      // Lazy import to avoid circular dependencies
      const { mongoService } = require('../services/mongoService');
      this.mongoService = mongoService;
    }
    return this.mongoService!;
  }

  public getOpenAIService(): IOpenAIService {
    if (!this.openaiService) {
      // Lazy import to avoid circular dependencies
      const { openaiService } = require('../services/openaiService');
      this.openaiService = openaiService;
    }
    return this.openaiService!;
  }

  public getPineconeService(): IPineconeService {
    if (!this.pineconeService) {
      // Lazy import to avoid circular dependencies
      const { pineconeService } = require('../services/pineconeService');
      this.pineconeService = pineconeService;
    }
    return this.pineconeService!;
  }

  public getRedisService(): IRedisService {
    if (!this.redisService) {
      // Lazy import to avoid circular dependencies
      const { redisService } = require('../services/redisService');
      this.redisService = redisService;
    }
    return this.redisService!;
  }

  public getSlackService(): ISlackService {
    if (!this.slackService) {
      // Lazy import to avoid circular dependencies
      const { slackService } = require('../services/slackService');
      this.slackService = slackService;
    }
    return this.slackService!;
  }

  public async initializeServices(): Promise<void> {
    try {
      // Initialize MongoDB
      await this.getMongoService().connect();
      console.log('MongoDB connected successfully');

      // Initialize Redis
      await this.getRedisService().createVectorIndex();
      console.log('Redis vector index created successfully');

      // Initialize Slack
      const slackBot = this.getSlackService().initialize();
      await slackBot.start();
      console.log('Slack bot is running!');

      // Setup Slack listeners
      await this.getSlackService().setupListeners();
      console.log('Slack listeners setup successfully');
    } catch (error) {
      console.error('Error initializing services:', error);
      throw error;
    }
  }
}
