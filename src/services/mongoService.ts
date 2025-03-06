import { Db, MongoClient, ServerApiVersion } from 'mongodb';

import { MONGODB_CONFIG } from '../constants/config';
import { IMongoService } from '../interfaces/serviceInterfaces';

class MongoService implements IMongoService {
  private static instance: IMongoService;

  private client: MongoClient | null = null;
  private db: Db | null = null;

  public static getInstance(): MongoService {
    if (!MongoService.instance) {
      MongoService.instance = new MongoService();
    }
    return MongoService.instance as MongoService;
  }

  public async connect(): Promise<void> {
    const uri = `mongodb+srv://${MONGODB_CONFIG.USERNAME}:${MONGODB_CONFIG.PASSWORD}@${MONGODB_CONFIG.URI}/${MONGODB_CONFIG.OPTIONS}`;
    if (!uri) {
      throw new Error('MongoDB URI is not defined in the configuration.');
    }

    if (!this.client) {
      this.client = await MongoClient.connect(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
      });
      this.db = this.client.db(MONGODB_CONFIG.DB_NAME);
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('MongoDB connection closed');
    } else {
      console.log('MongoDB connection already closed');
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      if (!this.client || !this.db) {
        return false;
      }
      await this.db.command({ ping: 1 });
      return true;
    } catch (error) {
      console.log('MongoDB health check failed:', error);
      return false;
    }
  }

  public async getEmbeddingFromDB(text: string): Promise<number[] | null> {
    try {
      if (!this.db) throw new Error('MongoDB not connected');
      const result = await this.db.collection('embeddings').findOne({ text });
      return result ? result.embedding : null;
    } catch (error) {
      console.log('Error getting embedding from MongoDB:', error);
      return null;
    }
  }

  public async storeEmbeddingInDB(text: string, embedding: number[]): Promise<void> {
    try {
      if (!this.db) throw new Error('MongoDB not connected');
      console.log('Storing embedding in MongoDB');
      await this.db.collection('embeddings').updateOne(
        { text },
        {
          $set: {
            embedding,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      console.log('Error storing embedding in MongoDB:', error);
    }
  }
}

// Export singleton instance
export const mongoService: MongoService = MongoService.getInstance();
