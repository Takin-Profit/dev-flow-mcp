/**
 * Knowledge Graph Types with ArkType Runtime Validation
 *
 * This module defines knowledge graph structure types using ArkType.
 * All types have both compile-time TypeScript types and runtime validation.
 *
 * ## Validation Rules
 *
 * ### KnowledgeGraph
 * - entities: Array of Entity objects (can be empty)
 * - relations: Array of Relation objects (can be empty)
 * - total: Optional count of total items (for paginated results)
 * - timeTaken: Optional time in milliseconds for the operation
 * - diagnostics: Optional diagnostic information as key-value pairs
 *
 * ### SearchResult
 * - entity: The matching Entity object
 * - score: Relevance score between 0.0 and 1.0
 * - matches: Optional array of field-level match details
 * - explanation: Optional explanation of the scoring algorithm
 *
 * ### SearchResponse
 * - results: Array of SearchResult objects
 * - total: Total number of matching results
 * - facets: Optional faceted search results for filtering
 * - timeTaken: Time in milliseconds for the search operation
 */

import { type } from "arktype"
import type { EmbeddingJobManager } from "#embeddings/embedding-job-manager"
import type { Database } from "#db/database"
import { Entity } from "#types/entity"
// Import types needed for KnowledgeGraphManagerOptions
import type { Logger } from "#types/index"
import { Relation as RelationSchema } from "#types/relation"
import type { VectorStoreFactoryOptions } from "#types/database"

/**
 * KnowledgeGraph - the complete knowledge graph structure
 */
export const KnowledgeGraph = type({
  entities: Entity.array(),
  relations: RelationSchema.array(),
  "total?": "number.integer >= 0",
  "timeTaken?": "number >= 0",
  "diagnostics?": "Record<string, unknown>",
})

export type KnowledgeGraph = typeof KnowledgeGraph.infer

/**
 * Text match details within a search result
 */
const TextMatch = type({
  start: "number.integer >= 0",
  end: "number.integer >= 0",
  text: "string",
}).narrow((match, ctx) => {
  if (match.end < match.start) {
    return ctx.reject({
      expected: "end >= start",
      actual: `end(${match.end}) < start(${match.start})`,
      path: ["end"],
    })
  }
  return true
})

export type TextMatch = typeof TextMatch.infer

/**
 * Match details for a specific field in search results
 */
const SearchMatch = type({
  field: "string",
  score: "0 <= number <= 1",
  "textMatches?": TextMatch.array(),
})

export type SearchMatch = typeof SearchMatch.infer

/**
 * SearchResult - a single search result with relevance information
 */
export const SearchResult = type({
  entity: Entity,
  score: "0 <= number <= 1",
  "matches?": SearchMatch.array(),
  "explanation?": "unknown",
})

export type SearchResult = typeof SearchResult.infer

/**
 * Facet count for faceted search results
 */
const Facet = type({
  counts: "Record<string, number>",
})

export type Facet = typeof Facet.infer

/**
 * SearchResponse - search response with results and metadata
 */
export const SearchResponse = type({
  results: SearchResult.array(),
  total: "number.integer >= 0",
  "facets?": "Record<string, unknown>",
  timeTaken: "number >= 0",
})

export type SearchResponse = typeof SearchResponse.infer

/**
 * KnowledgeGraphValidator provides validation methods with ArkType
 * Uses frozen object pattern for stateless validation functions
 */
export const KnowledgeGraphValidator = Object.freeze({
  /**
   * Validates if data conforms to the KnowledgeGraph schema
   */
  validateGraph(data: unknown) {
    return KnowledgeGraph(data)
  },

  /**
   * Type guard: validates if data is a KnowledgeGraph
   */
  isKnowledgeGraph(data: unknown): data is KnowledgeGraph {
    const result = KnowledgeGraph(data)
    return !(result instanceof type.errors)
  },

  /**
   * Validates if data conforms to the SearchResult schema
   */
  validateSearchResult(data: unknown) {
    return SearchResult(data)
  },

  /**
   * Type guard: validates if data is a SearchResult
   */
  isSearchResult(data: unknown): data is SearchResult {
    const result = SearchResult(data)
    return !(result instanceof type.errors)
  },

  /**
   * Validates if data conforms to the SearchResponse schema
   */
  validateSearchResponse(data: unknown) {
    return SearchResponse(data)
  },

  /**
   * Type guard: validates if data is a SearchResponse
   */
  isSearchResponse(data: unknown): data is SearchResponse {
    const result = SearchResponse(data)
    return !(result instanceof type.errors)
  },
})

/**
 * KnowledgeGraphManager configuration options
 *
 * Note: This uses a plain TypeScript type instead of arktype because
 * it contains complex interfaces (Database, Logger, etc.) that
 * cannot be runtime-validated with arktype.
 */
export type KnowledgeGraphManagerOptions = {
  database: Database
  embeddingJobManager?: EmbeddingJobManager
  vectorStoreOptions?: VectorStoreFactoryOptions
  logger?: Logger
}
