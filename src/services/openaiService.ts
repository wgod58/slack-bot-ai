import { OpenAI } from 'openai';

import { AI_CONFIG, RESPONSES } from '../constants/config.ts';
import { mongoService } from './mongoService.ts';
import { redisService } from './redisService.ts';

const openai = new OpenAI({
  apiKey: AI_CONFIG.OPENAI_API_KEY,
});

export async function generateSummary(messages: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.MODELS.CHAT,
      messages: [
        {
          role: 'user',
          content: `Please summarize this conversation:\n${messages}`,
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    return content;
  } catch (error: any) {
    console.log('OpenAI Error:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw new Error(RESPONSES.QUESTION_ERROR);
  }
}

export async function generateResponse(question: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.MODELS.CHAT,
      messages: [
        {
          role: 'system',
          content: AI_CONFIG.SYSTEM_PROMPTS.DEFAULT,
        },
        {
          role: 'user',
          content: question,
        },
      ],
    });

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI');
    }

    return response.choices[0].message.content;
  } catch (error: any) {
    console.log('OpenAI Error:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw new Error(RESPONSES.QUESTION_ERROR);
  }
}

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    // Check Redis cache first
    const cachedEmbedding = await redisService.getEmbeddingFromCache(text);
    if (cachedEmbedding) {
      console.log('Using cached embedding');
      return cachedEmbedding;
    }

    // Check MongoDB if not in cache
    const dbEmbedding = await mongoService.getEmbeddingFromDB(text);
    if (dbEmbedding) {
      console.log('Using DB embedding');
      // Store in cache for future use
      redisService.storeEmbeddingInCache(text, dbEmbedding);
      return dbEmbedding;
    }

    console.log('Generating new embedding');
    const response = await openai.embeddings.create({
      model: AI_CONFIG.MODELS.EMBEDDING,
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Store in both cache and DB
    redisService.storeEmbeddingInCache(text, embedding);
    await mongoService.storeEmbeddingInDB(text, embedding);

    return embedding;
  } catch (error: any) {
    console.log('OpenAI Error:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}

export { openai };
