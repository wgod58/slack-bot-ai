import Redis, { RedisOptions } from 'ioredis';

import { REDIS_CONFIG } from '../constants/config';
import { IRedisService } from '../interfaces/ServiceInterfaces';

interface SearchResult {
  id: string;
  text: string;
  response: string;
  score: number;
}

class RedisService implements IRedisService {
  private static instance: RedisService;
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

  public static getInstance(): RedisService {
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
    } catch (e: any) {
      if (e.message.includes('Index already exists')) {
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
      const vectorBuffer = this.float32ArrayToBuffer(vector);

      await this.client
        .multi()
        .hset(id, {
          vector: vectorBuffer,
          text: question,
          response,
          timestamp: new Date().toISOString(),
        })
        .exec();
      console.log('Stored redis question vector:', id);
    } catch (error) {
      console.log('Error storing redis question vector:', error);
    }
  }

  public async findSimilarQuestions(vector: number[], limit = 5): Promise<SearchResult[]> {
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
      return this.parseSearchResults(results as any[]);
    } catch (error) {
      console.log('Error searching similar questions:', error);
      return [];
    }
  }

  private parseSearchResults(results: any[]): SearchResult[] {
    if (!results || results.length < 2) return [];

    const documents: SearchResult[] = [];

    for (let i = 1; i < results.length; i += 2) {
      const docId = results[i];
      const fieldsArray = results[i + 1];

      if (!Array.isArray(fieldsArray)) {
        console.warn('Unexpected field structure for document:', docId);
        continue;
      }

      const fieldMap = Object.fromEntries(
        fieldsArray.reduce((acc: [string, string][], val, index, arr) => {
          if (index % 2 === 0) acc.push([val, arr[index + 1]]);
          return acc;
        }, []),
      );

      documents.push({
        id: docId,
        text: fieldMap.text,
        response: fieldMap.response,
        score: 1 - parseFloat(fieldMap.__vector_score || '0'),
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

  public getClient(): Redis {
    return this.client;
  }
}

// Export singleton instance
export const redisService = RedisService.getInstance();
