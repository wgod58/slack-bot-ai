import Redis from 'ioredis';

import { REDIS_CONFIG } from '../constants/config.js';

const redisClient = new Redis({
  host: REDIS_CONFIG.HOST,
  port: REDIS_CONFIG.PORT,
  username: REDIS_CONFIG.USERNAME,
  password: REDIS_CONFIG.PASSWORD,
  maxRetriesPerRequest: 3,
  connectionName: 'slack-bot',
  enableOfflineQueue: true,
  connectTimeout: 10000,
});

function float32ArrayToBuffer(array) {
  return Buffer.from(new Float32Array(array).buffer);
}

async function createRedisVectorIndex() {
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
    ];

    await redisClient.call(...createIndexCommand);
  } catch (e) {
    if (e.message.includes('Index already exists')) {
      console.log('Index already exists');
    } else {
      console.log('Error creating vector index:', e);
      throw e;
    }
  }
}

async function storeQuestionVectorInRedis(question, response, vector) {
  try {
    const id = `question:${Date.now()}`;
    await redisClient.call(
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
    throw error;
  }
}

async function findSimilarQuestionsInRedis(vector, limit = 5) {
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
    ];

    const results = await redisClient.call(...searchCommand);
    return parseSearchResults(results);
  } catch (error) {
    console.log('Error searching similar questions:', error);
    throw error;
  }
}

function parseSearchResults(results) {
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
      id: docId,
      text: fieldMap.text,
      response: fieldMap.response,
      score: 1 - parseFloat(fieldMap.vector_score),
    });
  }

  return documents;
}

export async function getEmbeddingFromCache(text) {
  try {
    const key = `${REDIS_CONFIG.PREFIXES.EMBEDDING}${text}`;
    const cachedEmbedding = await redisClient.get(key);
    return cachedEmbedding ? JSON.parse(cachedEmbedding) : null;
  } catch (error) {
    console.log('Error getting embedding from cache:', error);
    return null;
  }
}

export async function storeEmbeddingInCache(text, embedding) {
  console.log('Storing embedding in cache:', text);
  try {
    const key = `${REDIS_CONFIG.PREFIXES.EMBEDDING}${text}`;
    await redisClient.set(key, JSON.stringify(embedding));
  } catch (error) {
    console.log('Error storing embedding in cache:', error);
  }
}

async function checkHealth() {
  try {
    const ping = await redisClient.ping();
    return ping === 'PONG';
  } catch (error) {
    console.log('Redis health check failed:', error);
    return false;
  }
}

export {
  checkHealth,
  createRedisVectorIndex,
  findSimilarQuestionsInRedis,
  redisClient,
  storeQuestionVectorInRedis,
};
