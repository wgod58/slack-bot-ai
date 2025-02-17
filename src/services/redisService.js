import Redis from 'ioredis';

import { REDIS_CONFIG } from '../constants/config.js';

const redisClient = new Redis({
  host: REDIS_CONFIG.HOST,
  port: REDIS_CONFIG.PORT || 6379,
  username: REDIS_CONFIG.USERNAME,
  password: REDIS_CONFIG.PASSWORD,
  maxRetriesPerRequest: 3,
  connectionName: 'slack-bot',
  enableOfflineQueue: true,
  connectTimeout: 10000,
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
  configureRedis();
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('reconnecting', () => {
  console.log('Redis Client Reconnecting...');
});

async function configureRedis() {
  try {
    console.log('Configuring Redis settings...');
    await redisClient.call('CONFIG', 'SET', 'maxmemory', '500mb');
    await redisClient.call('CONFIG', 'SET', 'maxmemory-policy', 'allkeys-lfu');
    await redisClient.call('CONFIG', 'SET', 'maxmemory-samples', '10');
    console.log('Redis configured successfully.');
  } catch (error) {
    console.error('Error configuring Redis:', error);
    throw error;
  }
}

function float32ArrayToBuffer(array) {
  return Buffer.from(new Float32Array(array).buffer);
}

async function createRedisVectorIndex() {
  console.log('Creating vector index...');
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
    console.log('Vector index created successfully');
  } catch (e) {
    if (e.message.includes('Index already exists')) {
      console.log('Index already exists');
    } else {
      console.error('Error creating vector index:', e);
      throw e;
    }
  }
}

async function storeQuestionVectorInRedis(question, response, vector) {
  console.log('Storing question vector...');
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
    console.log('Stored question vector:', id);
  } catch (error) {
    console.error('Error storing question vector:', error);
    throw error;
  }
}

async function findSimilarQuestionsInRedis(vector, limit = 5) {
  console.log('Searching similar questions...');
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
    console.error('Error searching similar questions:', error);
    throw error;
  }
}

function parseSearchResults(results) {
  console.log('results', results);
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

async function checkHealth() {
  try {
    const ping = await redisClient.ping();
    return ping === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

export {
  checkHealth,
  configureRedis,
  createRedisVectorIndex,
  findSimilarQuestionsInRedis,
  redisClient,
  storeQuestionVectorInRedis,
};
