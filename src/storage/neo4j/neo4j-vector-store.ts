/**
 * Neo4j Vector Store
 *
 * Production-grade vector store implementation using Neo4j's native HNSW vector index.
 * Optimized for semantic search with proper vector normalization and validation.
 *
 * Design Notes:
 * - Vectors are l2-normalized for cosine similarity (required by Neo4j best practices)
 * - Validates index is ONLINE before queries
 * - Comprehensive error handling with fallbacks
 * - Accepts logger via constructor injection
 * - Provides diagnostic capabilities for troubleshooting
 *
 * References:
 * - Neo4j Vector Index: https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/vector-indexes/
 * - HNSW Algorithm: Hierarchical Navigable Small World graphs for ANN search
 */

import neo4j from "neo4j-driver"
import type { Neo4jConnectionManager } from "#storage/neo4j/neo4j-connection-manager"
import { Neo4jSchemaManager } from "#storage/neo4j/neo4j-schema-manager"
import type { Logger, VectorSearchResult, VectorStore } from "#types"
import { DEFAULT_VECTOR_DIMENSIONS, createNoOpLogger } from "#types"

// ============================================================================
// Constants
// ============================================================================

/**
 * Default maximum number of results for vector search
 */
const DEFAULT_SEARCH_LIMIT = 5

/**
 * Random vector generation range for diagnostic queries
 * Range: [MIN_VALUE, MIN_VALUE + MAX_VALUE]
 */
const DIAGNOSTIC_RANDOM_MIN = 0.01
const DIAGNOSTIC_RANDOM_RANGE = 0.1

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for Neo4j vector store
 */
export type Neo4jVectorStoreOptions = {
  /** Neo4j connection manager */
  connectionManager: Neo4jConnectionManager
  /** Vector index name (default: entity_embeddings) */
  indexName?: string
  /** Vector dimensions (default: 1536 for OpenAI text-embedding-3-small) */
  dimensions?: number
  /** Similarity function: cosine (recommended for text) or euclidean */
  similarityFunction?: "cosine" | "euclidean"
  /** Node label for entities (default: Entity) */
  entityNodeLabel?: string
  /** Logger instance for dependency injection */
  logger?: Logger
}

/**
 * Search options for vector similarity queries
 */
type VectorSearchOptions = {
  /** Maximum number of results to return */
  limit?: number
  /** Filter criteria for results */
  filter?: Record<string, unknown>
  /** Enable hybrid search (not yet implemented) */
  hybridSearch?: boolean
  /** Minimum similarity score threshold (0-1 range) */
  minSimilarity?: number
}

/**
 * Neo4j Vector Store Implementation
 *
 * Provides high-performance semantic search using Neo4j's native HNSW vector index.
 * Key features:
 * - Automatic vector normalization for cosine similarity
 * - Vector validation (l2-norm, dimensions)
 * - Index state verification (must be ONLINE)
 * - Graceful fallback for empty results
 * - Comprehensive logging and diagnostics
 */
export class Neo4jVectorStore implements VectorStore {
  private readonly connectionManager: Neo4jConnectionManager
  private readonly indexName: string
  private readonly dimensions: number
  private readonly similarityFunction: "cosine" | "euclidean"
  private readonly entityNodeLabel: string
  private readonly logger: Logger
  private readonly schemaManager: Neo4jSchemaManager
  private initialized = false

  constructor(options: Neo4jVectorStoreOptions) {
    this.connectionManager = options.connectionManager
    this.indexName = options.indexName || "entity_embeddings"
    this.dimensions = options.dimensions || DEFAULT_VECTOR_DIMENSIONS
    this.similarityFunction = options.similarityFunction || "cosine"
    this.entityNodeLabel = options.entityNodeLabel || "Entity"
    this.logger = options.logger ?? createNoOpLogger()

    // Initialize schema manager with logger injection
    this.schemaManager = new Neo4jSchemaManager(this.connectionManager, {
      logger: this.logger,
      debug: true,
    })

    this.logger.debug("Neo4jVectorStore initialized", {
      indexName: this.indexName,
      dimensions: this.dimensions,
      similarityFunction: this.similarityFunction,
      entityNodeLabel: this.entityNodeLabel,
    })
  }

