import OpenAIPackage from "openai";
const { OpenAI } = OpenAIPackage;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSummary(messages) {
  const prompt = `Please summarize this conversation:\n${messages.join("\n")}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI Error:", {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}

export async function generateResponse(question) {
  try {
    console.log("Generating response for question:", question);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant in a Slack channel. Be concise but friendly in your responses.",
        },
        {
          role: "user",
          content: question,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI Error:", {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}

export async function createEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error creating embedding:", {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}
