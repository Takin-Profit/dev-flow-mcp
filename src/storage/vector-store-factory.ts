/**
 * Vector Store Factory
 *
 * Factory for creating VectorStore instances with proper dependency injection.
 * Currently supports Neo4j as the vector storage backend.
 *
 * Design Notes:
 * - Uses static factory methods for service creation
 * - Accepts logger for dependency injection
 * - Supports lazy or immediate initialization
 * - Type-safe configuration with proper defaults
 */

import type { Neo4jConfig } from "#storage/neo4j/neo4j-config.ts"
import { Neo4jConnectionManager } from "#storage/neo4j/neo4j-connection-manager.ts"
import { Neo4jVectorStore } from "#storage/neo4j/neo4j-vector-store.ts"
import type { Logger } from "#types"
import { createNoOpLogger } from "#types"
import type { VectorStore } from "#types/vector-store.ts"

/**
 * Supported vector store types
 */
export type VectorStoreType = "neo4j"

/**
 * Similarity functions for vector search
 */
export type VectorSimilarityFunction = "cosine" | "euclidean"

/**
 * Configuration options for vector store factory
 */
export type VectorStoreFactoryOptions = {
  /**
   * The type of vector store to use
   * @default 'neo4j'
   */
  type?: VectorStoreType

  /**
   * Neo4j configuration options (required for neo4j type)
   */
  neo4jConfig?: Neo4jConfig

  /**
   * Neo4j vector index name
   * @default 'entity_embeddings'
   */
  indexName?: string

  /**
   * Dimensions for vector embeddings
   * @default 1536 (OpenAI text-embedding-3-small)
   */
  dimensions?: number

  /**
   * Similarity function for vector search
   * @default 'cosine'
   */
  similarityFunction?: VectorSimilarityFunction

  /**
   * Whether to initialize the vector store immediately
   * If false, you must call initialize() manually
   * @default false
   */
  initializeImmediately?: boolean

  /**
   * Logger instance for dependency injection
   */
  logger?: Logger
}

/**
 * Factory class for creating VectorStore instances
 *
 * This factory:
 * - Creates vector store instances based on configuration
 * - Injects logger dependencies
 * - Supports lazy or immediate initialization
 * - Provides type-safe configuration
 */
export class VectorStoreFactory {
  /**
   * Create a new VectorStore instance based on configuration
   *
   * @param options - Configuration options including type, config, and logger
   * @returns Initialized or uninitialized VectorStore instance
   * @throws {Error} If vector store type is unsupported or required config is missing
   */
  static async createVectorStore(
    options: VectorStoreFactoryOptions = {}
  ): Promise<VectorStore> {
    const storeType = options.type || "neo4j"
    const initializeImmediately = options.initializeImmediately ?? false
    const logger = options.logger ?? createNoOpLogger()

    logger.debug("Creating vector store", {
      type: storeType,
      initializeImmediately,
      indexName: options.indexName,
      dimensions: options.dimensions,
    })

    let vectorStore: VectorStore

    if (storeType === "neo4j") {
      logger.info("Creating Neo4jVectorStore instance", {
        indexName: options.indexName || "entity_embeddings",
        dimensions: options.dimensions || 1536,
        similarityFunction: options.similarityFunction || "cosine",
      })

      // Ensure Neo4j config is provided
      if (!options.neo4jConfig) {
        const error = new Error(
          "Neo4j configuration is required for Neo4j vector store"
        )
        logger.error("Missing Neo4j configuration", error)
        throw error
      }

      // Create connection manager
      const connectionManager = new Neo4jConnectionManager(options.neo4jConfig)

      // Create vector store with logger injection
      vectorStore = new Neo4jVectorStore({
        connectionManager,
        indexName: options.indexName || "entity_embeddings",
        dimensions: options.dimensions || 1536,
        similarityFunction: options.similarityFunction || "cosine",
        logger,
      })

      logger.debug("Neo4jVectorStore instance created successfully")
    } else {
      const error = new Error(`Unsupported vector store type: ${storeType}`)
      logger.error("Unsupported vector store type", error, { storeType })
      throw error
    }

    // Initialize if requested
    if (initializeImmediately) {
      logger.debug("Initializing vector store immediately")
      try {
        await vectorStore.initialize()
        logger.info("Vector store initialized successfully")
      } catch (error) {
        logger.error("Failed to initialize vector store", error)
        throw error
      }
    } else {
      logger.debug(
        "Vector store created but not initialized (lazy initialization)"
      )
    }

    return vectorStore
  }
}
