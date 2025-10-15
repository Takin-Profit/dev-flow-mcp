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
 * Supported vector store types
 */
export const VectorStoreType = type("'neo4j'")
export type VectorStoreType = typeof VectorStoreType.infer

/**
 * Similarity functions for vector search
 */
export const VectorSimilarityFunction = type("'cosine' | 'euclidean'")
export type VectorSimilarityFunction = typeof VectorSimilarityFunction.infer

/**
 * Neo4j configuration with strict validation
 *
 * Validates Neo4j connection and vector index configuration.
 * URIs must start with bolt://, bolt+s://, bolt+ssc://, or neo4j://
 */
export const Neo4jConfig = type({
  /** Neo4j server URI - must be a valid bolt:// or neo4j:// URI */
  uri: "string >= 10",

  /** Username for authentication - non-empty string */
  username: "string > 0",

  /** Password for authentication - non-empty string */
  password: "string > 0",

  /** Neo4j database name - non-empty string */
  database: "string > 0",

  /** Name of the vector index - non-empty string */
  vectorIndexName: "string > 0",

  /** Dimensions for vector embeddings - must be positive integer */
  vectorDimensions: "number.integer > 0",

  /** Similarity function for vector search */
  similarityFunction: VectorSimilarityFunction,
})
export type Neo4jConfig = typeof Neo4jConfig.infer

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
 * Configuration options for vector store factory (runtime validation schema)
 *
 * This schema validates all properties except logger (which is a method-bearing interface).
 * The exported TypeScript type intersects this with {logger?: Logger} for type safety.
 */
export const VectorStoreFactoryOptionsSchema = type({
  "type?": VectorStoreType,
  "neo4jConfig?": Neo4jConfig,
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
}
