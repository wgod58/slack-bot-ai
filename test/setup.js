import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
config({ path: resolve(__dirname, '.env.test') });

// Mock Pinecone
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    listIndexes: jest.fn().mockResolvedValue([]),
    Index: jest.fn().mockImplementation(() => ({
      upsert: jest.fn().mockResolvedValue({}),
      query: jest.fn().mockResolvedValue({ matches: [] }),
    })),
  })),
}));
