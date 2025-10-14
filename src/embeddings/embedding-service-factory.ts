/**
 * Embedding Service Factory
 *
 * Factory for creating embedding service instances with proper dependency injection.
 * Supports multiple embedding providers (OpenAI, Default/Mock) with a registry pattern.
 *
 * Design Notes:
 * - Uses static factory methods for service creation
 * - Accepts logger for dependency injection
 * - Provides convenient createFromEnvironment() method for standard initialization
 * - Uses DFM_ prefixed environment variables
 */

import { DefaultEmbeddingService } from "#embeddings/default-embedding-service"
import type { EmbeddingService } from "#embeddings/embedding-service"
import { OpenAIEmbeddingService } from "#embeddings/openai-embedding-service"
import type { Logger } from "#types"
import { createNoOpLogger } from "#types"

/**
 * Configuration options for embedding services
 */
export type EmbeddingServiceConfig = {
  provider?: string
  model?: string
  dimensions?: number
  apiKey?: string
  logger?: Logger
  [key: string]: unknown
}

/**
 * Type definition for embedding service provider creation function
 */
type EmbeddingServiceProvider = (
  config?: EmbeddingServiceConfig
) => EmbeddingService

/**
 * Factory for creating embedding services with dependency injection
 *
 * This factory:
 * - Creates embedding service instances
 * - Injects logger dependencies
 * - Supports multiple providers via registry
 * - Provides convenient environment-based creation
 * - Uses DFM_ prefixed environment variables
 */
export class EmbeddingServiceFactory {
  /**
   * Registry of embedding service providers
   */
  private static providers: Record<string, EmbeddingServiceProvider> = {}

  /**
   * Register a new embedding service provider
   *
   * @param name - Provider name
   * @param provider - Provider factory function
   */
  static registerProvider(
    name: string,
    provider: EmbeddingServiceProvider
  ): void {
    EmbeddingServiceFactory.providers[name.toLowerCase()] = provider
  }

  /**
   * Reset the provider registry - used primarily for testing
   */
  static resetRegistry(): void {
    EmbeddingServiceFactory.providers = {}
  }

  /**
   * Get a list of available provider names
   *
   * @returns Array of provider names
   */
  static getAvailableProviders(): string[] {
    return Object.keys(EmbeddingServiceFactory.providers)
  }

  /**
   * Create a service using a registered provider
   *
   * @param config - Configuration options including provider name and service-specific settings
   * @returns The created embedding service
   * @throws {Error} if the provider is not registered
   */
  static createService(config: EmbeddingServiceConfig = {}): EmbeddingService {
    const providerName = (config.provider || "default").toLowerCase()
    const logger = config.logger || createNoOpLogger()

    logger.debug(
      `EmbeddingServiceFactory: Creating service with provider "${providerName}"`
    )

    const providerFn = EmbeddingServiceFactory.providers[providerName]

    if (providerFn) {
      try {
        const service = providerFn(config)
        logger.debug(
          `EmbeddingServiceFactory: Service created successfully with provider "${providerName}"`,
          {
            modelInfo: service.getModelInfo(),
          }
        )
        return service
      } catch (error) {
        logger.error(
          `EmbeddingServiceFactory: Failed to create service with provider "${providerName}"`,
          error
        )
        throw error
      }
    }

    // If provider not found, throw an error
    logger.error(
      `EmbeddingServiceFactory: Provider "${providerName}" is not registered`
    )
    throw new Error(`Provider "${providerName}" is not registered`)
  }

  /**
   * Create an embedding service from environment variables
   *
   * This is the primary method used by the application to create embedding services.
   * It reads configuration from DFM_ prefixed environment variables.
   *
   * Environment Variables:
   * - DFM_MOCK_EMBEDDINGS: Use mock embeddings for testing
   * - DFM_OPENAI_API_KEY: OpenAI API key
   * - DFM_OPENAI_EMBEDDING_MODEL: Embedding model name
   *
   * @param logger - Logger instance for dependency injection
   * @returns An embedding service implementation
   */
  static createFromEnvironment(logger?: Logger): EmbeddingService {
    const effectiveLogger = logger || createNoOpLogger()

    // Check if we should use mock embeddings (for testing)
    const useMockEmbeddings = process.env.DFM_MOCK_EMBEDDINGS === "true"

    effectiveLogger.debug(
      "EmbeddingServiceFactory: Creating service from environment variables",
      {
        mockEmbeddings: useMockEmbeddings,
        openaiKeyPresent: !!process.env.DFM_OPENAI_API_KEY,
        embeddingModel: process.env.DFM_OPENAI_EMBEDDING_MODEL || "default",
      }
    )

    if (useMockEmbeddings) {
      effectiveLogger.info("EmbeddingServiceFactory: Using mock embeddings for testing")
      return new DefaultEmbeddingService({ logger: effectiveLogger })
    }

    const openaiApiKey = process.env.DFM_OPENAI_API_KEY
    const embeddingModel =
      process.env.DFM_OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"

    if (openaiApiKey) {
      try {
        effectiveLogger.debug(
          "EmbeddingServiceFactory: Creating OpenAI embedding service",
          {
            model: embeddingModel,
          }
        )
        const service = new OpenAIEmbeddingService({
          apiKey: openaiApiKey,
          model: embeddingModel,
          logger: effectiveLogger,
        })
        effectiveLogger.info(
          "EmbeddingServiceFactory: OpenAI embedding service created successfully",
          {
            model: service.getModelInfo().name,
            dimensions: service.getModelInfo().dimensions,
          }
        )
        return service
      } catch (error) {
        effectiveLogger.error(
          "EmbeddingServiceFactory: Failed to create OpenAI service",
          error
        )
        effectiveLogger.info(
          "EmbeddingServiceFactory: Falling back to default embedding service"
        )
        // Fallback to default if OpenAI service creation fails
        return new DefaultEmbeddingService({ logger: effectiveLogger })
      }
    }

    // No OpenAI API key, using default embedding service
    effectiveLogger.info(
      "EmbeddingServiceFactory: No OpenAI API key found, using default embedding service"
    )
    return new DefaultEmbeddingService({ logger: effectiveLogger })
  }

  /**
   * Create an OpenAI embedding service
   *
   * @param apiKey - OpenAI API key
   * @param model - Optional model name
   * @param dimensions - Optional embedding dimensions
   * @param logger - Optional logger instance
   * @returns OpenAI embedding service
   */
  static createOpenAIService(
    apiKey: string,
    model?: string,
    dimensions?: number,
    logger?: Logger
  ): EmbeddingService {
    return new OpenAIEmbeddingService({
      apiKey,
      model,
      dimensions,
      logger,
    })
  }

  /**
   * Create a default embedding service that generates deterministic vectors
   *
   * @param dimensions - Optional embedding dimensions
   * @param logger - Optional logger instance
   * @returns Default embedding service
   */
  static createDefaultService(dimensions?: number, logger?: Logger): EmbeddingService {
    return new DefaultEmbeddingService({ dimensions, logger })
  }
}

// ============================================================================
// Register Built-in Providers
// ============================================================================

EmbeddingServiceFactory.registerProvider(
  "default",
  (config = {}) => new DefaultEmbeddingService({
    dimensions: config.dimensions,
    logger: config.logger
  })
)

EmbeddingServiceFactory.registerProvider("openai", (config = {}) => {
  if (!config.apiKey) {
    throw new Error("API key is required for OpenAI embedding service")
  }

  return new OpenAIEmbeddingService({
    apiKey: config.apiKey,
    model: config.model,
    dimensions: config.dimensions,
    logger: config.logger,
  })
})
