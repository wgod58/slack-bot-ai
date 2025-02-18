import { Pinecone } from '@pinecone-database/pinecone';

import { PINECONE_CONFIG } from '../constants/config.js';

const INDEX_NAME = 'slack-bot';

const pinecone = new Pinecone({
  apiKey: PINECONE_CONFIG.API_KEY,
});

// Store question and response in Pinecone
async function storeQuestionVectorInPinecone(question, response, questionEmbedding) {
  try {
    const index = pinecone.Index(INDEX_NAME);

    // Store in Pinecone
    await index.upsert([
      {
        id: `qa_${Date.now()}`,
        values: questionEmbedding,
        metadata: {
          question,
          response,
          timestamp: new Date().toISOString(),
          type: 'qa_pair',
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
async function findSimilarQuestionsInPinecone(questionEmbedding, limit = 5) {
  try {
    const index = pinecone.Index(INDEX_NAME);

    const queryResponse = await index.query({
      vector: questionEmbedding,
      topK: limit,
      includeMetadata: true,
    });

    return queryResponse.matches
      .filter((match) => match.metadata?.question && match.metadata?.response)
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
