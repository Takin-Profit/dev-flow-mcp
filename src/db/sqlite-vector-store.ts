// Copyright 2025 Takin Profit. All rights reserved.
/** biome-ignore-all lint/suspicious/useAwait: will be converted to async once nodejs implements the async api */
// SQLite Vector Store Implementation using sqlite-vec

import type { DB } from "@takinprofit/sqlite-x"
import type { Logger, VectorSearchResult, VectorStore } from "#types"
import { createNoOpLogger, DEFAULT_VECTOR_DIMENSIONS } from "#types"

// ============================================================================
// Constants
// ============================================================================

/**
 * Default maximum number of results for vector search
 */
const DEFAULT_SEARCH_LIMIT = 5

/**
 * Default minimum similarity threshold for search results
 */
const DEFAULT_MIN_SIMILARITY = 0.0

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for SQLite vector store
 */
export type SqliteVectorStoreOptions = {
  /** SQLite database instance */
  db: DB
  /** Vector dimensions (default: 1536 for OpenAI text-embedding-3-small) */
  dimensions?: number
  /** Logger instance for dependency injection */
  logger?: Logger
}

/**
 * SQLite Vector Store Implementation
 *
 * Provides semantic search using sqlite-vec's vec0 virtual table.
 * Key features:
 * - Uses sqlite-vec for efficient vector operations
 * - Supports cosine similarity and L2 distance
 * - Per-observation embeddings (multiple embeddings per entity)
 * - Built-in vector normalization
 */
export class SqliteVectorStore implements VectorStore {
  private readonly db: DB
  private readonly dimensions: number
  private readonly logger: Logger
  private initialized: boolean

  constructor(options: SqliteVectorStoreOptions) {
    this.db = options.db
    this.dimensions = options.dimensions ?? DEFAULT_VECTOR_DIMENSIONS
    this.logger = options.logger ?? createNoOpLogger()
    this.initialized = false
  }

