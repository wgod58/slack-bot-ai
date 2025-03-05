import Redis, { RedisOptions } from 'ioredis';

import { REDIS_CONFIG } from '../constants/config.ts';

interface SearchResult {
  id: string;
  text: string;
  response: string;
  score: number;
}

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

const redisClient = new Redis(redisConfig);

function float32ArrayToBuffer(array: number[]): Buffer {
  return Buffer.from(new Float32Array(array).buffer);
}

export async function createRedisVectorIndex(): Promise<void> {
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

    await redisClient.call(...createIndexCommand);
    console.log('Vector index created successfully');
  } catch (e: any) {
    if (e.message.includes('Index already exists')) {
      console.log('Index already exists');
    } else {
      console.log('Error creating vector index:', e);
      // Don't throw the error, just log it
    }
  }
}

export async function storeQuestionVectorInRedis(
  question: string,
  response: string,
  vector: number[],
): Promise<void> {
  try {
    const id = `question:${Date.now()}`;
    const vectorBuffer = float32ArrayToBuffer(vector);

    await redisClient
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
    // Don't throw the error, just log it
  }
}

export async function findSimilarQuestionsInRedis(
  vector: number[],
  limit = 5,
): Promise<SearchResult[]> {
  try {
    const searchCommand = [
      'FT.SEARCH',
      'idx:questions',
      `*=>[KNN ${limit} @vector $BLOB AS vector_score]`,
      'PARAMS',
      '2',
      'BLOB',
      float32ArrayToBuffer(Array.from(vector)),
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

    const results = await redisClient.call(...searchCommand);
    return parseSearchResults(results as any[]);
  } catch (error) {
    console.log('Error searching similar questions:', error);
    return [];
  }
}

function parseSearchResults(results: any[]): SearchResult[] {
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

export async function getEmbeddingFromCache(text: string): Promise<number[] | null> {
  try {
    const key = `${REDIS_CONFIG.PREFIXES.EMBEDDING}${text}`;
    const cachedEmbedding = await redisClient.get(key);
    return cachedEmbedding ? JSON.parse(cachedEmbedding) : null;
  } catch (error) {
    console.log('Error getting embedding from cache:', error);
    return null;
  }
}

export async function storeEmbeddingInCache(text: string, embedding: number[]): Promise<void> {
  console.log('Storing embedding in cache');
  try {
    const key = `${REDIS_CONFIG.PREFIXES.EMBEDDING}${text}`;
    await redisClient.set(key, JSON.stringify(embedding));
  } catch (error) {
    console.log('Error storing embedding in cache:', error);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const ping = await redisClient.ping();
    return ping === 'PONG';
  } catch (error) {
    console.log('Redis health check failed:', error);
    return false;
  }
}

export { redisClient };
