import Redis, { RedisOptions } from 'ioredis';

import { REDIS_CONFIG } from '../constants/config';
import { IRedisService, QAMatch } from '../interfaces/ServiceInterfaces';

interface RedisSearchResult {
  id: string; // Assuming the ID of the document
  fields: {
    text: string;
    response: string;
    vector_score: string; // Assuming this is a string; adjust if it's a number
  };
}

class RedisService implements IRedisService {
  private static instance: IRedisService;
  private client: Redis;

  private constructor() {
    const redisConfig: RedisOptions = {
      host: REDIS_CONFIG.HOST,
      port: Number(REDIS_CONFIG.PORT),
      username: REDIS_CONFIG.USERNAME || undefined,
      password: REDIS_CONFIG.PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      connectionName: 'slack-bot',
      enableOfflineQueue: true,
      connectTimeout: 10000,
    };

    this.client = new Redis(redisConfig);
  }

  public static getInstance(): IRedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private float32ArrayToBuffer(array: number[]): Buffer {
    return Buffer.from(new Float32Array(array).buffer);
  }

  public async createVectorIndex(): Promise<void> {
    try {
      const createIndexCommand = [
        'FT.CREATE',
        'idx:questions',
        'ON',
        'JSON',
        'PREFIX',
        '1',
        'question:',
        'SCHEMA',
        '$.vector',
        'AS',
        'vector',
        'VECTOR',
        'FLAT',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        '1536',
        'DISTANCE_METRIC',
        'COSINE',
        '$.text',
        'AS',
        'text',
        'TEXT',
        '$.response',
        'AS',
        'response',
        'TEXT',
      ] as const;

      await this.client.call(...createIndexCommand);
      console.log('Vector index created successfully');
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Index already exists')) {
        console.log('Index already exists');
      } else {
        console.log('Error creating vector index:', e);
      }
    }
  }

  public async storeQuestionVector(
    question: string,
    response: string,
    vector: number[],
  ): Promise<void> {
    try {
      const id = `question:${Date.now()}`;

      await this.client.call(
        'JSON.SET',
        id,
        '$',
        JSON.stringify({
          vector: Array.from(vector),
          text: question,
          response,
          timestamp: new Date().toISOString(),
        }),
      );
      console.log('Stored redis question vector:', id);
    } catch (error) {
      console.log('Error storing redis question vector:', error);
    }
  }

  public async findSimilarQuestions(vector: number[], limit = 5): Promise<QAMatch[]> {
    console.log('Finding similar questions in Redis cache');
    try {
      const searchCommand = [
        'FT.SEARCH',
        'idx:questions',
        `*=>[KNN ${limit} @vector $BLOB AS vector_score]`,
        'PARAMS',
        '2',
        'BLOB',
        this.float32ArrayToBuffer(Array.from(vector)),
        'RETURN',
        '3',
        'text',
        'response',
        'vector_score',
        'SORTBY',
        'vector_score',
        'DIALECT',
        '2',
      ] as const;

      const results = await this.client.call(...searchCommand);
      return this.parseSearchResults(results as RedisSearchResult[]);
    } catch (error) {
      console.log('Error searching similar questions:', error);
      return [];
    }
  }

  private parseSearchResults(results: RedisSearchResult[]): QAMatch[] {
    if (!results || results.length < 2) return [];

    const documents = [];

    for (let i = 1; i < results.length; i += 2) {
      const docId = results[i];
      const fieldsArray = results[i + 1];

      if (!Array.isArray(fieldsArray)) {
        console.warn('Unexpected field structure for document:', docId);
        continue;
      }

      const fieldMap = Object.fromEntries(
        fieldsArray.reduce((acc, val, index, arr) => {
          if (index % 2 === 0) acc.push([val, arr[index + 1]]);
          return acc;
        }, []),
      );

      documents.push({
        response: fieldMap.response,
        score: 1 - parseFloat(fieldMap.vector_score),
      });
    }

    return documents;
  }

  public async getEmbeddingFromCache(text: string): Promise<number[] | null> {
    try {
      const key = `${REDIS_CONFIG.PREFIXES.EMBEDDING}${text}`;
      const cachedEmbedding = await this.client.get(key);
      return cachedEmbedding ? JSON.parse(cachedEmbedding) : null;
    } catch (error) {
      console.log('Error getting embedding from cache:', error);
      return null;
    }
  }

  public async storeEmbeddingInCache(text: string, embedding: number[]): Promise<void> {
    console.log('Storing embedding in cache');
    try {
      const key = `${REDIS_CONFIG.PREFIXES.EMBEDDING}${text}`;
      await this.client.set(key, JSON.stringify(embedding));
    } catch (error) {
      console.log('Error storing embedding in cache:', error);
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const ping = await this.client.ping();
      return ping === 'PONG';
    } catch (error) {
      console.log('Redis health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const redisService = RedisService.getInstance();