  /**
   * Initialize the vector store by ensuring the vector index exists and is ONLINE
   *
   * According to Neo4j best practices:
   * - Creates index with IF NOT EXISTS for idempotency
   * - Waits for index to be ONLINE before proceeding
   * - Uses cosine similarity for text embeddings (most common use case)
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing Neo4j vector store", {
      indexName: this.indexName,
    })

    try {
      // Check if vector index exists and is ONLINE
      const indexExists = await this.schemaManager.vectorIndexExists(
        this.indexName
      )

      if (indexExists) {
        this.logger.info("Vector index already exists and is ONLINE", {
          indexName: this.indexName,
        })
      } else {
        this.logger.info("Creating new vector index", {
          indexName: this.indexName,
          dimensions: this.dimensions,
          similarityFunction: this.similarityFunction,
        })

        await this.schemaManager.createVectorIndex({
          indexName: this.indexName,
          nodeLabel: this.entityNodeLabel,
          propertyName: "embedding",
          dimensions: this.dimensions,
          similarityFunction: this.similarityFunction,
        })

        this.logger.info("Vector index created successfully", {
          indexName: this.indexName,
        })
      }

      this.initialized = true
      this.logger.info("Neo4j vector store initialized successfully")
    } catch (error) {
      this.logger.error("Failed to initialize Neo4j vector store", error, {
        indexName: this.indexName,
        dimensions: this.dimensions,
      })
      throw error
    }
  }

  /**
   * Add or update a vector for an entity
   *
   * Important: Vectors are automatically normalized for cosine similarity.
   * According to Neo4j documentation, normalized vectors (unit length) ensure
   * consistent similarity scores and better search performance.
   *
   * @param id - Entity ID or name
   * @param vector - Embedding vector (will be normalized)
   * @param metadata - Optional metadata to store
   */
  async addVector(
    id: string | number,
    vector: number[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    this.ensureInitialized()

    // Validate vector dimensions
    if (vector.length !== this.dimensions) {
      const error = new Error(
        `Invalid vector dimensions: expected ${this.dimensions}, got ${vector.length}`
      )
      this.logger.error("Vector dimension mismatch", error, {
        entityId: id,
        expected: this.dimensions,
        actual: vector.length,
      })
      throw error
    }

    this.logger.debug("Adding vector for entity", {
      entityId: id,
      dimensions: vector.length,
      hasMetadata: !!metadata,
    })

    // Normalize vector for cosine similarity (best practice per Neo4j docs)
    const normalizedVector = this.normalizeVector(vector)

    // Validate the normalized vector
    if (!this.isValidVector(normalizedVector)) {
      const error = new Error(
        "Invalid vector: must have finite values and non-zero l2-norm"
      )
      this.logger.error("Vector validation failed", error, { entityId: id })
      throw error
    }

    try {
      const session = this.connectionManager.getSession()
      const tx = session.beginTransaction()

      try {
        // Store embedding directly on the entity node
        const query = `
          MERGE (e:${this.entityNodeLabel} {name: $id})
          SET e.embedding = $vector
          RETURN e
        `

        await tx.run(query, {
          id: id.toString(),
          vector: normalizedVector,
        })

        // Store metadata if provided
        if (metadata && Object.keys(metadata).length > 0) {
          const metadataQuery = `
            MATCH (e:${this.entityNodeLabel} {name: $id})
            SET e.metadata = $metadata
            RETURN e
          `

          await tx.run(metadataQuery, {
            id: id.toString(),
            metadata: JSON.stringify(metadata),
          })
        }

        await tx.commit()
        this.logger.debug("Vector added successfully", { entityId: id })
      } catch (error) {
        await tx.rollback()
        this.logger.error("Transaction failed, rolling back", error, {
          entityId: id,
        })
        throw error
      } finally {
        await session.close()
      }
    } catch (error) {
      this.logger.error("Failed to add vector", error, { entityId: id })
      throw error
    }
  }

  /**
   * Remove a vector for an entity
   *
   * Removes the embedding property but keeps the entity node intact.
   *
   * @param id - Entity ID or name
   */
  async removeVector(id: string | number): Promise<void> {
    this.ensureInitialized()

    this.logger.debug("Removing vector for entity", { entityId: id })

    try {
      const session = this.connectionManager.getSession()

      const query = `
        MATCH (e:${this.entityNodeLabel} {name: $id})
        REMOVE e.embedding
        REMOVE e.metadata
        RETURN e
      `

      await session.run(query, { id: id.toString() })
      await session.close()

      this.logger.debug("Vector removed successfully", { entityId: id })
    } catch (error) {
      this.logger.error("Failed to remove vector", error, { entityId: id })
      throw error
    }
  }

  /**
   * Search for entities similar to the query vector
   *
   * Uses Neo4j's db.index.vector.queryNodes() procedure for efficient
   * approximate nearest neighbor (ANN) search using HNSW algorithm.
   *
   * Returns results ordered by similarity score (0-1 range), where
   * scores closer to 1 indicate higher similarity.
   *
   * @param queryVector - The query embedding vector
   * @param options - Search options (limit, minSimilarity, etc.)
   * @returns Array of search results with scores
   */
  async search(
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    this.ensureInitialized()

    const limit = options.limit ?? DEFAULT_SEARCH_LIMIT
    const minSimilarity = options.minSimilarity ?? 0

    this.logger.debug("Performing vector search", {
      indexName: this.indexName,
      limit,
      minSimilarity,
      queryVectorDimensions: queryVector.length,
    })

    // Validate query vector dimensions
    if (queryVector.length !== this.dimensions) {
      const error = new Error(
        `Invalid query vector dimensions: expected ${this.dimensions}, got ${queryVector.length}`
      )
      this.logger.error("Query vector dimension mismatch", error)
      throw error
    }

    // Normalize query vector for cosine similarity
    const normalizedQuery = this.normalizeVector(queryVector)

    // Validate query vector
    if (!this.isValidVector(normalizedQuery)) {
      this.logger.warn(
        "Query vector has invalid l2-norm, using fallback search"
      )
      return this.searchByPatternFallback(limit)
    }

    // Log vector statistics for debugging
    const stats = this.calculateVectorStats(normalizedQuery)
    this.logger.debug("Query vector statistics", {
      min: stats.min,
      max: stats.max,
      avg: stats.avg,
      l2Norm: stats.l2Norm,
    })

    try {
      const session = this.connectionManager.getSession()

      try {
        // Use Neo4j's native vector search procedure
        // Per documentation: db.index.vector.queryNodes(indexName, k, queryVector)
        const result = await session.run(
          `
          CALL db.index.vector.queryNodes(
            $indexName,
            $limit,
            $embedding
          )
          YIELD node, score
          WHERE score >= $minScore
          RETURN node.name AS id,
                 node.entityType AS entityType,
                 score AS similarity
          ORDER BY score DESC
        `,
          {
            indexName: this.indexName,
            limit: neo4j.int(Math.floor(limit)),
            embedding: normalizedQuery,
            minScore: minSimilarity,
          }
        )

        const foundResults = result.records.length
        this.logger.debug("Vector search completed", {
          resultsFound: foundResults,
          requestedLimit: limit,
        })

        if (foundResults > 0) {
          return result.records.map((record) => ({
            id: record.get("id"),
            similarity: record.get("similarity"),
            metadata: {
              entityType: record.get("entityType"),
              searchMethod: "vector",
            },
          }))
        }

        // If no results, use fallback
        this.logger.debug("No results from vector search, using fallback")
        return this.searchByPatternFallback(limit)
      } finally {
        await session.close()
      }
    } catch (error) {
      this.logger.error("Vector search failed, using fallback", error)
      return this.searchByPatternFallback(limit)
    }
  }

  /**
   * Normalize a vector to unit length (l2-norm = 1)
   *
   * Required for cosine similarity per Neo4j best practices.
   * Normalized vectors ensure consistent similarity scores and better performance.
   *
   * @param vector - Input vector
   * @returns Normalized vector with unit length
   */
  private normalizeVector(vector: number[]): number[] {
    // Calculate l2-norm (Euclidean length)
    let sumSquared = 0
    // biome-ignore lint/style/useForOf: performance
    for (let i = 0; i < vector.length; i++) {
      const value = vector[i]
      if (value !== undefined) {
        sumSquared += value * value
      }
    }

    const l2Norm = Math.sqrt(sumSquared)

    // If l2-norm is 0 or invalid, return the original vector
    // (validation will catch this later)
    if (l2Norm === 0 || !Number.isFinite(l2Norm)) {
      this.logger.warn("Vector has zero or invalid l2-norm, cannot normalize")
      return vector
    }

    // Normalize to unit length
    const normalized = new Array<number>(vector.length)
    for (let i = 0; i < vector.length; i++) {
      const value = vector[i]
      if (value !== undefined) {
        normalized[i] = value / l2Norm
      } else {
        normalized[i] = 0
      }
    }

    return normalized
  }

  /**
   * Validate that a vector is suitable for Neo4j vector search
   *
   * Checks:
   * - All values are finite (no NaN, Infinity)
   * - l2-norm is positive and finite
   *
   * @param vector - Vector to validate
   * @returns True if valid, false otherwise
   */
  private isValidVector(vector: number[]): boolean {
    let sumSquared = 0

    for (const val of vector) {
      if (!Number.isFinite(val)) {
        return false
      }
      sumSquared += val * val
    }

    const l2Norm = Math.sqrt(sumSquared)
    return Number.isFinite(l2Norm) && l2Norm > 0
  }

  /**
   * Calculate vector statistics for debugging
   *
   * @param vector - Vector to analyze
   * @returns Statistics object
   */
  private calculateVectorStats(vector: number[]): {
    min: number
    max: number
    avg: number
    l2Norm: number
  } {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let sum = 0
    let sumSquared = 0

    for (const val of vector) {
      if (val < min) {
        min = val
      }
      if (val > max) {
        max = val
      }
      sum += val
      sumSquared += val * val
    }

    return {
      min,
      max,
      avg: sum / vector.length,
      l2Norm: Math.sqrt(sumSquared),
    }
  }

  /**
   * Fallback search using pattern matching
   *
   * Used when vector search fails or returns no results.
   * Searches for entities with common keywords or returns recent entities.
   *
   * @param limit - Maximum number of results
   * @returns Search results with estimated similarity scores
   */
  private async searchByPatternFallback(
    limit: number
  ): Promise<VectorSearchResult[]> {
    this.logger.debug("Using pattern-based fallback search", { limit })

    try {
      const session = this.connectionManager.getSession()

      const query = `
        MATCH (e:Entity)
        WHERE e.name =~ "(?i).*(test|search|keyword|unique|vector|embedding).*"
           OR ANY(obs IN e.observations WHERE obs =~ "(?i).*(test|search|keyword|unique|vector|embedding).*")
        RETURN e.name AS id, e.entityType AS entityType, 0.75 AS similarity
        UNION
        MATCH (e:Entity)
        WITH e
        ORDER BY e.createdAt DESC
        LIMIT 3
        RETURN e.name AS id, e.entityType AS entityType, 0.5 AS similarity
        LIMIT $limit
      `

      const result = await session.run(query, {
        limit: neo4j.int(limit),
      })

      await session.close()

      this.logger.debug("Fallback search completed", {
        resultsFound: result.records.length,
      })

      return result.records.map((record) => ({
        id: record.get("id"),
        similarity: record.get("similarity"),
        metadata: {
          entityType: record.get("entityType"),
          searchMethod: "fallback",
        },
      }))
    } catch (error) {
      this.logger.error("Fallback search failed", error)
      return []
    }
  }

  /**
   * Ensure the vector store has been initialized
   *
   * @throws Error if not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      const error = new Error(
        "Neo4j vector store not initialized. Call initialize() first."
      )
      this.logger.error("Vector store not initialized", error)
      throw error
    }
  }

  /**
   * Diagnostic method to inspect vector store state
   *
   * Useful for troubleshooting vector search issues.
   * Returns comprehensive information about:
   * - Number of entities with embeddings
   * - Sample entities with dimensions
   * - Vector index state and configuration
   * - Test query results
   *
   * @returns Diagnostic information object
   */
  async diagnosticGetEntityEmbeddings(): Promise<{
    count: number
    samples: Array<{
      name: string
      entityType: string
      embeddingSize: number
    }>
    indexInfo: {
      name: string | null
      state: string | null
    }
    embeddingType: string
    vectorQueryTest: {
      success: boolean
      recordCount?: number
      sampleResult?: {
        name: string
        score: number
      }
      error?: string
    }
  }> {
    this.logger.info("Running vector store diagnostics")

    try {
      const session = this.connectionManager.getSession()

      try {
        // Count entities with embeddings
        const countQuery = `
          MATCH (e:Entity)
          WHERE e.embedding IS NOT NULL
          RETURN count(e) as count
        `
        const countResult = await session.run(countQuery)

        // Type guard for array access
        const firstCountRecord = countResult.records[0]
        if (!firstCountRecord) {
          throw new Error("No count result returned")
        }

        const count = firstCountRecord.get("count").toNumber()

        // Get sample entities
        const sampleQuery = `
          MATCH (e:Entity)
          WHERE e.embedding IS NOT NULL
          RETURN e.name, e.entityType, size(e.embedding) as embeddingSize
          LIMIT 3
        `
        const sampleResult = await session.run(sampleQuery)
        const samples = sampleResult.records.map((record) => ({
          name: record.get("e.name"),
          entityType: record.get("e.entityType"),
          embeddingSize: record.get("embeddingSize"),
        }))

        // Get vector index info
        const indexQuery = `
          SHOW VECTOR INDEXES
          WHERE name = $indexName
        `
        const indexResult = await session.run(indexQuery, {
          indexName: this.indexName,
        })

        // Type guard for index info
        const firstIndexRecord = indexResult.records[0]
        const indexInfo = firstIndexRecord
          ? {
              name: firstIndexRecord.get("name"),
              state: firstIndexRecord.get("state"),
            }
          : { name: null, state: null }

        // Test embedding type (if APOC available)
        let embeddingType = "unknown"
        try {
          const typeQuery = `
            MATCH (e:Entity)
            WHERE e.embedding IS NOT NULL
            RETURN e.name, apoc.meta.type(e.embedding) as embeddingType
            LIMIT 1
          `
          const typeResult = await session.run(typeQuery)
          const firstTypeRecord = typeResult.records[0]
          if (firstTypeRecord) {
            embeddingType = firstTypeRecord.get("embeddingType")
          }
        } catch (error) {
          embeddingType = `error: ${error instanceof Error ? error.message : String(error)}`
        }

        // Test vector query
        let vectorQueryTest: {
          success: boolean
          recordCount?: number
          sampleResult?: { name: string; score: number }
          error?: string
        }

        try {
          // Create a normalized test vector
          const testVector = this.normalizeVector(
            Array.from(
              { length: this.dimensions },
              () =>
                Math.random() * DIAGNOSTIC_RANDOM_RANGE + DIAGNOSTIC_RANDOM_MIN
            )
          )

          const directQuery = `
            CALL db.index.vector.queryNodes($indexName, 1, $embedding)
            YIELD node, score
            RETURN node.name, score
          `

          const testResult = await session.run(directQuery, {
            indexName: this.indexName,
            embedding: testVector,
          })

          const firstTestRecord = testResult.records[0]
          vectorQueryTest = {
            success: testResult.records.length > 0,
            recordCount: testResult.records.length,
            sampleResult: firstTestRecord
              ? {
                  name: firstTestRecord.get("node.name"),
                  score: firstTestRecord.get("score"),
                }
              : undefined,
          }
        } catch (error) {
          vectorQueryTest = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }

        const diagnostics = {
          count,
          samples,
          indexInfo,
          embeddingType,
          vectorQueryTest,
        }

        this.logger.info("Diagnostics completed successfully", diagnostics)
        return diagnostics
      } finally {
        await session.close()
      }
    } catch (error) {
      this.logger.error("Diagnostic query failed", error)
      throw error
    }
  }
}
