import { MongoClient } from 'mongodb';

import { MONGODB_CONFIG } from '../../src/constants/config';
import { mongoService } from '../../src/services/mongoService';

// Mock MongoDB
jest.mock('mongodb', () => ({
  MongoClient: {
    connect: jest.fn(),
  },
  ServerApiVersion: {
    v1: '1',
  },
}));

type MockCollection = {
  findOne: jest.Mock;
  updateOne: jest.Mock;
};

type MockDb = {
  collection: jest.Mock;
  command: jest.Mock;
};

type MockMongoClient = {
  db: jest.Mock;
  close: jest.Mock;
};

describe('MongoService', () => {
  let mockClient: MockMongoClient;
  let mockDb: MockDb;
  let mockCollection: MockCollection;

  beforeEach(() => {
    // Reset mocks
    mockCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      command: jest.fn().mockResolvedValue({ ok: 1 }),
    };
    mockClient = {
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn(),
    };
    (MongoClient.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  afterEach(async () => {
    await mongoService.close();
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to MongoDB successfully', async () => {
      await mongoService.connect();

      expect(MongoClient.connect).toHaveBeenCalledWith(
        expect.stringContaining(
          `mongodb+srv://${MONGODB_CONFIG.USERNAME}:${MONGODB_CONFIG.PASSWORD}`,
        ),
        expect.any(Object),
      );
    });
  });

  describe('checkHealth', () => {
    it('should return true when MongoDB is healthy', async () => {
      await mongoService.connect();
      const health = await mongoService.checkHealth();
      expect(health).toBe(true);
      expect(mockDb.command).toHaveBeenCalledWith({ ping: 1 });
    });

    it('should return false when MongoDB is not connected', async () => {
      const health = await mongoService.checkHealth();
      expect(health).toBe(false);
    });
  });

  describe('getEmbeddingFromDB', () => {
    it('should retrieve embedding successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockCollection.findOne.mockResolvedValue({ embedding: mockEmbedding });

      await mongoService.connect();
      const result = await mongoService.getEmbeddingFromDB('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ text: 'test text' });
    });

    it('should return null when embedding is not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await mongoService.connect();
      const result = await mongoService.getEmbeddingFromDB('test text');

      expect(result).toBeNull();
    });
  });

  describe('storeEmbeddingInDB', () => {
    it('should store embedding successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockCollection.updateOne.mockResolvedValue({ acknowledged: true });

      await mongoService.connect();
      await mongoService.storeEmbeddingInDB('test text', mockEmbedding);

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { text: 'test text' },
        {
          $set: {
            embedding: mockEmbedding,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
        { upsert: true },
      );
    });
  });
});
