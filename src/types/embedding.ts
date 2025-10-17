/**
 * Embedding Types with Zod Runtime Validation
 *
 * This module defines types for the embedding subsystem including:
 * - Job status enums
 * - Cache configuration with defaults
 * - Job processing configuration with defaults
 * - Default settings as constants
 */
/** biome-ignore-all lint/style/noMagicNumbers: over zealous */

import { z } from "#config"
import type { Logger } from "#types/logger"

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
// Zod Schemas with Defaults
// ============================================================================

/**
 * Job status type - valid statuses for embedding jobs
 */
export const EmbeddingJobStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
])
export type EmbeddingJobStatus = z.infer<typeof EmbeddingJobStatusSchema>

/**
 * Embedding job record from the database
 */
export const EmbeddingJobSchema = z.object({
  id: z.string(),
  entity_name: z.string(),
  status: EmbeddingJobStatusSchema,
  priority: z.number().int(),
  created_at: z.number().int().nonnegative(),
  processed_at: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
})
export type EmbeddingJob = z.infer<typeof EmbeddingJobSchema>

/**
 * Count result from database queries
 */
export const CountResultSchema = z.object({
  count: z.number().int().nonnegative(),
})
export type CountResult = z.infer<typeof CountResultSchema>

/**
 * Cache options for embedding cache
 *
 * Supports both new format (size, ttl) and legacy format (maxItems, ttlHours)
 */
export const CacheOptionsSchema = z.object({
  size: z.number().int().positive(),
  ttl: z.number().int().positive(),
  // Legacy compatibility
  maxItems: z.number().int().positive().optional(),
  ttlHours: z.number().positive().optional(),
})
export type CacheOptions = z.infer<typeof CacheOptionsSchema>

/**
 * Rate limiter configuration options
 */
export const RateLimiterOptionsSchema = z.object({
  tokensPerInterval: z.number().int().positive(),
  interval: z.number().int().positive(),
})
export type RateLimiterOptions = z.infer<typeof RateLimiterOptionsSchema>

/**
 * Job processing results summary
 */
export const JobProcessResultsSchema = z.object({
  processed: z.number().int().nonnegative(),
  successful: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})
export type JobProcessResults = z.infer<typeof JobProcessResultsSchema>

/**
 * Rate limiter status information
 */
export const RateLimiterStatusSchema = z.object({
  availableTokens: z.number().nonnegative(),
  maxTokens: z.number().int().positive(),
  resetInMs: z.number().nonnegative(),
})
export type RateLimiterStatus = z.infer<typeof RateLimiterStatusSchema>

/**
 * Cached embedding entry
 */
export const CachedEmbeddingSchema = z.object({
  embedding: z.array(z.number()),
  timestamp: z.number().int().nonnegative(),
  model: z.string(),
})
export type CachedEmbedding = z.infer<typeof CachedEmbeddingSchema>

// ============================================================================
// Provider and Model Information
// ============================================================================

/**
 * Supported embedding providers
 *
 * - openai: OpenAI's embedding API
 * - default: Mock/deterministic embeddings for testing
 */
export const EmbeddingProviderSchema = z.enum(["openai", "default"])
export type EmbeddingProvider = z.infer<typeof EmbeddingProviderSchema>

/**
 * OpenAI embedding model names
 *
 * Based on OpenAI's available models:
 * - text-embedding-3-small: Most efficient, 1536 dimensions
 * - text-embedding-3-large: Highest quality, 3072 dimensions
 * - text-embedding-ada-002: Legacy model, 1536 dimensions
 */
export const OpenAIEmbeddingModelSchema = z.enum([
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
])
export type OpenAIEmbeddingModel = z.infer<typeof OpenAIEmbeddingModelSchema>

/**
 * Mock/default embedding model names
 */
export const DefaultEmbeddingModelSchema = z.enum([
  "dfm-mcp-mock",
  "text-embedding-3-small-mock",
])
export type DefaultEmbeddingModel = z.infer<typeof DefaultEmbeddingModelSchema>

/**
 * All supported embedding model names
 */
export const EmbeddingModelSchema = z.enum([
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
  "dfm-mcp-mock",
  "text-embedding-3-small-mock",
])
export type EmbeddingModel = z.infer<typeof EmbeddingModelSchema>

/**
 * Model information for embedding models
 *
 * Contains metadata about the embedding model being used
 */
export const EmbeddingModelInfoSchema = z.object({
  name: EmbeddingModelSchema,
  dimensions: z.number().int().positive(),
  version: z.string(),
})
export type EmbeddingModelInfo = z.infer<typeof EmbeddingModelInfoSchema>

/**
 * Provider information for embedding services
 *
 * Combines provider type with model information
 */
export const EmbeddingProviderInfoSchema = z.object({
  provider: EmbeddingProviderSchema,
  model: EmbeddingModelSchema,
  dimensions: z.number().int().positive(),
})
export type EmbeddingProviderInfo = z.infer<typeof EmbeddingProviderInfoSchema>

/**
 * Configuration for the LRU cache used for embeddings
 *
 * Defaults:
 * - max: 1000 items
 * - ttl: 30 days (2,592,000,000 ms)
 */
export const EmbeddingCacheOptionsSchema = z.object({
  /** Maximum number of items to keep in the cache */
  max: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_EMBEDDING_SETTINGS.CACHE_MAX_SIZE),

  /** Time-to-live in milliseconds for cache entries */
  ttl: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_EMBEDDING_SETTINGS.CACHE_TTL_MS),
})

