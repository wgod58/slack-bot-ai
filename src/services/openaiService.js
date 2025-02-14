import { OpenAI } from 'openai';

import { AI_CONFIG } from '../constants/config.js';

const openai = new OpenAI({
  apiKey: AI_CONFIG.OPENAI_API_KEY,
});

export async function generateSummary(messages) {
  const prompt = `Please summarize this conversation:\n${messages.join('')}`;

  try {
    const completion = await openai.chat.completions.create({
      model: AI_CONFIG.MODELS.CHAT,
      messages: [{ role: 'user', content: prompt }],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI Error:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}

export async function generateResponse(question) {
  try {
    const completion = await openai.chat.completions.create({
      model: AI_CONFIG.MODELS.CHAT,
      messages: [
        {
          role: 'system',
          content: AI_CONFIG.SYSTEM_PROMPTS.DEFAULT,
        },
        {
          role: 'user',
          content: question,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI Error:', {
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
      model: AI_CONFIG.MODELS.EMBEDDING,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    throw error;
  }
}
