import { Pinecone } from '@pinecone-database/pinecone';

import { PINECONE_CONFIG } from '../constants/config.ts';

interface QAMatch {
  question: string;
  response: string;
  score: number;
}

interface QAMetadata {
  question: string;
  response: string;
  timestamp: string;
  type: 'qa_pair';
}

if (!PINECONE_CONFIG.API_KEY) {
  throw new Error('Pinecone API key is required');
}

const pinecone = new Pinecone({
  apiKey: PINECONE_CONFIG.API_KEY,
});

// Store question and response in Pinecone
async function storeQuestionVectorInPinecone(
  question: string,
  response: string,
  questionEmbedding: number[],
): Promise<void> {
  try {
    if (!PINECONE_CONFIG.INDEX_NAME) {
      throw new Error('Pinecone index name is required');
    }

    const index = pinecone.Index(PINECONE_CONFIG.INDEX_NAME);

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

// Find similar questions
async function findSimilarQuestionsInPinecone(
  questionEmbedding: number[],
  limit = 5,
): Promise<QAMatch[]> {
  try {
    if (!PINECONE_CONFIG.INDEX_NAME) {
      throw new Error('Pinecone index name is required');
    }

    const index = pinecone.Index(PINECONE_CONFIG.INDEX_NAME);

    const queryResponse = await index.query({
      vector: questionEmbedding,
      topK: limit,
      includeMetadata: true,
    });

    return queryResponse.matches
      .filter((match): match is typeof match & { metadata: QAMetadata; score: number } => {
        return Boolean(
          match.metadata?.question && match.metadata?.response && typeof match.score === 'number',
        );
      })
      .map((match) => ({
        question: match.metadata.question,
        response: match.metadata.response,
        score: match.score,
      }));
  } catch (error) {
    console.log('Error querying Pinecone:', error);
    throw error;
  }
}

export { findSimilarQuestionsInPinecone, pinecone, storeQuestionVectorInPinecone };
