import { Pinecone, QueryResponse, RecordMetadata } from '@pinecone-database/pinecone';

import { PINECONE_CONFIG } from '../constants/config';
import { IPineconeService, QAMatch } from '../interfaces/serviceInterfaces';

interface QAMetadata {
  question: string;
  response: string;
  timestamp: string;
  type: 'qa_pair';
}

class PineconeService implements IPineconeService {
  private static instance: IPineconeService;
  private client: Pinecone;

  private constructor() {
    if (!PINECONE_CONFIG.API_KEY) {
      throw new Error('Pinecone API key is required');
    }

    this.client = new Pinecone({
      apiKey: PINECONE_CONFIG.API_KEY,
    });
  }

  public static getInstance(): PineconeService {
    if (!PineconeService.instance) {
      PineconeService.instance = new PineconeService();
    }
    return PineconeService.instance as PineconeService;
  }

  public async storeQuestionVector(
    question: string,
    response: string,
    questionEmbedding: number[],
  ): Promise<void> {
    try {
      if (!PINECONE_CONFIG.INDEX_NAME) {
        throw new Error('Pinecone index name is required');
      }

      const index = this.client.Index(PINECONE_CONFIG.INDEX_NAME);

      // Store in Pinecone
      await index.upsert([
        {
          id: `qa_${Date.now()}`,
          values: questionEmbedding,
          metadata: {
            question,
            response,
            timestamp: new Date().toISOString(),
            type: 'qa_pair' as const,
          },
        },
      ]);

      console.log('Stored Q&A pair in Pinecone');
    } catch (error) {
      console.log('Error storing in Pinecone:', error);
      throw error;
    }
  }

  public async findSimilarQuestions(questionEmbedding: number[], limit = 5): Promise<QAMatch[]> {
    console.log('Finding similar questions in Pinecone');
    try {
      if (!PINECONE_CONFIG.INDEX_NAME) {
        throw new Error('Pinecone index name is required');
      }

      const index = this.client.Index(PINECONE_CONFIG.INDEX_NAME);

      const queryResponse: QueryResponse<RecordMetadata> = await index.query({
        vector: questionEmbedding,
        topK: limit,
        includeMetadata: true,
      });

      const result: QAMatch[] = queryResponse.matches
        .filter((match): match is typeof match & { metadata: QAMetadata; score: number } => {
          return Boolean(
            match.metadata?.question && match.metadata?.response && typeof match.score === 'number',
          );
        })
        .map((match) => ({
          response: match.metadata.response,
          score: match.score,
        }));

      return result;
    } catch (error) {
      console.log('Error querying Pinecone:', error);
      throw error;
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      if (!PINECONE_CONFIG.INDEX_NAME) {
        return false;
      }
      const index = this.client.Index(PINECONE_CONFIG.INDEX_NAME);
      await index.describeIndexStats();
      return true;
    } catch (error) {
      console.log('Pinecone health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const pineconeService = PineconeService.getInstance();
