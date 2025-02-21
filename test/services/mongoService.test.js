import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { MongoClient } from 'mongodb';

import {
  closeMongoConnection,
  connectToMongoDB,
  getEmbeddingFromDB,
  storeEmbeddingInDB,
} from '../../src/services/mongoService.js';

// Mock MongoDB
jest.mock('mongodb', () => {
  const mockIndexes = [{ name: '_id_' }, { name: 'text_1' }, { name: 'createdAt_1' }];

  const mockCollection = {
    createIndex: jest.fn().mockResolvedValue(true),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    indexes: jest.fn().mockResolvedValue(mockIndexes),
  };

  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };

  const mockClient = {
    db: jest.fn().mockReturnValue(mockDb),
    close: jest.fn(),
  };

  return {
    MongoClient: {
      connect: jest.fn().mockResolvedValue(mockClient),
    },
  };
});

describe('MongoDB Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    await closeMongoConnection();
  });

  describe('connectToMongoDB', () => {
    test('should connect and create indexes', async () => {
      const db = await connectToMongoDB();
      expect(db).toBeDefined();
      expect(db.collection).toHaveBeenCalledWith('embeddings');
      expect(db.collection('embeddings').createIndex).toHaveBeenCalledTimes(2);
    });

    test('should handle connection errors', async () => {
      MongoClient.connect.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(connectToMongoDB()).rejects.toThrow('Connection failed');
    });
  });

  describe('getEmbeddingFromDB', () => {
    test('should retrieve stored embedding', async () => {
      const text = 'test text';
      const embedding = [0.1, 0.2, 0.3];
      const mockResult = { embedding };

      const db = await connectToMongoDB();
      db.collection('embeddings').findOne.mockResolvedValueOnce(mockResult);

      const result = await getEmbeddingFromDB(text);
      expect(result).toEqual(embedding);
      expect(db.collection('embeddings').findOne).toHaveBeenCalledWith({ text });
    });

    test('should return null for non-existent embedding', async () => {
      const db = await connectToMongoDB();
      db.collection('embeddings').findOne.mockResolvedValueOnce(null);

      const result = await getEmbeddingFromDB('non-existent');
      expect(result).toBeNull();
    });

    test('should handle database errors', async () => {
      const db = await connectToMongoDB();
      db.collection('embeddings').findOne.mockRejectedValueOnce(new Error('DB error'));

      const result = await getEmbeddingFromDB('test');
      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        'Error getting embedding from MongoDB:',
        expect.any(Error),
      );
    });
  });

  describe('storeEmbeddingInDB', () => {
    test('should store and update embedding', async () => {
      const text = 'test text';
      const embedding = [0.1, 0.2, 0.3];

      const db = await connectToMongoDB();
      db.collection('embeddings').updateOne.mockResolvedValueOnce({ acknowledged: true });

      await storeEmbeddingInDB(text, embedding);
      expect(db.collection('embeddings').updateOne).toHaveBeenCalledWith(
        { text },
        {
          $set: {
            embedding,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
        { upsert: true },
      );
    });

    test('should handle storage errors', async () => {
      const db = await connectToMongoDB();
      db.collection('embeddings').updateOne.mockRejectedValueOnce(new Error('Storage failed'));

      await storeEmbeddingInDB('test', [0.1, 0.2, 0.3]);
      expect(console.log).toHaveBeenCalledWith(
        'Error storing embedding in MongoDB:',
        expect.any(Error),
      );
    });
  });

  describe('closeMongoConnection', () => {
    test('should close connection gracefully', async () => {
      const client = await MongoClient.connect();
      await connectToMongoDB();
      await closeMongoConnection();
      expect(client.close).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('MongoDB connection closed');
    });

    test('should handle no active connection', async () => {
      // Mock implementation for this test
      jest.clearAllMocks();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await closeMongoConnection();

      // Verify no MongoDB operations were attempted
      expect(MongoClient.connect).not.toHaveBeenCalled();
      expect(consoleSpy).toBeCalledTimes(1);
      expect(consoleSpy).toHaveBeenNthCalledWith(1, 'MongoDB connection already closed');
    });
  });
});
