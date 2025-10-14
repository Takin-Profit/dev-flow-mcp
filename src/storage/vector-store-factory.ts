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

import type { Neo4jConfig } from "#storage/neo4j/neo4j-config"
import { Neo4jConnectionManager } from "#storage/neo4j/neo4j-connection-manager"
import { Neo4jVectorStore } from "#storage/neo4j/neo4j-vector-store"
import type { Logger, VectorStore } from "#types"
import { createNoOpLogger } from "#types"

// ============================================================================
// Constants
// ============================================================================

/**
 * Default vector dimensions for OpenAI text-embedding-3-small model
 */
const DEFAULT_VECTOR_DIMENSIONS = 1536

/**
 * Default vector index name in Neo4j
 */
const DEFAULT_INDEX_NAME = "entity_embeddings"

/**
 * Default similarity function for vector search
 */
const DEFAULT_SIMILARITY_FUNCTION = "cosine"

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a Neo4j vector store instance
 */
function createNeo4jVectorStore(
  options: VectorStoreFactoryOptions,
  logger: Logger
): VectorStore {
  const indexName = options.indexName || DEFAULT_INDEX_NAME
  const dimensions = options.dimensions || DEFAULT_VECTOR_DIMENSIONS
  const similarityFunction =
    options.similarityFunction || DEFAULT_SIMILARITY_FUNCTION

  logger.info("Creating Neo4jVectorStore instance", {
    indexName,
    dimensions,
    similarityFunction,
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
  const vectorStore = new Neo4jVectorStore({
    connectionManager,
    indexName,
    dimensions,
    similarityFunction,
    logger,
  })

  logger.debug("Neo4jVectorStore instance created successfully")
  return vectorStore
}

/**
 * Initialize vector store if requested
 */
async function initializeIfNeeded(
  vectorStore: VectorStore,
  initializeImmediately: boolean,
  logger: Logger
): Promise<void> {
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
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Factory for creating VectorStore instances
 *
 * This factory:
 * - Creates vector store instances based on configuration
 * - Injects logger dependencies
 * - Supports lazy or immediate initialization
 * - Provides type-safe configuration
 */
export const VectorStoreFactory = Object.freeze({
  /**
   * Create a new VectorStore instance based on configuration
   *
   * @param options - Configuration options including type, config, and logger
   * @returns Initialized or uninitialized VectorStore instance
   * @throws {Error} If vector store type is unsupported or required config is missing
   */
  async createVectorStore(
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

    // Create vector store based on type
    let vectorStore: VectorStore

    if (storeType === "neo4j") {
      vectorStore = createNeo4jVectorStore(options, logger)
    } else {
      const error = new Error(`Unsupported vector store type: ${storeType}`)
      logger.error("Unsupported vector store type", error, { storeType })
      throw error
    }

    // Initialize if requested
    await initializeIfNeeded(vectorStore, initializeImmediately, logger)

    return vectorStore
  },
})
