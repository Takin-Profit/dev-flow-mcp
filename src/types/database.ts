/**
 * Storage Types
 * Database and search-related type definitions
 */

import { z } from "#config"

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
