import { Pinecone } from '@pinecone-database/pinecone';
import { PINECONE_CONFIG } from '../constants/config.js';

// Lazy-load Pinecone (Only create when needed)
let pineconeInstance;

function getPineconeInstance() {
  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({ apiKey: PINECONE_CONFIG.API_KEY || 'test-key' });
  }
  return pineconeInstance;
}

const INDEX_NAME = 'slack-bot';

// Initialize index
function initIndex() {
  try {
    const pinecone = getPineconeInstance();
    const index = pinecone.Index(INDEX_NAME);
    return index;
  } catch (error) {
    console.error('Error initializing Pinecone index:', error);
    throw error;
  }
}

// Store question and response in Pinecone
async function storeQuestionVectorInPinecone(question, response, questionEmbedding) {
  try {
    const pinecone = getPineconeInstance();
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
    const pinecone = getPineconeInstance();
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

export { findSimilarQuestionsInPinecone, initIndex, storeQuestionVectorInPinecone };
