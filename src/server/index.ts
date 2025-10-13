/**
 * MCP Server
 * Main Model Context Protocol server initialization and startup logic
 *
 * This module handles:
 * - Storage provider initialization (Neo4j)
 * - Embedding service setup (OpenAI)
 * - Knowledge graph manager creation
 * - MCP server configuration and startup
 *
 * Architecture:
 * The server uses a layered architecture:
 * 1. Storage Layer (Neo4j) - Persists entities, relations, and embeddings
 * 2. Embedding Layer (OpenAI) - Generates vector embeddings for semantic search
 * 3. Knowledge Graph Layer - Manages entities and relations
 * 4. MCP Protocol Layer - Exposes tools via Model Context Protocol
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { env } from "#config.ts"
import { initializeStorageProvider } from "#config.ts"
import { EmbeddingJobManager } from "#embeddings/embedding-job-manager.ts"
import { EmbeddingServiceFactory } from "#embeddings/embedding-service-factory.ts"
import type { Entity } from "#knowledge-graph-manager.ts"
import { KnowledgeGraphManager } from "#knowledge-graph-manager.ts"
import { logger } from "#logger.ts"
import { setupServer } from "#server/setup.ts"
import type { StorageProvider } from "#storage/storage-provider.ts"
import type { VectorStoreFactoryOptions } from "#storage/vector-store-factory.ts"
import type { EntityEmbedding } from "#types/entity-embedding.ts"

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Storage provider with updateEntityEmbedding support
 * Used for type-safe access to embedding update functionality
 */
interface StorageProviderWithUpdateEmbedding extends StorageProvider {
  updateEntityEmbedding(
    entityName: string,
    embedding: EntityEmbedding
  ): Promise<void>
}

/**
 * Storage provider with vector store options
 * Allows passing through vector store configuration
 */
interface StorageProviderWithVectorStoreOptions extends StorageProvider {
  vectorStoreOptions?: VectorStoreFactoryOptions
}

/**
 * Storage provider with getEntity support
 * Used for retrieving entity data
 */
interface StorageProviderWithGetEntity extends StorageProvider {
  getEntity(name: string): Promise<unknown>
}

/**
 * Adapted storage provider interface
 * Provides compatibility layer for EmbeddingJobManager which expects SQLite-like interface
 */
interface AdaptedStorageProvider extends StorageProvider {
  db: {
    exec: (sql: string) => null
    prepare: () => {
      run: () => null
      all: () => never[]
      get: () => null
    }
  }
  getEntity: (name: string) => Promise<Entity | null>
  storeEntityVector: (
    name: string,
    embedding: EntityEmbedding | number[]
  ) => Promise<void>
}

/**
 * Internal KnowledgeGraphManager interface
 * Used to access private storageProvider property for adapter injection
 */
