import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { Config } from 'jest';
import { jest } from '@jest/globals';

// Load test environment variables
dotenvConfig({ path: resolve(__dirname, '.env.test') });

// Mock Pinecone
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    listIndexes: jest.fn(() => Promise.resolve([] as any[])),
    Index: jest.fn().mockImplementation(() => ({
      upsert: jest.fn(() => Promise.resolve({} as any)),
      query: jest.fn(() => Promise.resolve({ matches: [] } as any)),
    })),
  })),
}));

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Add any other configuration options here
};

export default config;
