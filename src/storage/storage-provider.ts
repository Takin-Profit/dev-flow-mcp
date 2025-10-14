import type {
  Entity,
  EntityEmbedding,
  KnowledgeGraph,
  Relation,
  SearchOptions,
  SemanticSearchOptions,
  TemporalEntityType,
} from "#types"

/**
 * Interface for storage providers that can load and save knowledge graphs
 */
export type StorageProvider = {
  /**
   * Load a knowledge graph from storage
   * @returns Promise resolving to the loaded knowledge graph
   */
  loadGraph(): Promise<KnowledgeGraph>

  /**
   * Save a knowledge graph to storage
   * @param graph The knowledge graph to save
   * @returns Promise that resolves when the save is complete
   */
  saveGraph(graph: KnowledgeGraph): Promise<void>

  /**
   * Search for nodes in the graph that match the query
   * @param query The search query string
   * @param options Optional search parameters
   * @returns Promise resolving to a KnowledgeGraph containing matching nodes
   */
  searchNodes(query: string, options?: SearchOptions): Promise<KnowledgeGraph>

  /**
   * Open specific nodes by their exact names
   * @param names Array of node names to open
   * @returns Promise resolving to a KnowledgeGraph containing the specified nodes
   */
  openNodes(names: string[]): Promise<KnowledgeGraph>

  /**
   * Create new entities in the knowledge graph
   * @param entities Array of entities to create
   * @returns Promise resolving to array of newly created entities with temporal metadata
   */
  createEntities(entities: Entity[]): Promise<TemporalEntityType[]>

  /**
   * Create new relations between entities
   * @param relations Array of relations to create
   * @returns Promise resolving to array of newly created relations
   */
  createRelations(relations: Relation[]): Promise<Relation[]>

  /**
   * Add observations to entities
   * @param observations Array of objects with entity name and observation contents
   * @returns Promise resolving to array of objects with entity name and added observations
   */
  addObservations(
    observations: { entityName: string; contents: string[] }[]
  ): Promise<{ entityName: string; addedObservations: string[] }[]>

  /**
   * Delete entities and their relations
   * @param entityNames Array of entity names to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteEntities(entityNames: string[]): Promise<void>

  /**
   * Delete observations from entities
   * @param deletions Array of objects with entity name and observations to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteObservations(
    deletions: { entityName: string; observations: string[] }[]
  ): Promise<void>

  /**
   * Delete relations from the graph
   * @param relations Array of relations to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteRelations(relations: Relation[]): Promise<void>

  /**
   * Get a specific relation by its source, target, and type
   * @param from Source entity name
   * @param to Target entity name
   * @param relationType Relation type
   * @returns Promise resolving to the relation or null if not found
   */
  getRelation?(from: string, to: string, relationType: string): Promise<Relation | null>

  /**
   * Update an existing relation with new properties
   * @param relation The relation with updated properties
   * @returns Promise that resolves when the update is complete
   */
  updateRelation?(relation: Relation): Promise<void>

  /**
   * Get the history of all versions of an entity
   * @param entityName The name of the entity to retrieve history for
   * @returns Promise resolving to an array of entity versions in chronological order
   */
  getEntityHistory?(entityName: string): Promise<TemporalEntityType[]>

  /**
   * Get the history of all versions of a relation
   * @param from Source entity name
   * @param to Target entity name
   * @param relationType Type of the relation
   * @returns Promise resolving to an array of relation versions in chronological order
   */
  getRelationHistory?(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation[]>

  /**
   * Get the state of the knowledge graph at a specific point in time
   * @param timestamp The timestamp to get the graph state at
   * @returns Promise resolving to the knowledge graph as it was at the specified time
   */
  getGraphAtTime?(timestamp: number): Promise<KnowledgeGraph>

  /**
   * Get the current knowledge graph with confidence decay applied to relations
   * based on their age and the configured decay settings
   * @returns Promise resolving to the knowledge graph with decayed confidence values
   */
  getDecayedGraph?(): Promise<KnowledgeGraph>

  /**
   * Store or update the embedding vector for an entity
   * @param entityName The name of the entity to update
   * @param embedding The embedding data to store
   * @returns Promise that resolves when the update is complete
   */
  updateEntityEmbedding?(
    entityName: string,
    embedding: EntityEmbedding
  ): Promise<void>

  /**
   * Find entities similar to a query vector
   * @param queryVector The vector to compare against
   * @param limit Maximum number of results to return
   * @returns Promise resolving to array of entities with similarity scores
   */
  findSimilarEntities?(
    queryVector: number[],
    limit?: number
  ): Promise<Array<TemporalEntityType & { similarity: number }>>

  /**
   * Search for entities using semantic search
   * @param query The search query text
   * @param options Search options including semantic search parameters
   * @returns Promise resolving to a KnowledgeGraph containing matching entities
   */
  semanticSearch?(
    query: string,
    options?: SearchOptions & SemanticSearchOptions
  ): Promise<KnowledgeGraph>

  /**
   * Get an entity by name
   * @param entityName Name of the entity to retrieve
   * @returns Promise resolving to the entity or null if not found
   */
  getEntity(entityName: string): Promise<TemporalEntityType | null>

  /**
   * Get the embedding for a specific entity (optional, for vector-enabled storage)
   * @param entityName Name of the entity
   * @returns Promise resolving to the embedding or null if not found
   */
  getEntityEmbedding?(entityName: string): Promise<EntityEmbedding | null>

  /**
   * Store or update a vector for an entity (optional, for vector-enabled storage)
   * @param entityName Name of the entity
   * @param vector The embedding vector
   * @returns Promise that resolves when the operation is complete
   */
  storeEntityVector?(entityName: string, vector: number[]): Promise<void>

  /**
   * Get an entity by its internal ID (optional, implementation-specific)
   * @param entityId The internal ID of the entity
   * @returns Promise resolving to the entity or null if not found
   */
  getEntityById?(entityId: string): Promise<TemporalEntityType | null>

  /**
   * Count entities that have embeddings (optional, for diagnostic purposes)
   * @returns Promise resolving to the count
   */
  countEntitiesWithEmbeddings?(): Promise<number>

  /**
   * Get connection manager (optional, implementation-specific)
   * Used for diagnostics and connection management
   * @returns The connection manager object
   */
  getConnectionManager?(): unknown

  /**
   * Diagnose vector search functionality (optional, for debugging)
   * @returns Promise resolving to diagnostic information
   */
  diagnoseVectorSearch?(): Promise<Record<string, unknown>>
}

/**
 * Validator for StorageProvider objects
 * Uses frozen object pattern for consistency with other validators
 */
export const StorageProviderValidator = Object.freeze({
  /**
   * Validates if an object conforms to the StorageProvider interface
   */
  isStorageProvider(obj: unknown): obj is StorageProvider {
    // Type guard: ensure obj is an object
    if (!obj || typeof obj !== "object") {
      return false
    }

    const candidate = obj as Record<string, unknown>

    // Check all required methods exist and are functions
    const hasRequiredMethods =
      typeof candidate.loadGraph === "function" &&
      typeof candidate.saveGraph === "function" &&
      typeof candidate.searchNodes === "function" &&
      typeof candidate.openNodes === "function" &&
      typeof candidate.createEntities === "function" &&
      typeof candidate.createRelations === "function" &&
      typeof candidate.addObservations === "function" &&
      typeof candidate.deleteEntities === "function" &&
      typeof candidate.deleteObservations === "function" &&
      typeof candidate.deleteRelations === "function" &&
      typeof candidate.getEntity === "function"

    if (!hasRequiredMethods) {
      return false
    }

    // Check that any optional methods, if present, are functions
    const optionalMethodsValid =
      (candidate.getRelation === undefined ||
        typeof candidate.getRelation === "function") &&
      (candidate.updateRelation === undefined ||
        typeof candidate.updateRelation === "function") &&
      (candidate.getEntityHistory === undefined ||
        typeof candidate.getEntityHistory === "function") &&
      (candidate.getRelationHistory === undefined ||
        typeof candidate.getRelationHistory === "function") &&
      (candidate.getGraphAtTime === undefined ||
        typeof candidate.getGraphAtTime === "function") &&
      (candidate.getDecayedGraph === undefined ||
        typeof candidate.getDecayedGraph === "function") &&
      (candidate.updateEntityEmbedding === undefined ||
        typeof candidate.updateEntityEmbedding === "function") &&
      (candidate.findSimilarEntities === undefined ||
        typeof candidate.findSimilarEntities === "function") &&
      (candidate.semanticSearch === undefined ||
        typeof candidate.semanticSearch === "function")

    return optionalMethodsValid
  },
})
