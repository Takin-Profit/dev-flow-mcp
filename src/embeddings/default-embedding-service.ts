/**
 * Default Embedding Service
 *
 * Fallback embedding implementation that generates deterministic random vectors.
 * Used for testing, development, or when no external API provider is available.
 *
 * Design Notes:
 * - Generates deterministic embeddings (same input → same output)
 * - Uses seeded random generation for consistency in tests
 * - Produces normalized unit vectors compatible with cosine similarity
 * - Accepts logger via constructor injection (dependency inversion)
 */

import {
  type EmbeddingModelInfo,
  EmbeddingService,
} from "#embeddings/embedding-service"
import type { Logger } from "#types"
import { createNoOpLogger } from "#types"

// ============================================================================
// Constants
// ============================================================================

/**
 * Default dimensions for OpenAI text-embedding-3-small compatibility
 */
const OPENAI_SMALL_DIMENSIONS = 1536

/**
 * Default dimensions for DFM mock embeddings
 */
const DFM_MOCK_DIMENSIONS = 384

/**
 * Default model version
 */
const DEFAULT_MODEL_VERSION = "1.0.0"

/**
 * Length of text preview in debug logs
 */
const TEXT_PREVIEW_LENGTH = 50

/**
 * Seed multiplier for random number generation
 */
const RANDOM_SEED_MULTIPLIER = 10_000

/**
 * Bit shift for hash calculation
 */
const HASH_BIT_SHIFT = 5

/**
 * Configuration for default embedding service
 */
export type DefaultEmbeddingConfig = {
  /** Embedding vector dimensions (default: 1536 for OpenAI compatibility) */
  dimensions?: number
  /** Model name for identification (default: text-embedding-3-small-mock) */
  model?: string
  /** Model version string (default: 1.0.0) */
  version?: string
  /** Logger instance for dependency injection */
  logger?: Logger
}

/**
 * Default embedding service that generates deterministic pseudo-random vectors
 *
 * This service:
 * - Generates consistent embeddings for the same input text
 * - Normalizes vectors to unit length for cosine similarity
 * - Provides OpenAI-compatible dimensions by default
 * - Logs operations for observability
 */
export class DefaultEmbeddingService extends EmbeddingService {
  private readonly dimensions: number
  private readonly modelName: string
  private readonly modelVersion: string
  private readonly logger: Logger

  /**
   * Create a new default embedding service
   *
   * @param config - Configuration options
   */
  constructor(config: DefaultEmbeddingConfig = {}) {
    super()

    // Determine if we're in mock mode
    const isMockMode = process.env.DFM_MOCK_EMBEDDINGS === "true"

    // Set defaults based on mode
    const defaultDimensions = isMockMode
      ? OPENAI_SMALL_DIMENSIONS
      : DFM_MOCK_DIMENSIONS
    const defaultModel = isMockMode
      ? "text-embedding-3-small-mock"
      : "dfm-mcp-mock"

    this.dimensions = config.dimensions ?? defaultDimensions
    this.modelName = config.model ?? defaultModel
    this.modelVersion = config.version ?? DEFAULT_MODEL_VERSION
    this.logger = config.logger ?? createNoOpLogger()

    if (isMockMode) {
      this.logger.info("DefaultEmbeddingService initialized in mock mode", {
        dimensions: this.dimensions,
        model: this.modelName,
      })
    } else {
      this.logger.debug("DefaultEmbeddingService initialized", {
        dimensions: this.dimensions,
        model: this.modelName,
      })
    }
  }

  /**
   * Generate a deterministic embedding vector for text
   *
   * The same input text will always produce the same output vector,
   * making this suitable for testing and development.
   *
   * @param text - Text to generate embedding for
   * @returns Promise resolving to normalized embedding vector
   */
  override generateEmbedding(text: string): Promise<number[]> {
    this.logger.debug("Generating embedding", {
      textLength: text.length,
      textPreview: text.substring(0, TEXT_PREVIEW_LENGTH),
    })

    // Generate deterministic embedding based on text hash
    const seed = this.hashString(text)

    // Create vector with seeded random values
    const vector = new Array<number>(this.dimensions)
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = this.seededRandom(seed + i)
    }

    // Normalize to unit length for cosine similarity
    this.normalizeVector(vector)

    return Promise.resolve(vector)
  }

  /**
   * Generate embedding vectors for multiple texts
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise resolving to array of embedding vectors
   */
  override async generateEmbeddings(texts: string[]): Promise<number[][]> {
    this.logger.debug("Generating batch embeddings", {
      count: texts.length,
    })

    const embeddings: number[][] = []
    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text))
    }

    this.logger.debug("Batch embeddings generated", {
      count: embeddings.length,
    })

    return embeddings
  }

  /**
   * Get information about the embedding model
   *
   * @returns Model metadata
   */
  override getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.modelName,
      dimensions: this.dimensions,
      version: this.modelVersion,
    }
  }

  /**
   * Generate a simple hash from a string for deterministic random generation
   *
   * Uses a basic hash algorithm that produces consistent results
   * for the same input string.
   *
   * @param text - Input text to hash
   * @returns Numeric hash value
   */
  private hashString(text: string): number {
    let hash = 0

    if (text.length === 0) {
      return hash
    }

    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      // biome-ignore lint/suspicious/noBitwiseOperators: bitwise operations required for hash algorithm
      hash = (hash << HASH_BIT_SHIFT) - hash + char
      // biome-ignore lint/suspicious/noBitwiseOperators: bitwise AND converts to 32bit integer
      hash &= hash // Convert to 32bit integer
    }

    return hash
  }

  /**
   * Seeded pseudo-random number generator
   *
   * Produces deterministic "random" numbers based on a seed value.
   * Uses sine function for simple but effective pseudo-randomness.
   *
   * @param seed - Seed value
   * @returns Random value between 0 and 1
   */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * RANDOM_SEED_MULTIPLIER
    return x - Math.floor(x)
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
    for (const value of vector) {
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
    } else if (vector.length > 0) {
      // If magnitude is 0, create a valid unit vector
      // Set first element to 1
      vector[0] = 1
    }
  }
}
