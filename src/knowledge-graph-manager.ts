import type { SqliteDb } from "#db/sqlite-db"
import type { EmbeddingJobManager } from "#embeddings/embedding-job-manager"
import { DatabaseError } from "#errors"
import type {
  Entity,
  KnowledgeGraph,
  Logger,
  Relation,
  VectorStore,
} from "#types"
import {
  createNoOpLogger,
  DEFAULT_SEARCH_LIMIT,
  KG_MANAGER_FALLBACK_THRESHOLD,
  KG_MANAGER_MIN_SIMILARITY,
} from "#types"

/**
 * Knowledge Graph Manager Configuration Options
 */
export type KnowledgeGraphManagerOptions = {
  /**
   * SQLite database for persisting entities and relations
   */
  database: SqliteDb

  /**
   * Optional embedding job manager for scheduling and processing embeddings
   */
  embeddingJobManager?: EmbeddingJobManager

  /**
   * Optional logger instance
   */
  logger?: Logger
}

// The KnowledgeGraphManager class contains all operations to interact with the knowledge graph
export class KnowledgeGraphManager {
  private readonly database: SqliteDb
  private readonly logger: Logger
  private readonly embeddingJobManager?: EmbeddingJobManager
  private readonly vectorStore?: VectorStore

  constructor(options: KnowledgeGraphManagerOptions) {
    this.database = options.database
    this.logger = options.logger ?? createNoOpLogger()
    this.embeddingJobManager = options.embeddingJobManager

    // Vector store initialization removed - SQLite database has its own vector store
  }

  /**
   * Get the database instance
   * @returns The database or null if not available
   */
  getDatabase(): SqliteDb | null {
    return this.database ?? null
  }

  /**
   * Get the embedding job manager instance
   * @returns The embedding job manager or null if not available
   */
  getEmbeddingJobManager(): EmbeddingJobManager | null {
    return this.embeddingJobManager ?? null
  }

  /**
   * Ensure vector store is initialized
   * NOTE: This now returns the database's vector store (for SQLite)
   *
   * @returns Promise that resolves when the vector store is initialized
   */
  private ensureVectorStore(): VectorStore {
    if (!this.vectorStore) {
      // Vector store is managed by the database (SQLite)
      // This method is kept for backward compatibility but won't be used
      throw new DatabaseError(
        "Vector store is not initialized - database should handle vector operations"
      )
    }

    return this.vectorStore
  }

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    // If no entities to create, return empty array early
    if (!entities || entities.length === 0) {
      return []
    }

    let createdEntities: Entity[] = []

    // Use database for creating entities
    createdEntities = await this.database.createEntities(entities)

    // Add entities with existing embeddings to vector store
    for (const entity of createdEntities) {
      if (entity.embedding?.vector) {
        try {
          const vectorStore = this.ensureVectorStore()
          // Add metadata for filtering
          const metadata = {
            name: entity.name,
            entityType: entity.entityType,
          }

          await vectorStore.addVector(
            entity.name,
            entity.embedding.vector,
            metadata
          )
          this.logger.debug(
            `Added vector for entity ${entity.name} to vector store`
          )
        } catch (error) {
          this.logger.error(
            `Failed to add vector for entity ${entity.name} to vector store`,
            error
          )
          // Continue with scheduling embedding job
        }
      }
    }

    // Schedule embedding jobs if manager is provided
    if (this.embeddingJobManager) {
      for (const entity of createdEntities) {
        await this.embeddingJobManager.scheduleEntityEmbedding(entity.name)
      }
    }

    return createdEntities
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    if (!relations || relations.length === 0) {
      return []
    }

    // Use database for creating relations
    const createdRelations = await this.database.createRelations(relations)
    return createdRelations
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    if (!entityNames || entityNames.length === 0) {
      return
    }

    // Use database for deleting entities
    await this.database.deleteEntities(entityNames)