  /**
   * Initialize the vector store
   * Verifies that the embeddings virtual table exists
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug("Vector store already initialized")
      return
    }

    try {
      this.logger.info("Initializing SQLite vector store")

      // Verify that the embeddings table exists
      const result = this.db.sql`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='embeddings'
      `.get()

      if (!result) {
        throw new Error(
          "Embeddings virtual table not found. Schema may not be initialized."
        )
      }

      this.initialized = true
      this.logger.info("SQLite vector store initialized successfully", {
        dimensions: this.dimensions,
      })
    } catch (error) {
      this.logger.error("Failed to initialize SQLite vector store", { error })
      throw error
    }
  }

  /**
   * Add a vector to the store
   *
   * @param id - Entity name or identifier
   * @param vector - The embedding vector
   * @param metadata - Optional metadata (observation_index)
   */
  async addVector(
    id: string | number,
    vector: number[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    this.ensureInitialized()

    try {
      // Validate vector dimensions
      if (vector.length !== this.dimensions) {
        throw new Error(
          `Vector dimension mismatch. Expected ${this.dimensions}, got ${vector.length}`
        )
      }

      const entityName = String(id)
      const observationIndex =
        typeof metadata?.observationIndex === "number"
          ? metadata.observationIndex
          : 0

      this.logger.debug("Adding vector to store", {
        entityName,
        observationIndex,
        dimensions: vector.length,
      })

      // Convert vector to Float32Array for sqlite-vec
      const float32Vector = new Float32Array(vector)
      const vectorBlob = new Uint8Array(float32Vector.buffer)

      // Check if this entity+observation already exists
      const existing = this.db.sql<{ entity_name: string; observation_index: number }>`
        SELECT rowid FROM embedding_metadata
        WHERE entity_name = ${"$entity_name"} AND observation_index = ${"$observation_index"}
      `.get<{ rowid: number }>({
        entity_name: entityName,
        observation_index: observationIndex,
      })

      if (existing) {
        // Update existing embedding
        this.db.sql<{ rowid: number; vector_blob: Uint8Array }>`
          UPDATE embeddings SET embedding = vec_f32(${"$vector_blob"})
          WHERE rowid = ${"$rowid"}
        `.run({
          rowid: existing.rowid,
          vector_blob: vectorBlob,
        })
      } else {
        // Insert new embedding and metadata
        const result = this.db.sql<{ vector_blob: Uint8Array }>`
          INSERT INTO embeddings (embedding)
          VALUES (vec_f32(${"$vector_blob"}))
        `.run({
          vector_blob: vectorBlob,
        })

        // Get the rowid of the inserted embedding
        const rowid = result.lastInsertRowid

        // Insert metadata with the same rowid
        this.db.sql<{ rowid: number; entity_name: string; observation_index: number }>`
          INSERT INTO embedding_metadata (rowid, entity_name, observation_index)
          VALUES (${"$rowid"}, ${"$entity_name"}, ${"$observation_index"})
        `.run({
          rowid,
          entity_name: entityName,
          observation_index: observationIndex,
        })
      }

      this.logger.debug("Vector added successfully", { entityName })
    } catch (error) {
      this.logger.error("Failed to add vector", { error, id })
      throw error
    }
  }

  /**
   * Remove a vector from the store
   *
   * @param id - Entity name to remove (removes all observations for this entity)
   */
  async removeVector(id: string | number): Promise<void> {
    this.ensureInitialized()

    try {
      const entityName = String(id)

      this.logger.debug("Removing vector from store", { entityName })

      // Get all rowids for this entity
      const rows = this.db.sql<{ entity_name: string }>`
        SELECT rowid FROM embedding_metadata
        WHERE entity_name = ${"$entity_name"}
      `.all<{ rowid: number }>({ entity_name: entityName })

      // Delete from both tables
      for (const row of rows) {
        this.db.sql<{ rowid: number }>`
          DELETE FROM embeddings WHERE rowid = ${"$rowid"}
        `.run({ rowid: row.rowid })

        this.db.sql<{ rowid: number }>`
          DELETE FROM embedding_metadata WHERE rowid = ${"$rowid"}
        `.run({ rowid: row.rowid })
      }

      this.logger.debug("Vector removed successfully", { entityName, count: rows.length })
    } catch (error) {
      this.logger.error("Failed to remove vector", { error, id })
      throw error
    }
  }

  /**
   * Search for similar vectors using cosine distance
   *
   * @param queryVector - The query embedding vector
   * @param options - Search configuration options
   * @returns Array of search results sorted by similarity (descending)
   */
  async search(
    queryVector: number[],
    options?: {
      limit?: number
      filter?: Record<string, unknown>
      hybridSearch?: boolean
      minSimilarity?: number
    }
  ): Promise<VectorSearchResult[]> {
    this.ensureInitialized()

    try {
      // Validate query vector dimensions
      if (queryVector.length !== this.dimensions) {
        throw new Error(
          `Query vector dimension mismatch. Expected ${this.dimensions}, got ${queryVector.length}`
        )
      }

      const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT
      const minSimilarity = options?.minSimilarity ?? DEFAULT_MIN_SIMILARITY

      this.logger.debug("Performing vector search", {
        queryVectorLength: queryVector.length,
        limit,
        minSimilarity,
      })

      // Convert query vector to Float32Array
      const float32QueryVector = new Float32Array(queryVector)
      const queryVectorBlob = new Uint8Array(float32QueryVector.buffer)

      // Perform vector similarity search using sqlite-vec
      // Join with metadata table to get entity names
      type SearchResult = {
        entity_name: string
        observation_index: number
        distance: number
      }

      const results = this.db.sql<{ query_vector: Uint8Array; limit: number }>`
        SELECT
          m.entity_name,
          m.observation_index,
          vec_distance_cosine(e.embedding, vec_f32(${"$query_vector"})) as distance
        FROM embeddings e
        JOIN embedding_metadata m ON e.rowid = m.rowid
        WHERE e.embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT ${"$limit"}
      `.all<SearchResult>({
        query_vector: queryVectorBlob,
        limit,
      })

      // Convert distance to similarity score (1 - distance for cosine)
      // and filter by minimum similarity
      const searchResults: VectorSearchResult[] = results
        .map((row) => {
          const similarity = 1 - row.distance // Convert distance to similarity
          return {
            id: row.entity_name,
            similarity,
            metadata: {
              observationIndex: row.observation_index,
              distance: row.distance,
            },
          }
        })
        .filter((result) => result.similarity >= minSimilarity)

      this.logger.info("Vector search completed", {
        resultsFound: searchResults.length,
        topSimilarity: searchResults[0]?.similarity,
      })

      return searchResults
    } catch (error) {
      this.logger.error("Failed to perform vector search", { error })
      throw error
    }
  }

  /**
   * Get diagnostic information about the vector store
   */
  async diagnose(): Promise<Record<string, unknown>> {
    try {
      // Count total embeddings
      const countResult = this.db.sql`
        SELECT COUNT(*) as count FROM embeddings
      `.get<{ count: number }>()

      // Get unique entities from metadata table
      const uniqueEntitiesResult = this.db.sql`
        SELECT COUNT(DISTINCT entity_name) as count FROM embedding_metadata
      `.get<{ count: number }>()

      return {
        initialized: this.initialized,
        dimensions: this.dimensions,
        totalEmbeddings: countResult?.count ?? 0,
        uniqueEntities: uniqueEntitiesResult?.count ?? 0,
        vectorType: "float32",
        distanceFunction: "cosine",
      }
    } catch (error) {
      this.logger.error("Failed to get diagnostics", { error })
      return {
        initialized: this.initialized,
        dimensions: this.dimensions,
        error: String(error),
      }
    }
  }

  /**
   * Ensure the vector store is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Vector store not initialized. Call initialize() first.")
    }
  }
}
