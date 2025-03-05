import { SayFn } from '@slack/bolt';

import { SlackMessage } from '../types/SlackTypes';

export interface QAMatch {
  response: string;
  score: number;
}

export interface IService {
  checkHealth(): Promise<boolean>;
}

export interface IMongoService extends IService {
  connect(): Promise<void>;
  close(): Promise<void>;
  getEmbeddingFromDB(text: string): Promise<number[] | null>;
  storeEmbeddingInDB(text: string, embedding: number[]): Promise<void>;
}

export interface IRedisService extends IService {
  createVectorIndex(): Promise<void>;
  storeQuestionVector(question: string, response: string, vector: number[]): Promise<void>;
  findSimilarQuestions(vector: number[], limit?: number): Promise<QAMatch[]>;
  getEmbeddingFromCache(text: string): Promise<number[] | null>;
  storeEmbeddingInCache(text: string, embedding: number[]): Promise<void>;
}

export interface IPineconeService extends IService {
  storeQuestionVector(
    question: string,
    response: string,
    questionEmbedding: number[],
  ): Promise<void>;
  findSimilarQuestions(questionEmbedding: number[], limit?: number): Promise<QAMatch[]>;
}

export interface IOpenAIService extends IService {
  generateSummary(messages: string): Promise<string>;
  generateResponse(question: string): Promise<string>;
  createEmbedding(text: string): Promise<number[]>;
}

export interface ISlackService extends IService {
  initialize(socketMode?: boolean, receiver?: any): any;
  getThreadMessages(channel: string, threadTs: string): Promise<string[]>;
  setupListeners(): Promise<void>;
  handleAppMention(event: SlackMessage, say: SayFn): Promise<void>;
  handleMessage(message: SlackMessage, say: SayFn): Promise<void>;
}
