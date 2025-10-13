/**
 * Vector Search and Storage Types
 *
 * This module defines types for vector operations including:
 * - Vector search results and similarity scoring
 * - Vector store interface for CRUD operations
 * - Vector index interface for optimized nearest neighbor search
 */

// ============================================================================
// Vector Search Results
// ============================================================================

/**
 * Result from a vector similarity search
 */
export type VectorSearchResult = {
  /** Unique identifier for the matched vector */
  id: string | number

  /** Similarity score (typically 0.0-1.0, higher is more similar) */
  similarity: number

  /** Additional metadata associated with the vector */
  metadata: Record<string, unknown>
}

// ============================================================================
// Vector Store Interface
// ============================================================================

/**
 * Vector store interface for managing vector embeddings
 *
 * Provides CRUD operations for vectors with support for:
 * - Semantic similarity search
 * - Hybrid search (combining keyword and vector search)
 * - Metadata filtering
 */
export type VectorStore = {
  /**
   * Initialize the vector store
   * Sets up indexes, connections, and any required resources
   */
  initialize(): Promise<void>

  /**
   * Add a vector to the store
   *
   * @param id - Unique identifier for the vector
   * @param vector - The embedding vector (must match store dimensions)
   * @param metadata - Optional metadata to associate with the vector
   */
  addVector(
    id: string | number,
    vector: number[],
    metadata?: Record<string, unknown>
  ): Promise<void>

  /**
   * Remove a vector from the store
   *
   * @param id - Identifier of the vector to remove
   */
  removeVector(id: string | number): Promise<void>

  /**
   * Search for similar vectors
   *
   * @param queryVector - The query embedding vector
   * @param options - Search configuration options
   * @returns Array of search results sorted by similarity (descending)
   */
  search(
    queryVector: number[],
    options?: {
      /** Maximum number of results to return */
      limit?: number

      /** Filter results by metadata properties */
      filter?: Record<string, unknown>

      /** Enable hybrid search (combines vector + keyword search) */
      hybridSearch?: boolean

      /** Minimum similarity threshold (0.0-1.0) */
      minSimilarity?: number
    }
  ): Promise<VectorSearchResult[]>
}

// ============================================================================
// Vector Index Interface
// ============================================================================

/**
 * Vector index interface for optimized nearest neighbor search
 *
 * Provides high-performance vector operations with support for:
 * - Approximate nearest neighbor (ANN) search
 * - Vector quantization for memory optimization
 * - Index statistics and monitoring
 */
export type VectorIndex = {
  /**
   * Add a vector to the index
   *
   * @param id - Unique identifier for the vector
   * @param vector - The vector to index
   */
  addVector(id: string, vector: number[]): Promise<void>

  /**
   * Search for nearest neighbors
   *
   * @param vector - The query vector
   * @param limit - Maximum number of results to return
   * @returns Array of results with id and similarity score
   */
  search(
    vector: number[],
    limit: number
  ): Promise<
    Array<{
      id: string
      score: number
    }>
  >

  /**
   * Remove a vector from the index
   *
   * @param id - ID of the vector to remove
   */
  removeVector(id: string): Promise<void>

  /**
   * Get index statistics
   *
   * @returns Object containing index metrics and configuration
   */
  getStats(): {
    /** Total number of vectors in the index */
    totalVectors: number

    /** Vector dimensionality */
    dimensionality: number

    /** Type of index (e.g., 'HNSW', 'IVF', 'Flat') */
    indexType: string

    /** Memory usage in bytes */
    memoryUsage: number

    /** Whether approximate search is enabled */
    approximateSearch?: boolean

    /** Whether vectors are quantized */
    quantized?: boolean
  }

  /**
   * Enable or disable approximate nearest neighbor search
   *
   * ANN trades accuracy for speed. Useful for large datasets.
   *
   * @param enable - Whether to enable approximate search
   */
  setApproximateSearch(enable: boolean): void

  /**
   * Enable or disable vector quantization
   *
   * Quantization reduces memory usage by compressing vectors.
   * May slightly reduce search accuracy.
   *
   * @param enable - Whether to enable quantization
   */
  setQuantization(enable: boolean): void
}
