import { OpenAI } from 'openai';

import { AI_CONFIG, RESPONSES } from '../../src/constants/config';
import { mongoService } from '../../src/services/mongoService';
import { openaiService } from '../../src/services/openaiService';
import { redisService } from '../../src/services/redisService';

// Mock OpenAI and dependencies
jest.mock('openai');
jest.mock('../../src/services/mongoService');
jest.mock('../../src/services/redisService');

describe('OpenAIService', () => {
  const mockList = jest.fn();
  const mockCompletionsCreate = jest.fn();
  const mockEmbeddingsCreate = jest.fn();

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock client
    const mockClient = {
      apiKey: 'test-key',
      models: { list: mockList },
      chat: { completions: { create: mockCompletionsCreate } },
      embeddings: { create: mockEmbeddingsCreate },
    };

    // Mock the OpenAI constructor to return our mock client
    jest.mocked(OpenAI).mockReturnValue(mockClient as unknown as OpenAI);

    // Force reinitialize the OpenAI service with our mock
    (openaiService as unknown as { client: OpenAI }).client = mockClient as unknown as OpenAI;

    // Reset other service mocks
    jest.spyOn(mongoService, 'getEmbeddingFromDB').mockImplementation();
    jest.spyOn(mongoService, 'storeEmbeddingInDB').mockImplementation();
    jest.spyOn(redisService, 'getEmbeddingFromCache').mockImplementation();
    jest.spyOn(redisService, 'storeEmbeddingInCache').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return true when OpenAI is healthy', async () => {
      mockList.mockResolvedValue([]);
      const health = await openaiService.checkHealth();
      expect(health).toBe(true);
    });

    it('should return false when OpenAI check fails', async () => {
      mockList.mockRejectedValue(new Error('API Error'));
      const health = await openaiService.checkHealth();
      expect(health).toBe(false);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary successfully', async () => {
      const mockSummary = 'Test summary';
      mockCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: mockSummary } }],
      });

      const result = await openaiService.generateSummary('Test messages');

      expect(result).toBe(mockSummary);
      expect(mockCompletionsCreate).toHaveBeenCalledWith({
        model: AI_CONFIG.MODELS.CHAT,
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('Test messages'),
          },
        ],
      });
    });

    it('should throw error when OpenAI returns empty response', async () => {
      mockCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(openaiService.generateSummary('Test')).rejects.toThrow(RESPONSES.QUESTION_ERROR);
    });
  });

  describe('generateResponse', () => {
    it('should generate response successfully', async () => {
      const mockResponse = 'Test response';
      mockCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const result = await openaiService.generateResponse('Test question');

      expect(result).toBe(mockResponse);
      expect(mockCompletionsCreate).toHaveBeenCalledWith({
        model: AI_CONFIG.MODELS.CHAT,
        messages: [
          {
            role: 'system',
            content: AI_CONFIG.SYSTEM_PROMPTS.DEFAULT,
          },
          {
            role: 'user',
            content: 'Test question',
          },
        ],
      });
    });

    it('should throw error when OpenAI returns invalid response', async () => {
      mockCompletionsCreate.mockResolvedValue({
        choices: [],
      });

      await expect(openaiService.generateResponse('Test')).rejects.toThrow(
        RESPONSES.QUESTION_ERROR,
      );
    });
  });

  describe('createEmbedding', () => {
    const mockEmbedding = [0.1, 0.2, 0.3];

    it('should return cached embedding if available', async () => {
      jest.spyOn(redisService, 'getEmbeddingFromCache').mockResolvedValue(mockEmbedding);

      const result = await openaiService.createEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it('should return DB embedding if not in cache', async () => {
      jest.spyOn(redisService, 'getEmbeddingFromCache').mockResolvedValue(null);
      jest.spyOn(mongoService, 'getEmbeddingFromDB').mockResolvedValue(mockEmbedding);

      const result = await openaiService.createEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
      expect(redisService.storeEmbeddingInCache).toHaveBeenCalledWith('test text', mockEmbedding);
    });

    it('should generate new embedding if not found in cache or DB', async () => {
      jest.spyOn(redisService, 'getEmbeddingFromCache').mockResolvedValue(null);
      jest.spyOn(mongoService, 'getEmbeddingFromDB').mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await openaiService.createEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: AI_CONFIG.MODELS.EMBEDDING,
        input: 'test text',
      });
      expect(redisService.storeEmbeddingInCache).toHaveBeenCalledWith('test text', mockEmbedding);
      expect(mongoService.storeEmbeddingInDB).toHaveBeenCalledWith('test text', mockEmbedding);
    });
  });
});
