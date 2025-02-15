import { Pinecone } from '@pinecone-database/pinecone';

import { PINECONE_CONFIG } from '../constants/config.js';

const pinecone = new Pinecone({
  apiKey: PINECONE_CONFIG.API_KEY,
});

// Initialize index
const INDEX_NAME = 'slack-bot';

// Initialize index
async function initIndex() {
  try {
    const index = pinecone.Index(INDEX_NAME);
    console.log('Pinecone index initialized:', INDEX_NAME);
    return index;
  } catch (error) {
    console.error('Error initializing Pinecone index:', error);
    throw error;
  }
}

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
    console.error('Error storing in Pinecone:', error);
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

    return queryResponse.matches.map((match) => ({
      question: match.metadata.question,
      response: match.metadata.response,
      score: match.score,
    }));
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw error;
  }
}

export { findSimilarQuestionsInPinecone, initIndex, pinecone, storeQuestionVectorInPinecone };
