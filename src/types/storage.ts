/**
 * Storage Types with ArkType Runtime Validation
 *
 * This module defines storage-related types. Types without methods use
 * ArkType for runtime validation. Types with methods (interfaces) remain
 * as plain TypeScript types.
 */

import { type } from "arktype"
import type {
  Entity,
  KnowledgeGraph,
  Logger,
  Relation,
  TemporalEntityType,
} from "#types"

// ============================================================================
// Types with ArkType (no methods)
// ============================================================================

/**
 * Similarity functions for vector search
 */
export const VectorSimilarityFunction = type("'cosine' | 'euclidean'")
export type VectorSimilarityFunction = typeof VectorSimilarityFunction.infer

/**
 * Options for searching nodes in the knowledge graph
 */
export const SearchOptions = type({
  "limit?": "number.integer > 0",
  "caseSensitive?": "boolean",
  "entityTypes?": "string[]",
})
export type SearchOptions = typeof SearchOptions.infer

/**
 * Vector-specific options for semantic search
 * Used in combination with SearchOptions via intersection type
 *
 * Only includes properties that actually affect search behavior.
 * Properties like hybridSearch were removed as they are only logged but don't change results.
 */
export const SemanticSearchOptions = type({
  //** Whether to use semantic search or not.
  "semanticSearch?": "boolean",

  /** Pre-computed query vector for vector similarity search */
  "queryVector?": "number[]",

  /** Minimum similarity threshold (0.0-1.0) for filtering results */
  "minSimilarity?": "0 <= number <= 1",

  /** Alias for minSimilarity - minimum similarity threshold (0.0-1.0) */
  "threshold?": "0 <= number <= 1",

  "limit?": "0 <= number <= 1",
})
export type SemanticSearchOptions = typeof SemanticSearchOptions.infer

/**
 * Configuration options for vector store (legacy - kept for backward compatibility)
 * NOTE: Factory removed - SQLite vector store is always used
 */
export const VectorStoreFactoryOptionsSchema = type({
  "indexName?": "string > 0",
  "dimensions?": "number.integer > 0",
  "similarityFunction?": VectorSimilarityFunction,
  "initializeImmediately?": "boolean",
})

/**
 * Configuration options for vector store factory
 *
 * Combines arktype validation schema with Logger type for complete type safety.
 */
export type VectorStoreFactoryOptions =
  typeof VectorStoreFactoryOptionsSchema.infer & {
    logger?: Logger
  }

// ============================================================================
// Interface Types (contain methods - cannot use ArkType)
// ============================================================================

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
  getRelation?(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation | null>

  /**
   * Update an existing relation with new properties
   * @param relation The relation with updated properties
   * @returns Promise that resolves when the update is complete
   */
  updateRelation?(relation: Relation): Promise<void>

  /**
   * Perform semantic search on entities using embeddings
   * @param query The search query
   * @param options Search options including limit and filters
   * @returns Promise resolving to a KnowledgeGraph containing matching entities
   */
  semanticSearch?(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<KnowledgeGraph>

  updateEntityEmbedding?(entityName: string, embedding: any): Promise<void>

  getEntityEmbedding?(entityName: string): Promise<any | null>

  findSimilarEntities?(
    queryVector: number[],
    limit: number
  ): Promise<Array<TemporalEntityType & { similarity: number }>>

  getEntityHistory?(entityName: string): Promise<TemporalEntityType[]>

  getRelationHistory?(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation[]>

  getGraphAtTime?(timestamp: number): Promise<KnowledgeGraph>

  getDecayedGraph?(): Promise<KnowledgeGraph>

  diagnoseVectorSearch?(): Promise<Record<string, unknown>>
}
