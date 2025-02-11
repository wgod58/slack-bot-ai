import pkg from "@pinecone-database/pinecone";
const { Pinecone } = pkg;

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Initialize index
const INDEX_NAME = "slack-bot"; // You'll create this in Pinecone dashboard

async function initIndex() {
  try {
    // List existing indexes
    const indexes = await pinecone.listIndexes();
    console.log(
      "have index",
      indexes.indexes.some((index) => index.name === INDEX_NAME)
    );

    // Check if our index exists
    // const indexExists = indexes.some((index) => index.name === INDEX_NAME);

    // if (!indexExists) {
    //   // Create index if it doesn't exist
    //   await pinecone.createIndex({
    //     name: INDEX_NAME,
    //     dimension: 1536, // OpenAI embeddings dimension
    //     metric: "cosine",
    //   });
    //   console.log(`Created new index: ${INDEX_NAME}`);
    // }

    // Get the index instance
    // const index = pinecone.Index(INDEX_NAME);
    // console.log("Pinecone index initialized:", INDEX_NAME);
    // return index;
  } catch (error) {
    console.error("Error initializing Pinecone index:", error);
    throw error;
  }
}

// Function to upsert messages to Pinecone
async function upsertMessages(index, messages) {
  try {
    const vectors = await Promise.all(
      messages.map(async (message, i) => {
        // Create embedding using OpenAI
        const embedding = await createEmbedding(message);
        return {
          id: `msg_${Date.now()}_${i}`,
          values: embedding,
          metadata: {
            text: message,
            timestamp: Date.now(),
          },
        };
      })
    );

    await index.upsert(vectors);
    console.log(`Upserted ${vectors.length} messages to Pinecone`);
  } catch (error) {
    console.error("Error upserting to Pinecone:", error);
    throw error;
  }
}

// Function to query similar messages
async function querySimilar(index, query, topK = 5) {
  try {
    const queryEmbedding = await createEmbedding(query);
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return results.matches.map((match) => ({
      text: match.metadata.text,
      score: match.score,
    }));
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw error;
  }
}

// Helper function to create embeddings using OpenAI
async function createEmbedding(text) {
  // Note: You'll need to implement this using OpenAI's embedding API
  // We'll implement this in the next step
  throw new Error("Not implemented yet");
}

export { pinecone, initIndex, upsertMessages, querySimilar };
