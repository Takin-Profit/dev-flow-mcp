#!/usr/bin/env node
import { fileURLToPath } from "node:url"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { initializeStorageProvider } from "#config/storage.ts"
import { EmbeddingJobManager } from "#embeddings/embedding-job-manager.ts"
import { EmbeddingServiceFactory } from "#embeddings/embedding-service-factory.ts"
import type { Entity } from "#knowledge-graph-manager.ts"
import { KnowledgeGraphManager } from "#knowledge-graph-manager.ts"
import { setupServer } from "#server/setup.ts"
import type { StorageProvider } from "#storage/storage-provider.ts"
import type { VectorStoreFactoryOptions } from "#storage/vector-store-factory.ts"
import type { EntityEmbedding } from "#types/entity-embedding.ts"
import { logger } from "#utils/logger.ts"

// Extended interfaces for storage providers with optional methods
interface StorageProviderWithUpdateEmbedding extends StorageProvider {
  updateEntityEmbedding(
    entityName: string,
    embedding: EntityEmbedding
  ): Promise<void>
}

interface StorageProviderWithVectorStoreOptions extends StorageProvider {
  vectorStoreOptions?: VectorStoreFactoryOptions
}

interface StorageProviderWithGetEntity extends StorageProvider {
  getEntity(name: string): Promise<unknown>
}

// Internal storage provider adapter interface
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

// Internal interface to access KnowledgeGraphManager's private properties
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

// Type guard functions
function hasUpdateEntityEmbedding(
  provider: StorageProvider
): provider is StorageProviderWithUpdateEmbedding {
  return (
    "updateEntityEmbedding" in provider &&
    typeof (provider as StorageProviderWithUpdateEmbedding)
      .updateEntityEmbedding === "function"
  )
}

function hasVectorStoreOptions(
  provider: StorageProvider
): provider is StorageProviderWithVectorStoreOptions {
  return "vectorStoreOptions" in provider
}

function hasGetEntity(
  provider: StorageProvider
): provider is StorageProviderWithGetEntity {
  return (
    "getEntity" in provider &&
    typeof (provider as StorageProviderWithGetEntity).getEntity === "function"
  )
}

// Helper to normalize embedding format
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

// Helper to create entity creation wrapper with immediate embedding processing
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

// Helper to create storeEntityVector adapter for storage provider
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

// Check if this module is being run directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)

