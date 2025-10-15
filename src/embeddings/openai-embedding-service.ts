/**
 * OpenAI Embedding Service
 *
 * Production embedding implementation using OpenAI's API.
 * Generates high-quality semantic embeddings for text using models like text-embedding-3-small.
 *
 * Design Notes:
 * - Communicates with OpenAI API via type-safe fetch utility
 * - Supports batch embedding generation
 * - Handles API errors gracefully with logging
 * - Normalizes vectors for cosine similarity
 * - Accepts logger via constructor injection (dependency inversion)
 */

import { type } from "arktype"
import { EmbeddingService } from "#embeddings/embedding-service"
import type {
  EmbeddingModel,
  EmbeddingModelInfo,
  Logger,
  OpenAIEmbeddingConfig,
} from "#types"
import {
  createNoOpLogger,
  DEFAULT_VECTOR_DIMENSIONS,
  EMBEDDING_BATCH_TIMEOUT_MS,
  EMBEDDING_REQUEST_TIMEOUT_MS,
  OpenAIEmbeddingModelValidator,
  OpenAIEmbeddingResponseValidator,
  TEXT_PREVIEW_LENGTH,
} from "#types"
import { fetchData } from "#utils"

/**
 * OpenAI embedding service implementation
 *
 * This service:
 * - Generates embeddings using OpenAI's API
 * - Supports batch processing
 * - Normalizes vectors to unit length
 * - Provides detailed error logging
 * - Tracks token usage for cost monitoring
 */
export class OpenAIEmbeddingService extends EmbeddingService {
  private readonly apiKey: string
  private readonly model: EmbeddingModel
  private readonly dimensions: number
  private readonly version: string
  private readonly apiEndpoint: string
  private readonly logger: Logger

