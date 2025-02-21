import { MongoClient } from 'mongodb';

import { MONGODB_CONFIG } from '../constants/config.js';

let client;
let db;

export async function connectToMongoDB() {
  try {
    const USERNAME = MONGODB_CONFIG.USERNAME;
    const PASSWORD = MONGODB_CONFIG.PASSWORD;
    const HOSTS = MONGODB_CONFIG.URI;
    const DATABASE = MONGODB_CONFIG.DB_NAME;
    const OPTIONS = MONGODB_CONFIG.OPTIONS;
    const CONNECTION_STRING =
      'mongodb://' + USERNAME + ':' + PASSWORD + '@' + HOSTS + '/' + DATABASE + OPTIONS;

    client = await MongoClient.connect(CONNECTION_STRING);
    db = client.db(DATABASE);
    console.log('Connected to MongoDB');

    // Create indexes
    await db.collection('embeddings').createIndex({ text: 1 }, { unique: true });
    await db
      .collection('embeddings')
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days TTL

    return db;
  } catch (error) {
    console.log('MongoDB connection error:', error);
    throw error;
  }
}

export async function getEmbeddingFromDB(text) {
  try {
    const result = await db.collection('embeddings').findOne({ text });
    return result ? result.embedding : null;
  } catch (error) {
    console.log('Error getting embedding from MongoDB:', error);
    return null;
  }
}

export async function storeEmbeddingInDB(text, embedding) {
  try {
    console.log('Storing embedding in MongoDB');
    await db.collection('embeddings').updateOne(
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

export async function closeMongoConnection() {
  if (client) {
    await client.close();
    client = null;
    console.log('MongoDB connection closed');
  } else {
    console.log('MongoDB connection already closed');
  }
}
