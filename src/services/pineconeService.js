import { Pinecone } from '@pinecone-database/pinecone';

import { PINECONE_CONFIG } from '../constants/config.js';
import { createEmbedding } from './openaiService.js';

const pinecone = new Pinecone({
  apiKey: PINECONE_CONFIG.API_KEY,
});

// Initialize index
const INDEX_NAME = 'slack-bot';

async function initIndex() {
  try {
    // List existing indexes
    const indexes = await pinecone.listIndexes();
    console.log('indexes', indexes);

    const index = pinecone.Index(INDEX_NAME);
    console.log('Pinecone index initialized:', INDEX_NAME);
    return index;
  } catch (error) {
    console.error('Error initializing Pinecone index:', error);
    throw error;
  }
}

// Store question and response in Pinecone
async function storeQuestionAndResponse(question, response) {
  try {
    const index = pinecone.Index(INDEX_NAME);

    // Create embedding for the question
    const questionEmbedding = await createEmbedding(question);

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
async function findSimilarQuestions(question, limit = 5) {
  try {
    const index = pinecone.Index(INDEX_NAME);
    const questionEmbedding = await createEmbedding(question);

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

export { findSimilarQuestions, initIndex, pinecone, storeQuestionAndResponse };