// Only initialize if running as main module, not when imported by tests
if (isMainModule) {
  ;(async () => {
    // Initialize storage and create KnowledgeGraphManager
    const storageProvider = initializeStorageProvider()

    // Initialize embedding job manager only if storage provider supports it
    let embeddingJobManager: EmbeddingJobManager | undefined
    try {
      // Force debug logging to help troubleshoot
      logger.debug(`OpenAI API key exists: ${!!process.env.OPENAI_API_KEY}`)
      logger.debug(
        `OpenAI Embedding model: ${process.env.OPENAI_EMBEDDING_MODEL || "not set"}`
      )
      logger.debug(
        `Storage provider type: ${process.env.MEMORY_STORAGE_TYPE || "default"}`
      )

      // Ensure OPENAI_API_KEY is defined for embedding generation
      if (process.env.OPENAI_API_KEY) {
        logger.info("OpenAI API key found, will use for generating embeddings")
      } else {
        logger.warn(
          "OPENAI_API_KEY environment variable is not set. Semantic search will use random embeddings."
        )
      }

      // Initialize the embedding service
      const embeddingService = EmbeddingServiceFactory.createFromEnvironment()
      logger.debug(
        `Embedding service model info: ${JSON.stringify(embeddingService.getModelInfo())}`
      )

      // Configure rate limiting options - stricter limits to prevent OpenAI API abuse
      const DEFAULT_RATE_LIMIT_TOKENS = 20 // 20 requests per minute
      const SECONDS_PER_MINUTE = 60
      const MILLISECONDS_PER_SECOND = 1000
      const DEFAULT_RATE_LIMIT_INTERVAL =
        SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND // 1 minute in milliseconds

      const rateLimiterOptions = {
        tokensPerInterval: process.env.EMBEDDING_RATE_LIMIT_TOKENS
          ? Number.parseInt(process.env.EMBEDDING_RATE_LIMIT_TOKENS, 10)
          : DEFAULT_RATE_LIMIT_TOKENS,
        interval: process.env.EMBEDDING_RATE_LIMIT_INTERVAL
          ? Number.parseInt(process.env.EMBEDDING_RATE_LIMIT_INTERVAL, 10)
          : DEFAULT_RATE_LIMIT_INTERVAL,
      }

      logger.info("Initializing EmbeddingJobManager", {
        rateLimiterOptions,
        model: embeddingService.getModelInfo().name,
        storageType: process.env.MEMORY_STORAGE_TYPE || "neo4j",
      })

      // For Neo4j (which is always the storage provider)
      // Create a compatible wrapper for the Neo4j storage provider
      const adaptedStorageProvider: AdaptedStorageProvider = {
        ...storageProvider,
        // Add a fake db with exec function for compatibility
        db: {
          exec: (sql: string) => {
            logger.debug(`Neo4j adapter: Received SQL: ${sql}`)
            // No-op, just for compatibility
            return null
          },
          prepare: () => ({
            run: () => null,
            all: () => [],
            get: () => null,
          }),
        },
        // Make sure getEntity is available
        getEntity: async (name: string): Promise<Entity | null> => {
          if (hasGetEntity(storageProvider)) {
            const entity = await storageProvider.getEntity(name)
            return entity as Entity | null
          }
          const result = await storageProvider.openNodes([name])
          return (result.entities[0] as Entity | undefined) ?? null
        },
        // Make sure storeEntityVector is available
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

          // Ensure embedding has the correct format
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

      // Create the embedding job manager with adapted storage provider
      embeddingJobManager = new EmbeddingJobManager(
        adaptedStorageProvider,
        embeddingService,
        rateLimiterOptions,
        null, // Use default cache options
        logger
      )

      // Schedule periodic processing for embedding jobs
      const EMBEDDING_PROCESS_INTERVAL = 10_000 // 10 seconds - more frequent processing
      setInterval(async () => {
        try {
          // Process pending embedding jobs
          await embeddingJobManager?.processJobs(10)
        } catch (error) {
          // Log error but don't crash
          logger.error("Error in scheduled job processing", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          })
        }
      }, EMBEDDING_PROCESS_INTERVAL)
    } catch (error) {
      // Fail gracefully if embedding job manager initialization fails
      logger.error("Failed to initialize EmbeddingJobManager", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      embeddingJobManager = undefined
    }

    // Create the KnowledgeGraphManager with the storage provider, embedding job manager, and vector store options
    const knowledgeGraphManager = new KnowledgeGraphManager({
      storageProvider,
      embeddingJobManager,
      // Pass vector store options from storage provider if available
      vectorStoreOptions: hasVectorStoreOptions(storageProvider)
        ? storageProvider.vectorStoreOptions
        : undefined,
    })

    // Ensure the storeEntityVector method is available on KnowledgeGraphManager's storageProvider
    // Access internal storageProvider through a known interface
    const knowledgeGraphManagerInternal =
      knowledgeGraphManager as unknown as KnowledgeGraphManagerInternal

    if (
      knowledgeGraphManagerInternal.storageProvider &&
      typeof knowledgeGraphManagerInternal.storageProvider.storeEntityVector !==
        "function"
    ) {
      // Add the storeEntityVector method to the storage provider using the helper
      knowledgeGraphManagerInternal.storageProvider.storeEntityVector =
        createStoreEntityVectorAdapter(
          knowledgeGraphManagerInternal.storageProvider
        )

      logger.info(
        "Added storeEntityVector adapter method to Neo4j storage provider for KnowledgeGraphManager"
      )
    }

    // Use a custom createEntities method for immediate job processing
    wrapCreateEntitiesWithEmbeddingProcessing(
      knowledgeGraphManager,
      embeddingJobManager
    )

    // Setup the server with the KnowledgeGraphManager
    const server = setupServer(knowledgeGraphManager)

    // Start the server
    const transport = new StdioServerTransport()
    await server.connect(transport)
  })().catch((error) => {
    logger.error(`Main process terminated: ${error}`)
    process.exit(1)
  })
}