  /**
   * Create a new OpenAI embedding service
   *
   * @param config - Configuration including API key and model settings
   * @throws {Error} If API key is missing or invalid
   */
  constructor(config: OpenAIEmbeddingConfig) {
    super()

    if (!config) {
      throw new Error("Configuration is required for OpenAI embedding service")
    }

    // Validate API key
    const apiKey = config.apiKey || process.env.DFM_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "API key is required for OpenAI embedding service. Set DFM_OPENAI_API_KEY environment variable."
      )
    }

    this.apiKey = apiKey

    // Validate and set model, defaulting to text-embedding-3-small if invalid
    const modelCandidate =
      config.model ||
      process.env.DFM_OPENAI_EMBEDDING_MODEL ||
      "text-embedding-3-small"

    const modelValidation = OpenAIEmbeddingModelValidator(modelCandidate)
    if (modelValidation instanceof type.errors) {
      // Invalid model, use default and log warning
      this.model = "text-embedding-3-small"
      const logger = config.logger ?? createNoOpLogger()
      logger.warn(
        `Invalid OpenAI embedding model "${modelCandidate}", using default: text-embedding-3-small`
      )
    } else {
      this.model = modelValidation
    }

    this.dimensions = config.dimensions || DEFAULT_VECTOR_DIMENSIONS
    this.version = config.version || "3.0.0"
    this.apiEndpoint = "https://api.openai.com/v1/embeddings"
    this.logger = config.logger ?? createNoOpLogger()

    this.logger.info("OpenAIEmbeddingService initialized", {
      model: this.model,
      dimensions: this.dimensions,
      version: this.version,
    })
  }

  /**
   * Generate an embedding for a single text
   *
   * @param text - Text to generate embedding for
   * @returns Promise resolving to normalized embedding vector
   * @throws {Error} If API call fails
   */
  override async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      const error = new Error("No OpenAI API key available")
      this.logger.error("OpenAI API key missing", error)
      throw error
    }

    this.logger.debug("Generating OpenAI embedding", {
      textLength: text.length,
      textPreview: text.substring(0, TEXT_PREVIEW_LENGTH),
      model: this.model,
    })

    const result = await fetchData(
      this.apiEndpoint,
      OpenAIEmbeddingResponseValidator,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: {
          input: text,
          model: this.model,
        },
        timeout: EMBEDDING_REQUEST_TIMEOUT_MS,
      }
    )

    if (result.error) {
      const error = new Error(result.error.message)
      this.logger.error("OpenAI API request failed", error, {
        status: result.error.status,
      })
      throw error
    }

    if (!result.data) {
      const error = new Error("No data returned from OpenAI API")
      this.logger.error("Invalid API response", error)
      throw error
    }

    const firstItem = result.data.data[0]
    if (!firstItem) {
      const error = new Error("No embedding data in response")
      this.logger.error("Invalid API response", error, {
        responseData: result.data,
      })
      throw error
    }

    const embedding = firstItem.embedding
    if (!embedding) {
      const error = new Error("No embedding returned from OpenAI API")
      this.logger.error("Invalid API response", error, {
        responseData: result.data,
      })
      throw error
    }

    this.logger.debug("OpenAI embedding generated successfully", {
      dimensions: embedding.length,
      tokensUsed: result.data.usage.total_tokens,
    })

    // Normalize the vector
    this.normalizeVector(embedding)

    return embedding
  }

  /**
   * Generate embeddings for multiple texts in a single API call
   *
   * More efficient than calling generateEmbedding() multiple times.
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise resolving to array of normalized embedding vectors
   * @throws {Error} If API call fails
   */
  override async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      const error = new Error("No OpenAI API key available")
      this.logger.error("OpenAI API key missing", error)
      throw error
    }

    if (texts.length === 0) {
      this.logger.warn("generateEmbeddings called with empty array")
      return []
    }

    this.logger.debug("Generating batch OpenAI embeddings", {
      count: texts.length,
      model: this.model,
    })

    const result = await fetchData(
      this.apiEndpoint,
      OpenAIEmbeddingResponseValidator,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: {
          input: texts,
          model: this.model,
        },
        timeout: EMBEDDING_BATCH_TIMEOUT_MS,
      }
    )

    if (result.error) {
      const error = new Error(result.error.message)
      this.logger.error("OpenAI batch API request failed", error, {
        status: result.error.status,
        textsCount: texts.length,
      })
      throw error
    }

    if (!result.data) {
      const error = new Error("No data returned from OpenAI API")
      this.logger.error("Invalid batch API response", error)
      throw error
    }

    if (!result.data.data || result.data.data.length === 0) {
      const error = new Error("No embeddings returned from OpenAI API")
      this.logger.error("Invalid batch API response", error, {
        responseData: result.data,
      })
      throw error
    }

    // Sort by index to ensure correct order
    const sortedData = [...result.data.data].sort((a, b) => a.index - b.index)

    const embeddings = sortedData.map((item) => item.embedding)

    this.logger.debug("Batch OpenAI embeddings generated successfully", {
      count: embeddings.length,
      tokensUsed: result.data.usage.total_tokens,
    })

    // Normalize all vectors
    for (const embedding of embeddings) {
      this.normalizeVector(embedding)
    }

    return embeddings
  }

  /**
   * Get information about the embedding model
   *
   * @returns Model metadata
   */
  override getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.model,
      dimensions: this.dimensions,
      version: this.version,
    }
  }

  /**
   * Normalize a vector to unit length (magnitude = 1)
   *
   * This is required for cosine similarity calculations.
   * Modifies the vector in place for efficiency.
   *
   * @param vector - Vector to normalize (modified in place)
   */
  private normalizeVector(vector: number[]): void {
    // Calculate magnitude (Euclidean norm)
    let magnitude = 0
    // biome-ignore lint/style/useForOf: performance
    for (let i = 0; i < vector.length; i++) {
      const value = vector[i]
      if (value !== undefined) {
        magnitude += value * value
      }
    }
    magnitude = Math.sqrt(magnitude)

    // Avoid division by zero
    if (magnitude > 0) {
      // Normalize each component
      for (let i = 0; i < vector.length; i++) {
        const value = vector[i]
        if (value !== undefined) {
          vector[i] = value / magnitude
        }
      }
    } else {
      // If magnitude is 0, create a valid unit vector
      this.logger.warn("Zero magnitude vector detected, creating unit vector")
      if (vector.length > 0) {
        vector[0] = 1
      }
    }
  }
}
