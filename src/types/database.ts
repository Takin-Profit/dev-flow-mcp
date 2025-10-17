/**
 * Storage Types
 * Database and search-related type definitions
 */

import { z } from "#config"
import type {
  Entity,
  KnowledgeGraph,
  Relation,
  TemporalEntityType,
} from "#types"

/**
 * Similarity functions for vector search
 */
export type VectorSimilarityFunction = "cosine" | "euclidean"

/**
 * Options for searching nodes in the knowledge graph
 */
export const SearchOptionsSchema = z.object({
  limit: z.number().optional(),
  caseSensitive: z.boolean().optional(),
  entityTypes: z.array(z.string()).optional(),
})
export type SearchOptions = z.infer<typeof SearchOptionsSchema>

/**
 * Vector-specific options for semantic search
 */
export const SemanticSearchOptionsSchema = z.object({
  semanticSearch: z.boolean().optional(),
  queryVector: z.array(z.number()).optional(),
  minSimilarity: z.number().optional(),
  threshold: z.number().optional(),
  limit: z.number().optional(),
})
export type SemanticSearchOptions = z.infer<typeof SemanticSearchOptionsSchema>

/**
 * Vector store factory options
 */
export type VectorStoreFactoryOptions = {
  dbPath: string
  embeddingDimensions: number
  similarityFunction: VectorSimilarityFunction
}

/**
 * Database Interface
 * Core methods for persisting and querying the knowledge graph
 */
export type Database = {
  /**
   * Get an entity by name
   */
  getEntity(name: string): Promise<Entity | null>

  /**
   * Save or update an entity
   */
  saveEntity(entity: Entity): Promise<void>

  /**
   * Delete an entity by name
   */
  deleteEntity(name: string): Promise<void>

  /**
   * Get all entities
   */
  getAllEntities(): Promise<Entity[]>

  /**
   * Search entities by text query
   */
  searchEntities(query: string, options?: SearchOptions): Promise<Entity[]>

  /**
   * Semantic search using vector embeddings
   */
  semanticSearch(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<Entity[]>

  /**
   * Get a relation between two entities
   */
  getRelation(
    from: string,
    to: string,
    relationType: string
  ): Promise<Relation | null>

  /**
   * Save or update a relation
   */
  saveRelation(relation: Relation): Promise<void>

  /**
   * Delete a relation
   */
  deleteRelation(from: string, to: string, relationType: string): Promise<void>

  /**
   * Get all relations
   */
  getAllRelations(): Promise<Relation[]>

  /**
   * Get the entire knowledge graph
   */
  getGraph(): Promise<KnowledgeGraph>

  /**
   * Get entity history (temporal versions)
   */
  getEntityHistory(entityName: string): Promise<TemporalEntityType[]>

  /**
   * Get graph state at a specific time
   */
  getGraphAtTime(timestamp: number): Promise<KnowledgeGraph>

  /**
   * Close database connection
   */
  close(): Promise<void>
}