export type EmbeddingCacheOptions = z.infer<typeof EmbeddingCacheOptionsSchema>

/**
 * Configuration for embedding job processing
 *
 * Defaults:
 * - batchSize: 10
 * - apiRateLimitMs: 1000 (1 second)
 * - jobCleanupAgeMs: 30 days (2,592,000,000 ms)
 */
export const EmbeddingJobProcessingOptionsSchema = z.object({
  /** Maximum number of jobs to process in a single batch */
  batchSize: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_EMBEDDING_SETTINGS.BATCH_SIZE),

  /** Minimum time in milliseconds between API calls (rate limiting) */
  apiRateLimitMs: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_EMBEDDING_SETTINGS.API_RATE_LIMIT_MS),

  /** Maximum age in milliseconds for jobs to be eligible for cleanup */
  jobCleanupAgeMs: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_EMBEDDING_SETTINGS.JOB_CLEANUP_AGE_MS),
})

export type EmbeddingJobProcessingOptions = z.infer<
  typeof EmbeddingJobProcessingOptionsSchema
>

// ============================================================================
// OpenAI Configuration and Response Types
// ============================================================================

/**
 * OpenAI embedding service configuration (without logger)
 *
 * The logger is excluded from the Zod schema since it's a complex object
 * and is added via type intersection in the exported type
 */
const OpenAIEmbeddingConfigBaseSchema = z.object({
  /** OpenAI API key (required) */
  apiKey: z.string(),
  /** Model name (defaults to text-embedding-3-small) - accepts any EmbeddingModel and validates internally */
  model: EmbeddingModelSchema.optional(),
  /** Embedding dimensions (defaults to 1536) */
  dimensions: z.number().int().positive().optional(),
  /** Model version string (defaults to 3.0.0) */
  version: z.string().optional(),
})

/**
 * Full OpenAI embedding configuration including optional logger
 */
export type OpenAIEmbeddingConfig = z.infer<
  typeof OpenAIEmbeddingConfigBaseSchema
> & {
  /** Logger instance for dependency injection */
  logger?: Logger
}

/**
 * OpenAI embedding API response data item
 */
export const OpenAIEmbeddingDataSchema = z.object({
  embedding: z.array(z.number()),
  index: z.number().int().nonnegative(),
  object: z.string(),
})
export type OpenAIEmbeddingData = z.infer<typeof OpenAIEmbeddingDataSchema>

/**
 * OpenAI API usage information
 */
export const OpenAIUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
})
export type OpenAIUsage = z.infer<typeof OpenAIUsageSchema>

/**
 * OpenAI API response structure for embedding requests
 */
export const OpenAIEmbeddingResponseSchema = z.object({
  data: z.array(OpenAIEmbeddingDataSchema),
  model: z.string(),
  object: z.string(),
  usage: OpenAIUsageSchema,
})
export type OpenAIEmbeddingResponse = z.infer<
  typeof OpenAIEmbeddingResponseSchema
>

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
    return EmbeddingCacheOptionsSchema.safeParse(data)
  },

  /**
   * Type guard: validates if data is EmbeddingCacheOptions
   */
  isCacheOptions(data: unknown): data is EmbeddingCacheOptions {
    return EmbeddingCacheOptionsSchema.safeParse(data).success
  },

  /**
   * Validates if data conforms to EmbeddingJobProcessingOptions schema
   */
  validateJobProcessingOptions(data: unknown) {
    return EmbeddingJobProcessingOptionsSchema.safeParse(data)
  },

  /**
   * Type guard: validates if data is EmbeddingJobProcessingOptions
   */
  isJobProcessingOptions(data: unknown): data is EmbeddingJobProcessingOptions {
    return EmbeddingJobProcessingOptionsSchema.safeParse(data).success
  },

  /**
   * Validates if data conforms to EmbeddingJobStatus schema
   */
  validateJobStatus(data: unknown) {
    return EmbeddingJobStatusSchema.safeParse(data)
  },

  /**
   * Type guard: validates if data is a valid EmbeddingJobStatus
   */
  isJobStatus(data: unknown): data is EmbeddingJobStatus {
    return EmbeddingJobStatusSchema.safeParse(data).success
  },
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get configuration for the LRU cache for embeddings with validation
 *
 * This function accepts partial options and fills in defaults using Zod.
 * If you pass an empty object {}, all defaults will be applied.
 *
 * @param options - Optional overrides for cache settings
 * @returns Validated configuration object for the LRU cache
 * @throws Error if options are invalid
 */
export function getEmbeddingCacheConfig(
  options: Partial<EmbeddingCacheOptions> = {}
): EmbeddingCacheOptions {
  // Zod will apply defaults for missing properties
  const result = EmbeddingCacheOptionsSchema.safeParse(options)

  if (!result.success) {
    throw new Error(`Invalid cache options: ${result.error.message}`)
  }

  return result.data
}

/**
 * Get configuration for embedding job processing with validation
 *
 * This function accepts partial options and fills in defaults using Zod.
 * If you pass an empty object {}, all defaults will be applied.
 *
 * @param options - Optional overrides for job processing settings
 * @returns Validated configuration object for job processing
 * @throws Error if options are invalid
 */
export function getJobProcessingConfig(
  options: Partial<EmbeddingJobProcessingOptions> = {}
): EmbeddingJobProcessingOptions {
  // Zod will apply defaults for missing properties
  const result = EmbeddingJobProcessingOptionsSchema.safeParse(options)

  if (!result.success) {
    throw new Error(`Invalid job processing options: ${result.error.message}`)
  }

  return result.data
}
