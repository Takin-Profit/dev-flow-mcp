/**
 * Knowledge Graph type definitions
 * Core types re-exported from validation.ts, search types defined here
 */

import { z } from "#config"
import type { Entity } from "#types/validation"

// Re-export core knowledge graph types from validation
export type { KnowledgeGraph } from "#types/validation"
export { KnowledgeGraphSchema } from "#types/validation"

import { type KnowledgeGraph, KnowledgeGraphSchema } from "#types/validation"

/**
 * Knowledge Graph validator utilities using Zod
 */
export const KnowledgeGraphValidator = Object.freeze({
  /**
   * Type guard: validates if data is a KnowledgeGraph
   */
  isKnowledgeGraph(data: unknown): data is KnowledgeGraph {
    return KnowledgeGraphSchema.safeParse(data).success
  },

  /**
   * Validates if data conforms to KnowledgeGraph schema
   */
  validateKnowledgeGraph(data: unknown) {
    return KnowledgeGraphSchema.safeParse(data)
  },
})

/**
 * Text match highlighting information
 */
export const TextMatchSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
})
export type TextMatch = z.infer<typeof TextMatchSchema>

/**
 * Match details for a specific field in search results
 */
export const SearchMatchSchema = z.object({
  field: z.string(),
  score: z.number(),
  textMatches: z.array(TextMatchSchema).optional(),
})
export type SearchMatch = z.infer<typeof SearchMatchSchema>

/**
 * SearchResult - a single search result with relevance information
 */
export const SearchResultSchema = z.object({
  entity: z.any(), // Entity schema imported from validation
  score: z.number(),
  matches: z.array(SearchMatchSchema).optional(),
  explanation: z.unknown().optional(),
})
export type SearchResult = {
  entity: Entity
  score: number
  matches?: SearchMatch[]
  explanation?: unknown
}

/**
 * SearchResponse - search response with results and metadata
 */
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number(),
  facets: z.record(z.unknown()).optional(),
  timeTaken: z.number(),
})
export type SearchResponse = z.infer<typeof SearchResponseSchema>

/**
 * Knowledge Graph Manager Configuration Options
 */
export type KnowledgeGraphManagerOptions = {
  /**
   * Storage adapter for persisting entities and relations
   */
  database: unknown

  /**
   * Optional embedding service for semantic search
   */
  embeddingService?: unknown

  /**
   * Optional logger instance
   */
  logger?: unknown
}
