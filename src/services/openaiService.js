import { OpenAI } from 'openai';

import { AI_CONFIG } from '../constants/config.js';
import { getEmbeddingFromCache, storeEmbeddingInCache } from './redisService.js';

const openai = new OpenAI({
  apiKey: AI_CONFIG.OPENAI_API_KEY,
});

export async function generateSummary(messages) {
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

    return response.choices[0].message.content;
  } catch (error) {
    console.log('OpenAI Error:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}

export async function generateResponse(question) {
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

    return response.choices[0].message.content;
  } catch (error) {
    console.log('OpenAI Error:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}

export async function createEmbedding(text) {
  try {
    // Check cache first
    const cachedEmbedding = await getEmbeddingFromCache(text);
    if (cachedEmbedding) {
      console.log('Using cached embedding');
      return cachedEmbedding;
    }

    console.log('Generating new embedding');
    const response = await openai.embeddings.create({
      model: AI_CONFIG.MODELS.EMBEDDING,
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Store in cache for future use
    await storeEmbeddingInCache(text, embedding);

    return embedding;
  } catch (error) {
    console.log('OpenAI Error:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}

export { openai };
