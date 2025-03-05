import { OpenAI } from 'openai';

import { AI_CONFIG, RESPONSES } from '../constants/config';
import { IOpenAIService } from '../interfaces/ServiceInterfaces';
import { mongoService } from './mongoService';
import { redisService } from './redisService';

class OpenAIService implements IOpenAIService {
  private static instance: IOpenAIService;
  private client: OpenAI;

  private constructor() {
    this.client = new OpenAI({
      apiKey: AI_CONFIG.OPENAI_API_KEY,
    });
  }

  public static getInstance(): IOpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      console.log('OpenAI health check failed:', error);
      return false;
    }
  }

  public async generateSummary(messages: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
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

  public async generateResponse(question: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
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

  public async createEmbedding(text: string): Promise<number[]> {
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
        await redisService.storeEmbeddingInCache(text, dbEmbedding);
        return dbEmbedding;
      }

      console.log('Generating new embedding');
      const response = await this.client.embeddings.create({
        model: AI_CONFIG.MODELS.EMBEDDING,
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Store in both cache and DB
      await Promise.all([
        redisService.storeEmbeddingInCache(text, embedding),
        mongoService.storeEmbeddingInDB(text, embedding),
      ]);

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
}

// Export singleton instance
export const openaiService = OpenAIService.getInstance();

// Export convenience methods
export const generateSummary = (messages: string) => openaiService.generateSummary(messages);
export const generateResponse = (question: string) => openaiService.generateResponse(question);
export const createEmbedding = (text: string) => openaiService.createEmbedding(text);
