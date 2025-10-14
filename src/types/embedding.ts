/**
 * Embedding Types with ArkType Runtime Validation
 *
 * This module defines types for the embedding subsystem including:
 * - Job status enums
 * - Cache configuration with defaults
 * - Job processing configuration with defaults
 * - Default settings as constants
 */
/** biome-ignore-all lint/style/noMagicNumbers: over zealous */

import { type } from "arktype"

// ============================================================================
// Constants
// ============================================================================

/**
 * Time constants for embedding configuration
 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * MILLISECONDS_PER_DAY

/**
 * Job status values for embedding jobs
 */
export const JOB_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const

/**
 * Default settings for embedding subsystem
 */
export const DEFAULT_EMBEDDING_SETTINGS = {
  /** Maximum batch size for processing embedding jobs */
  BATCH_SIZE: 10,

  /** Minimum time in milliseconds between API calls (rate limiting) */
  API_RATE_LIMIT_MS: 1000,

  /** Time-to-live in milliseconds for cached embeddings (default: 30 days) */
  CACHE_TTL_MS: THIRTY_DAYS_MS,

  /** Maximum number of entries to keep in the embedding cache */
  CACHE_MAX_SIZE: 1000,

  /** Minimum age in milliseconds for jobs to be eligible for cleanup (default: 30 days) */
  JOB_CLEANUP_AGE_MS: THIRTY_DAYS_MS,

  /** Job status options */
  JOB_STATUS,
} as const

// ============================================================================
// ArkType Schemas with Defaults
// ============================================================================

/**
 * Job status type - valid statuses for embedding jobs
 */
export const EmbeddingJobStatus = type(
  "'pending' | 'processing' | 'completed' | 'failed'"
)
export type EmbeddingJobStatus = typeof EmbeddingJobStatus.infer

/**
 * Embedding job record from the database
 */
export const EmbeddingJob = type({
  id: "string",
  entity_name: "string",
  status: EmbeddingJobStatus,
  priority: "number.integer",
  created_at: "number.integer >= 0",
  "processed_at?": "number.integer >= 0",
  "error?": "string",
  attempts: "number.integer >= 0",
  max_attempts: "number.integer > 0",
})
export type EmbeddingJob = typeof EmbeddingJob.infer

/**
 * Count result from database queries
 */
export const CountResult = type({
  count: "number.integer >= 0",
})
export type CountResult = typeof CountResult.infer

/**
 * Cache options for embedding cache
 * 
 * Supports both new format (size, ttl) and legacy format (maxItems, ttlHours)
 */
export const CacheOptions = type({
  size: "number.integer > 0",
  ttl: "number.integer > 0",
  // Legacy compatibility
  "maxItems?": "number.integer > 0",
  "ttlHours?": "number > 0",
})
export type CacheOptions = typeof CacheOptions.infer

/**
 * Rate limiter configuration options
 */
export const RateLimiterOptions = type({
  tokensPerInterval: "number.integer > 0",
  interval: "number.integer > 0",
})
export type RateLimiterOptions = typeof RateLimiterOptions.infer

/**
 * Job processing results summary
 */
export const JobProcessResults = type({
  processed: "number.integer >= 0",
  successful: "number.integer >= 0",
  failed: "number.integer >= 0",
})
export type JobProcessResults = typeof JobProcessResults.infer

/**
 * Rate limiter status information
 */
export const RateLimiterStatus = type({
  availableTokens: "number >= 0",
  maxTokens: "number.integer > 0",
  resetInMs: "number >= 0",
})
export type RateLimiterStatus = typeof RateLimiterStatus.infer

/**
 * Cached embedding entry
 */
export const CachedEmbedding = type({
  embedding: "number[]",
  timestamp: "number.integer >= 0",
  model: "string",
})
export type CachedEmbedding = typeof CachedEmbedding.infer

/**
 * Configuration for the LRU cache used for embeddings
 *
 * Defaults:
 * - max: 1000 items
 * - ttl: 30 days (2,592,000,000 ms)
 */
export const EmbeddingCacheOptions = type({
  /** Maximum number of items to keep in the cache */
  max: `number.integer > 0 = ${DEFAULT_EMBEDDING_SETTINGS.CACHE_MAX_SIZE}`,

  /** Time-to-live in milliseconds for cache entries */
  ttl: `number.integer > 0 = ${DEFAULT_EMBEDDING_SETTINGS.CACHE_TTL_MS}`,
})

