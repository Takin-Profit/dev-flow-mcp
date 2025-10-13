/**
 * Types Module - Central Export
 *
 * Consolidates core type definitions for the application.
 * Enables clean imports: `import type { Logger, Entity, Relation } from "#types"`
 */

import { type } from "arktype"

// ============================================================================
// Logger Types
// ============================================================================

/**
 * Metadata object for structured logging
 */
export type LogMetadata = Record<string, unknown>

/**
 * Logger type for application-wide logging
 *
 * All logging operations should go through this type to enable:
 * - Dependency injection
 * - Testing with mock loggers
 * - Swapping implementations without changing business logic
 */
export type Logger = {
  /**
   * Log informational messages
   * Use for: normal operations, state changes, milestones
   */
  info(message: string, meta?: LogMetadata): void

  /**
   * Log error messages
   * Use for: exceptions, failures, critical issues
   */
  error(message: string, error?: Error | unknown, meta?: LogMetadata): void

  /**
   * Log warning messages
   * Use for: deprecated features, recoverable issues, potential problems
   */
  warn(message: string, meta?: LogMetadata): void

  /**
   * Log debug messages
   * Use for: detailed diagnostic information, troubleshooting
   */
  debug(message: string, meta?: LogMetadata): void
}

/**
 * No-op logger for testing or when logging is disabled
 */
export const createNoOpLogger = (): Logger => ({
  info: (_message: string, _meta?: LogMetadata): void => {},
  error: (_message: string, _error?: Error | unknown, _meta?: LogMetadata): void => {},
  warn: (_message: string, _meta?: LogMetadata): void => {},
  debug: (_message: string, _meta?: LogMetadata): void => {},
})

// ============================================================================
// Arktype Validated Types
// ============================================================================

/**
 * Valid entity types for the knowledge graph
 */
export const EntityType = type("'feature' | 'task' | 'decision' | 'component'")

/**
 * Valid relation types for connecting entities
 */
export const RelationType = type(
  "'implements' | 'depends_on' | 'relates_to' | 'part_of'"
)

/**
 * TemporalEntity represents an entity with temporal versioning metadata
 * Used by storage providers to track entity history and changes over time
 */
export const TemporalEntity = type({
  id: "string",
  name: "string",
  entityType: "'feature' | 'task' | 'decision' | 'component'",
  observations: "string[]",
  version: "number",
  createdAt: "number",
  updatedAt: "number",
  validFrom: "number",
  "validTo?": "number | null",
  "changedBy?": "string | null",
  "embedding?": {
    vector: "number[]",
    model: "string",
    lastUpdated: "number"
  }
})

export type TemporalEntityType = typeof TemporalEntity.infer

// ============================================================================
// Entity Embedding Types
// ============================================================================

/**
 * Interface representing a vector embedding for semantic search
 */
export type EntityEmbedding = {
  /**
   * The embedding vector
   */
  vector: number[]

  /**
   * Name/version of embedding model used
   */
  model: string

  /**
   * Timestamp when embedding was last updated
   */
  lastUpdated: number
}

/**
 * Search filter for advanced filtering
 */
export type SearchFilter = {
  /**
   * Field to filter on
   */
  field: string

  /**
   * Filter operation
   */
  operator: "eq" | "ne" | "gt" | "lt" | "contains"

  /**
   * Filter value
   */
  value: unknown
}

/**
 * Extended SearchOptions interface with semantic search capabilities
 */
export type SemanticSearchOptions = {
  /**
   * Use vector similarity for search
   */
  semanticSearch?: boolean

  /**
   * Combine keyword and semantic search
   */
  hybridSearch?: boolean

  /**
   * Balance between keyword vs semantic (0.0-1.0)
   */
  semanticWeight?: number

  /**
   * Minimum similarity threshold
   */
  minSimilarity?: number

  /**
   * Apply query expansion
   */
  expandQuery?: boolean

  /**
   * Include facet information in results
   */
  includeFacets?: boolean

  /**
   * Facets to include (entityType, etc.)
   */
  facets?: string[]

  /**
   * Include score explanations
   */
  includeExplanations?: boolean

  /**
   * Additional filters
   */
  filters?: SearchFilter[]

  /**
   * Maximum number of results to return
   */
  limit?: number

  /**
   * Number of results to skip (for pagination)
   */
  offset?: number

  /**
   * Include document content in search (when available)
   */
  includeDocuments?: boolean

  /**
   * Use search result caching
   */
  useCache?: boolean
}

/**
 * Match details for search results
 */
export type SearchMatch = {
  /**
   * Field that matched
   */
  field: string

  /**
   * Score for this field
   */
  score: number

  /**
   * Text match locations
   */
  textMatches?: Array<{
    start: number
    end: number
    text: string
  }>
}

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Entity in the knowledge graph
 */
export type Entity = {
  name: string
  entityType: typeof EntityType.infer
  observations: string[]
  embedding?: EntityEmbedding
}

/**
 * Search result with relevance information
 */
export type SearchResult = {
  /**
   * The matching entity
   */
  entity: Entity

  /**
   * Overall relevance score
   */
  score: number

  /**
   * Match details
   */
  matches?: SearchMatch[]

  /**
   * Explanation of the scoring (if requested)
   */
  explanation?: unknown
}

/**
 * Search response with results and metadata
 */
export type SearchResponse = {
  /**
   * Search results
   */
  results: SearchResult[]

  /**
   * Total number of matching results
   */
  total: number

  /**
   * Facet information
   */
  facets?: Record<
    string,
    {
      counts: Record<string, number>
    }
  >

  /**
   * Search execution time in ms
   */
  timeTaken: number
}

// ============================================================================
// Re-exports from other files
// ============================================================================

// Relation types
export type { Relation } from "./relation.ts"

// Temporal types (legacy - consider removing if not used)
export type { default as LegacyTemporalEntity } from "./temporal-entity.ts"
export type { TemporalRelation } from "./temporal-relation.ts"

// Vector store types
export type { VectorIndex } from "./vector-index.ts"
export type { VectorStore } from "./vector-store.ts"
