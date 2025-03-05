import { Db, MongoClient, ServerApiVersion } from 'mongodb';
import { MONGODB_CONFIG } from '../constants/config.ts';

interface IMongoService {
  connect(): Promise<Db>;
  close(): Promise<void>;
  getDb(): Db | null;
}

export class MongoService implements IMongoService {
  private static instance: MongoService;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {}

  public static getInstance(): MongoService {
    if (!MongoService.instance) {
      MongoService.instance = new MongoService();
    }
    return MongoService.instance;
  }

  public async connect(): Promise<Db> {
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
    return this.db!;
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

  public getDb(): Db | null {
    return this.db;
  }

  async getEmbeddingFromDB(text: string) {
    try {
      const result = await this.db!.collection('embeddings').findOne({ text });
      return result ? result.embedding : null;
    } catch (error) {
      console.log('Error getting embedding from MongoDB:', error);
      return null;
    }
  }

  async storeEmbeddingInDB(text: string, embedding: number[]) {
    try {
      console.log('Storing embedding in MongoDB');
      await this.db!.collection('embeddings').updateOne(
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
export const mongoService = MongoService.getInstance();