export type EmbeddingCacheOptions = typeof EmbeddingCacheOptions.infer

/**
 * Configuration for embedding job processing
 *
 * Defaults:
 * - batchSize: 10
 * - apiRateLimitMs: 1000 (1 second)
 * - jobCleanupAgeMs: 30 days (2,592,000,000 ms)
 */
export const EmbeddingJobProcessingOptions = type({
  /** Maximum number of jobs to process in a single batch */
  batchSize: `number.integer > 0 = ${DEFAULT_EMBEDDING_SETTINGS.BATCH_SIZE}`,

  /** Minimum time in milliseconds between API calls (rate limiting) */
  apiRateLimitMs: `number.integer > 0 = ${DEFAULT_EMBEDDING_SETTINGS.API_RATE_LIMIT_MS}`,

  /** Maximum age in milliseconds for jobs to be eligible for cleanup */
  jobCleanupAgeMs: `number.integer > 0 = ${DEFAULT_EMBEDDING_SETTINGS.JOB_CLEANUP_AGE_MS}`,
})

export type EmbeddingJobProcessingOptions =
  typeof EmbeddingJobProcessingOptions.infer

// ============================================================================
// Validators
// ============================================================================

/**
 * Embedding configuration validators using frozen object pattern
 */
export const EmbeddingConfigValidator = Object.freeze({
  /**
   * Validates if data conforms to EmbeddingCacheOptions schema
   */
  validateCacheOptions(data: unknown) {
    return EmbeddingCacheOptions(data)
  },

  /**
   * Type guard: validates if data is EmbeddingCacheOptions
   */
  isCacheOptions(data: unknown): data is EmbeddingCacheOptions {
    const result = EmbeddingCacheOptions(data)
    return !(result instanceof type.errors)
  },

  /**
   * Validates if data conforms to EmbeddingJobProcessingOptions schema
   */
  validateJobProcessingOptions(data: unknown) {
    return EmbeddingJobProcessingOptions(data)
  },

  /**
   * Type guard: validates if data is EmbeddingJobProcessingOptions
   */
  isJobProcessingOptions(data: unknown): data is EmbeddingJobProcessingOptions {
    const result = EmbeddingJobProcessingOptions(data)
    return !(result instanceof type.errors)
  },

  /**
   * Validates if data conforms to EmbeddingJobStatus schema
   */
  validateJobStatus(data: unknown) {
    return EmbeddingJobStatus(data)
  },

  /**
   * Type guard: validates if data is a valid EmbeddingJobStatus
   */
  isJobStatus(data: unknown): data is EmbeddingJobStatus {
    const result = EmbeddingJobStatus(data)
    return !(result instanceof type.errors)
  },
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get configuration for the LRU cache for embeddings with validation
 *
 * This function accepts partial options and fills in defaults using arktype.
 * If you pass an empty object {}, all defaults will be applied.
 *
 * @param options - Optional overrides for cache settings
 * @returns Validated configuration object for the LRU cache
 * @throws Error if options are invalid
 */
export function getEmbeddingCacheConfig(
  options: Partial<EmbeddingCacheOptions> = {}
): EmbeddingCacheOptions {
  // ArkType will apply defaults for missing properties
  const result = EmbeddingCacheOptions(options)

  if (result instanceof type.errors) {
    throw new Error(`Invalid cache options: ${result.summary}`)
  }

  return result
}

/**
 * Get configuration for embedding job processing with validation
 *
 * This function accepts partial options and fills in defaults using arktype.
 * If you pass an empty object {}, all defaults will be applied.
 *
 * @param options - Optional overrides for job processing settings
 * @returns Validated configuration object for job processing
 * @throws Error if options are invalid
 */
export function getJobProcessingConfig(
  options: Partial<EmbeddingJobProcessingOptions> = {}
): EmbeddingJobProcessingOptions {
  // ArkType will apply defaults for missing properties
  const result = EmbeddingJobProcessingOptions(options)

  if (result instanceof type.errors) {
    throw new Error(`Invalid job processing options: ${result.summary}`)
  }

  return result
}