    // Remove entities from vector store if available
    try {
      // Ensure vector store is available
      const vectorStore = this.ensureVectorStore()

      if (vectorStore) {
        for (const entityName of entityNames) {
          try {
            await vectorStore.removeVector(entityName)
            this.logger.debug(
              `Removed vector for entity ${entityName} from vector store`
            )
          } catch (error) {
            this.logger.error(
              `Failed to remove vector for entity ${entityName}`,
              error
            )
            // Don't throw here, continue with the next entity
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to remove vectors from vector store", error)
      // Continue even if vector store operations fail
    }
  }

  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[]
  ): Promise<void> {
    if (!deletions || deletions.length === 0) {
      return
    }

    // Use database for deleting observations
    await this.database.deleteObservations(deletions)

    // Schedule re-embedding for affected entities if manager is provided
    if (this.embeddingJobManager) {
      for (const deletion of deletions) {
        await this.embeddingJobManager.scheduleEntityEmbedding(
          deletion.entityName
        )
      }
    }
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    if (!relations || relations.length === 0) {
      return
    }

    // Use database for deleting relations
    await this.database.deleteRelations(relations)
  }

  searchNodes(query: string): Promise<KnowledgeGraph> {
    return this.database.searchNodes(query)
  }

  openNodes(names: string[]): Promise<KnowledgeGraph> {
    return this.database.openNodes(names)
  }

  /**
   * Add observations to entities
   * @param observations Array of observation objects
   * @returns Promise resolving to array of added observations
   */
  async addObservations(
    observations: Array<{
      entityName: string
      contents: string[]
      // Additional parameters that may be present in the MCP schema but ignored by databases
      strength?: number
      confidence?: number
      metadata?: Record<string, unknown>
      [key: string]: unknown // Allow any other properties
    }>
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    if (!observations || observations.length === 0) {
      return []
    }

    // Extract only the fields needed by databases
    // Keep the simplified format for compatibility with existing databases
    const simplifiedObservations = observations.map((obs) => ({
      entityName: obs.entityName,
      contents: obs.contents,
    }))

    // Use database for adding observations
    const results = await this.database.addObservations(simplifiedObservations)

    // Schedule re-embedding for affected entities if manager is provided
    if (this.embeddingJobManager) {
      for (const result of results) {
        if (result.addedObservations.length > 0) {
          await this.embeddingJobManager.scheduleEntityEmbedding(
            result.entityName
          )
        }
      }
    }

    return results
  }

  /**
   * Find entities that are semantically similar to the query
   * @param query The query text to search for
   * @param options Search options including limit and threshold
   * @returns Promise resolving to an array of matches with scores
   */
  async findSimilarEntities(
    query: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<Array<{ name: string; score: number }>> {
    if (!this.embeddingJobManager) {
      throw new Error("Embedding job manager is required for semantic search")
    }

    const embeddingService = this.embeddingJobManager.getEmbeddingService()
    if (!embeddingService) {
      throw new Error("Embedding service not available")
    }

    // Generate embedding for the query
    const embedding = await embeddingService.generateEmbedding(query)

    // If we have a vector store, use it directly
    try {
      // Ensure vector store is available
      const vectorStore = this.ensureVectorStore()

      if (vectorStore) {
        const limit = options.limit || DEFAULT_SEARCH_LIMIT
        const minSimilarity = options.threshold || KG_MANAGER_MIN_SIMILARITY

        // Search the vector store
        const results = await vectorStore.search(embedding, {
          limit,
          minSimilarity,
        })

        // Convert to the expected format
        return results.map(
          (result: { id: string | number; similarity: number }) => ({
            name: result.id.toString(),
            score: result.similarity,
          })
        )
      }
    } catch (error) {
      this.logger.error("Failed to search vector store", error)
      // Return empty result if vector search fails
    }

    // Return empty array if no vector store available
    return []
  }

  /**
   * Read the entire knowledge graph
   *
   * This is an alias for loadGraph() for backward compatibility
   * @returns The knowledge graph
   */
  readGraph(): Promise<KnowledgeGraph> {
    return this.database.loadGraph()
  }

  /**
   * Try to perform semantic search using the database
   * @private
   */
  private async tryProviderSemanticSearch(
    query: string,
    effectiveOptions: Record<string, unknown>
  ): Promise<KnowledgeGraph | null> {
    try {
      // Generate query vector if we have an embedding service
      if (this.embeddingJobManager) {
        const embeddingService = this.embeddingJobManager.getEmbeddingService()
        if (embeddingService) {
          const queryVector = await embeddingService.generateEmbedding(query)
          return this.database.semanticSearch(query, {
            ...effectiveOptions,
            queryVector,
          })
        }
      }

      // Fall back to text search if no embedding service
      return this.database.searchNodes(query)
    } catch (error) {
      this.logger.error(
        "Provider semanticSearch failed, falling back to basic search",
        error
      )
      return this.database.searchNodes(query)
    }
  }

  /**
   * Try to perform semantic search using internal implementation
   * @private
   */
  private async tryInternalSemanticSearch(
    query: string,
    effectiveOptions: {
      hybridSearch?: boolean
      limit?: number
      threshold?: number
      minSimilarity?: number
      entityTypes?: string[]
      facets?: string[]
      offset?: number
    }
  ): Promise<KnowledgeGraph | null> {
    if (!this.embeddingJobManager) {
      return null
    }

    try {
      return await this.semanticSearch(query, {
        hybridSearch: effectiveOptions.hybridSearch,
        limit: effectiveOptions.limit || DEFAULT_SEARCH_LIMIT,
        threshold:
          effectiveOptions.threshold ||
          effectiveOptions.minSimilarity ||
          KG_MANAGER_FALLBACK_THRESHOLD,
        entityTypes: effectiveOptions.entityTypes || [],
        facets: effectiveOptions.facets || [],
        offset: effectiveOptions.offset || 0,
      })
    } catch (error) {
      this.logger.error(
        "Semantic search failed, falling back to basic search",
        error
      )

      // Explicitly call searchNodes if available in the provider
      if (this.database) {
        return this.database.searchNodes(query)
      }
      return null
    }
  }

  /**
   * Search the knowledge graph with various options
   *
   * @param query The search query string
   * @param options Search options
   * @returns Promise resolving to a knowledge graph with search results
   */
  async search(
    query: string,
    options: {
      semanticSearch?: boolean
      hybridSearch?: boolean
      limit?: number
      threshold?: number
      minSimilarity?: number
      entityTypes?: string[]
      facets?: string[]
      offset?: number
    } = {}
  ): Promise<KnowledgeGraph> {
    // If hybridSearch is true, always set semanticSearch to true as well
    const effectiveOptions = options.hybridSearch
      ? { ...options, semanticSearch: true }
      : options

    // Check if semantic search is requested
    if (effectiveOptions.semanticSearch || effectiveOptions.hybridSearch) {
      // Try provider semantic search first
      const providerResult = await this.tryProviderSemanticSearch(
        query,
        effectiveOptions
      )
      if (providerResult) {
        return providerResult
      }

      // Fall back to database's basic search if available
      if (this.database) {
        return this.database.searchNodes(query)
      }

      // Try internal semantic search
      const internalResult = await this.tryInternalSemanticSearch(
        query,
        effectiveOptions
      )
      if (internalResult) {
        return internalResult
      }

      // Warn if semantic search was requested but not available
      if (!this.embeddingJobManager) {
        this.logger.warn(
          "Semantic search requested but no embedding capability available"
        )
      }
    }

    // Use basic search as final fallback
    return this.searchNodes(query)
  }

  /**
   * Perform semantic search on the knowledge graph
   *
   * @param query The search query string
   * @param options Search options
   * @returns Promise resolving to a knowledge graph with semantic search results
   */
  private async semanticSearch(
    query: string,
    options: {
      hybridSearch?: boolean
      limit?: number
      threshold?: number
      entityTypes?: string[]
      facets?: string[]
      offset?: number
    } = {}
  ): Promise<KnowledgeGraph> {
    // Find similar entities using vector similarity
    const similarEntities = await this.findSimilarEntities(query, {
      limit: options.limit || DEFAULT_SEARCH_LIMIT,
      threshold: options.threshold || KG_MANAGER_FALLBACK_THRESHOLD,
    })

    if (!similarEntities.length) {
      return { entities: [], relations: [] }
    }

    // Get full entity details
    const entityNames = similarEntities.map((e) => e.name)
    const graph = await this.openNodes(entityNames)

    // Add scores to entities for client use
    const scoredEntities = graph.entities.map((entity: Entity) => {
      const matchScore =
        similarEntities.find((e) => e.name === entity.name)?.score || 0
      return {
        ...entity,
        score: matchScore,
      }
    })

    // Sort by score descending
    scoredEntities.sort(
      (a: Entity & { score: number }, b: Entity & { score: number }) => {
        const scoreA = a.score
        const scoreB = b.score
        return scoreB - scoreA
      }
    )

    return {
      entities: scoredEntities,
      relations: graph.relations,
    }
  }

  /**
   * Get a specific relation by its from, to, and type identifiers
   *
   * @param from The name of the entity where the relation starts
   * @param to The name of the entity where the relation ends
   * @param relationType The type of the relation
   * @returns The relation or null if not found
   */
  getRelation(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation | null> | null {
    if (typeof this.database.getRelation === "function") {
      return this.database.getRelation(from, to, relationType)
    }
    return null
  }

  /**
   * Update a relation with new properties
   *
   * @param relation The relation to update
   * @returns Promise that resolves when update is complete
   */
  updateRelation(relation: Relation): Promise<void> {
    return this.database.updateRelation(relation)
  }

  /**
   * Update an entity with new properties
   *
   * @param entityName The name of the entity to update
   * @param updates Properties to update
   * @returns The updated entity
   */
  async updateEntity(
    entityName: string,
    updates: Partial<Entity>
  ): Promise<Entity> {
    if (
      "updateEntity" in this.database &&
      typeof (
        this.database as {
          updateEntity?: (
            name: string,
            updates: Partial<Entity>
          ) => Promise<Entity>
        }
      ).updateEntity === "function"
    ) {
      const result = await (
        this.database as {
          updateEntity: (
            name: string,
            updates: Partial<Entity>
          ) => Promise<Entity>
        }
      ).updateEntity(entityName, updates)

      // Schedule embedding generation if observations were updated
      if (this.embeddingJobManager && updates.observations) {
        await this.embeddingJobManager.scheduleEntityEmbedding(entityName)
      }

      return result
    }

    throw new Error("Storage provider does not support updateEntity")
  }

  /**
   * Get a version of the graph with confidences decayed based on time
   *
   * @returns Graph with decayed confidences
   */
  getDecayedGraph(): Promise<
    KnowledgeGraph & { decay_info?: Record<string, unknown> }
  > {
    if (!this.database || typeof this.database.getDecayedGraph !== "function") {
      throw new Error("Storage provider does not support decay operations")
    }

    return this.database.getDecayedGraph()
  }

  /**
   * Get the history of an entity
   *
   * @param entityName The name of the entity to retrieve history for
   * @returns Array of entity versions
   */
  getEntityHistory(entityName: string): Promise<Entity[]> {
    if (
      !this.database ||
      typeof this.database.getEntityHistory !== "function"
    ) {
      throw new Error(
        "Storage provider does not support entity history operations"
      )
    }

    return this.database.getEntityHistory(entityName)
  }

  /**
   * Get the history of a relation
   *
   * @param from The name of the entity where the relation starts
   * @param to The name of the entity where the relation ends
   * @param relationType The type of the relation
   * @returns Array of relation versions
   */
  getRelationHistory(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation[]> {
    if (
      !this.database ||
      typeof this.database.getRelationHistory !== "function"
    ) {
      throw new Error(
        "Storage provider does not support relation history operations"
      )
    }

    return this.database.getRelationHistory(from, to, relationType)
  }

  /**
   * Get the state of the knowledge graph at a specific point in time
   *
   * @param timestamp The timestamp (in milliseconds since epoch) to query the graph at
   * @returns The knowledge graph as it existed at the specified time
   */
  getGraphAtTime(timestamp: number): Promise<KnowledgeGraph> {
    if (!this.database || typeof this.database.getGraphAtTime !== "function") {
      throw new Error(
        "Storage provider does not support temporal graph operations"
      )
    }

    return this.database.getGraphAtTime(timestamp)
  }
}