type KnowledgeGraphManagerInternal = {
  storageProvider?: StorageProvider & {
    storeEntityVector?: (
      name: string,
      embedding: EntityEmbedding | number[]
    ) => Promise<void>
    updateEntityEmbedding?: (
      entityName: string,
      embedding: EntityEmbedding
    ) => Promise<void>
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if storage provider supports updateEntityEmbedding
 */
function hasUpdateEntityEmbedding(
  provider: StorageProvider
): provider is StorageProviderWithUpdateEmbedding {
  return (
    "updateEntityEmbedding" in provider &&
    typeof (provider as StorageProviderWithUpdateEmbedding)
      .updateEntityEmbedding === "function"
  )
}

/**
 * Check if storage provider has vector store options
 */
function hasVectorStoreOptions(
  provider: StorageProvider
): provider is StorageProviderWithVectorStoreOptions {
  return "vectorStoreOptions" in provider
}

/**
 * Check if storage provider supports getEntity
 */
function hasGetEntity(
  provider: StorageProvider
): provider is StorageProviderWithGetEntity {
  return (
    "getEntity" in provider &&
    typeof (provider as StorageProviderWithGetEntity).getEntity === "function"
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize embedding to consistent format
 * Converts array format to EntityEmbedding object with metadata
 */
function normalizeEmbedding(
  embedding: EntityEmbedding | number[]
): EntityEmbedding {
  if (Array.isArray(embedding)) {
    return {
      vector: embedding,
      model: "unknown",
      lastUpdated: Date.now(),
    }
  }
  return {
    vector: embedding.vector,
    model: embedding.model || "unknown",
    lastUpdated: embedding.lastUpdated || Date.now(),
  }
}

/**
 * Wrap KnowledgeGraphManager.createEntities to process embeddings immediately
 * This ensures embeddings are generated right after entity creation for better UX
 */
function wrapCreateEntitiesWithEmbeddingProcessing(
  manager: KnowledgeGraphManager,
  embeddingManager: EmbeddingJobManager | undefined
): void {
  if (!manager || typeof manager.createEntities !== "function") {
    return
  }

  const originalCreateEntities = manager.createEntities.bind(manager)
  manager.createEntities = async (entities) => {
    // First call the original method to create the entities
    const result = await originalCreateEntities(entities)

    // Then process jobs immediately if we have an embedding job manager
    if (embeddingManager) {
      try {
        logger.info(
          "Processing embedding jobs immediately after entity creation",
          {
            entityCount: entities.length,
            entityNames: entities.map((e) => e.name).join(", "),
          }
        )
        await embeddingManager.processJobs(entities.length)
      } catch (error) {
        logger.error("Error processing embedding jobs immediately", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }

    return result
  }
}

/**
 * Create adapter function for storeEntityVector
 * Bridges between EmbeddingJobManager expectations and Neo4j provider API
 */
function createStoreEntityVectorAdapter(
  provider: StorageProvider & {
    updateEntityEmbedding?: (
      entityName: string,
      embedding: EntityEmbedding
    ) => Promise<void>
  }
): (name: string, embedding: EntityEmbedding | number[]) => Promise<void> {
  return async (name: string, embedding: EntityEmbedding | number[]) => {
    logger.debug(
      `Neo4j knowledgeGraphManager adapter: storeEntityVector called for ${name}`,
      {
        embeddingType: typeof embedding,
        vectorLength: Array.isArray(embedding)
          ? embedding.length
          : embedding?.vector?.length || "no vector",
        model: Array.isArray(embedding) ? "unknown" : embedding?.model,
      }
    )

    const formattedEmbedding = normalizeEmbedding(embedding)

    if (!provider) {
      throw new Error("Storage provider is not available")
    }

    if (typeof provider.updateEntityEmbedding === "function") {
      try {
        logger.debug(
          `Neo4j knowledgeGraphManager adapter: Using updateEntityEmbedding for ${name}`
        )
        return await provider.updateEntityEmbedding(name, formattedEmbedding)
      } catch (error) {
        logger.error(
          `Neo4j knowledgeGraphManager adapter: Error in storeEntityVector for ${name}`,
          error
        )
        throw error
      }
    }
    const errorMsg = `Neo4j knowledgeGraphManager adapter: updateEntityEmbedding not implemented for ${name}`
    logger.error(errorMsg)
    throw new Error(errorMsg)
  }
}

// ============================================================================
// Main Server Initialization
// ============================================================================

/**
 * Start the MCP Server
 *
 * Initializes and starts the Model Context Protocol server with:
 * - Neo4j storage backend
 * - OpenAI embedding service
 * - Knowledge graph management
 * - stdio transport for communication
 *
 * Environment Variables:
 * - DFM_OPENAI_API_KEY: OpenAI API key for embeddings (optional, uses random if missing)
 * - DFM_EMBEDDING_RATE_LIMIT_TOKENS: Rate limit for embedding requests (default: from env config)
 * - DFM_EMBEDDING_RATE_LIMIT_INTERVAL: Rate limit interval in ms (default: from env config)
 * - NEO4J_*: Neo4j connection settings (see config.ts)
 *
 * @throws {Error} If server initialization fails
 */
export default async function startMcpServer(): Promise<void> {
  try {
    logger.info("Starting DevFlow MCP server...")

    // ========================================================================
    // Step 1: Initialize Storage Provider (Neo4j)
    // ========================================================================
    logger.debug("Initializing storage provider...")
    const storageProvider = initializeStorageProvider()

    // ========================================================================
    // Step 2: Initialize Embedding Service and Job Manager
    // ========================================================================
    let embeddingJobManager: EmbeddingJobManager | undefined

    try {
      // Log configuration for troubleshooting
      logger.debug("Embedding configuration:", {
        hasApiKey: !!env.DFM_OPENAI_API_KEY,
        model: env.DFM_OPENAI_EMBEDDING_MODEL,
        storageType: env.DFM_STORAGE_TYPE,
      })

      // Warn if API key is missing
      if (env.DFM_OPENAI_API_KEY) {
        logger.info("OpenAI API key found, will use for generating embeddings")
      } else {
        logger.warn(
          "DFM_OPENAI_API_KEY environment variable is not set. Semantic search will use random embeddings."
        )
      }

      // Initialize the embedding service
      const embeddingService = EmbeddingServiceFactory.createFromEnvironment()
      logger.debug(
        `Embedding service initialized: ${JSON.stringify(embeddingService.getModelInfo())}`
      )

      // Configure rate limiting to prevent API abuse
      const rateLimiterOptions = {
        tokensPerInterval: env.DFM_EMBEDDING_RATE_LIMIT_TOKENS,
        interval: env.DFM_EMBEDDING_RATE_LIMIT_INTERVAL,
      }

      logger.info("Initializing EmbeddingJobManager", {
        rateLimiterOptions,
        model: embeddingService.getModelInfo().name,
        storageType: env.DFM_STORAGE_TYPE,
      })

      // Create adapted storage provider for EmbeddingJobManager
      // This provides compatibility with the SQLite-like interface it expects
      const adaptedStorageProvider: AdaptedStorageProvider = {
        ...storageProvider,
        // Provide stub db interface for compatibility
        db: {
          exec: (sql: string) => {
            logger.debug(`Neo4j adapter: Received SQL: ${sql}`)
            return null
          },
          prepare: () => ({
            run: () => null,
            all: () => [],
            get: () => null,
          }),
        },
        // Ensure getEntity is available
        getEntity: async (name: string): Promise<Entity | null> => {
          if (hasGetEntity(storageProvider)) {
            const entity = await storageProvider.getEntity(name)
            return entity as Entity | null
          }
          const result = await storageProvider.openNodes([name])
          return (result.entities[0] as Entity | undefined) ?? null
        },
        // Ensure storeEntityVector is available
        storeEntityVector: async (
          name: string,
          embedding: EntityEmbedding | number[]
        ) => {
          logger.debug(`Neo4j adapter: storeEntityVector called for ${name}`, {
            embeddingType: typeof embedding,
            vectorLength: Array.isArray(embedding)
              ? embedding.length
              : embedding?.vector?.length || "no vector",
            model: Array.isArray(embedding) ? "unknown" : embedding?.model,
          })

          const formattedEmbedding = normalizeEmbedding(embedding)

          if (hasUpdateEntityEmbedding(storageProvider)) {
            try {
              logger.debug(
                `Neo4j adapter: Using updateEntityEmbedding for ${name}`
              )
              return await storageProvider.updateEntityEmbedding(
                name,
                formattedEmbedding
              )
            } catch (error) {
              logger.error(
                `Neo4j adapter: Error in storeEntityVector for ${name}`,
                error
              )
              throw error
            }
          }
          const errorMsg = `Neo4j adapter: updateEntityEmbedding not implemented for ${name}`
          logger.error(errorMsg)
          throw new Error(errorMsg)
        },
      }

      // Create the embedding job manager
      embeddingJobManager = new EmbeddingJobManager(
        adaptedStorageProvider,
        embeddingService,
        rateLimiterOptions,
        null, // Use default cache options
        logger
      )

      // Schedule periodic processing for embedding jobs
      const EMBEDDING_PROCESS_INTERVAL = 10_000 // 10 seconds
      const EMBEDDING_BATCH_SIZE = 10
      setInterval(async () => {
        try {
          await embeddingJobManager?.processJobs(EMBEDDING_BATCH_SIZE)
        } catch (error) {
          logger.error("Error in scheduled job processing", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          })
        }
      }, EMBEDDING_PROCESS_INTERVAL)

      logger.info("Embedding job manager initialized successfully")
    } catch (error) {
      // Fail gracefully if embedding job manager initialization fails
      logger.error("Failed to initialize EmbeddingJobManager", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      embeddingJobManager = undefined
    }

    // ========================================================================
    // Step 3: Create Knowledge Graph Manager
    // ========================================================================
    logger.debug("Creating knowledge graph manager...")
    const knowledgeGraphManager = new KnowledgeGraphManager({
      storageProvider,
      embeddingJobManager,
      // Pass vector store options from storage provider if available
      vectorStoreOptions: hasVectorStoreOptions(storageProvider)
        ? storageProvider.vectorStoreOptions
        : undefined,
    })

    // Inject storeEntityVector adapter if needed
    const knowledgeGraphManagerInternal =
      knowledgeGraphManager as unknown as KnowledgeGraphManagerInternal

    if (
      knowledgeGraphManagerInternal.storageProvider &&
      typeof knowledgeGraphManagerInternal.storageProvider.storeEntityVector !==
        "function"
    ) {
      knowledgeGraphManagerInternal.storageProvider.storeEntityVector =
        createStoreEntityVectorAdapter(
          knowledgeGraphManagerInternal.storageProvider
        )

      logger.info(
        "Added storeEntityVector adapter method to Neo4j storage provider for KnowledgeGraphManager"
      )
    }

    // Wrap createEntities for immediate embedding processing
    wrapCreateEntitiesWithEmbeddingProcessing(
      knowledgeGraphManager,
      embeddingJobManager
    )

    // ========================================================================
    // Step 4: Setup and Start MCP Server
    // ========================================================================
    logger.debug("Setting up MCP server...")
    const server = setupServer(knowledgeGraphManager)

    logger.info("Starting MCP server on stdio transport...")
    const transport = new StdioServerTransport()
    await server.connect(transport)

    logger.info("MCP server started successfully")
  } catch (error) {
    logger.error("Failed to start MCP server", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}
