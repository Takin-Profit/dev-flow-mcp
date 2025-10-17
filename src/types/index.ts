/**
 * Types Module - Central Export
 *
 * Consolidates core type definitions for the application.
 * Enables clean imports: `import type { Logger, Entity, Relation } from "#types"`
 */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: empty blocks for logger */

// ============================================================================
// Logger Types
// ============================================================================

export type { Logger, LogMetadata } from "#types/logger"
// biome-ignore lint/performance/noBarrelFile: node
export { createNoOpLogger } from "#types/logger"

// ============================================================================
// Zod Schemas and Types (Runtime Validation)
// ============================================================================

export type {
  Entity as EntityType,
  EntityEmbedding as EntityEmbeddingType,
} from "#types/entity"
// Entity schemas and types
export {
  EntityEmbeddingSchema,
  EntitySchema,
  EntityValidator,
} from "#types/entity"
export type {
  KnowledgeGraph as KnowledgeGraphType,
  KnowledgeGraphManagerOptions,
  SearchMatch as SearchMatchType,
  SearchResponse as SearchResponseType,
  SearchResult as SearchResultType,
  TextMatch as TextMatchType,
} from "#types/knowledge-graph"
// Knowledge Graph schemas and types
export {
  KnowledgeGraphSchema,
  KnowledgeGraphValidator,
  SearchResponseSchema,
  SearchResultSchema,
} from "#types/knowledge-graph"
export type {
  Relation as RelationType,
  RelationMetadata as RelationMetadataType,
  RelationType as RelationTypeType,
} from "#types/relation"
// Relation schemas and types
export {
  RelationMetadataSchema,
  RelationSchema,
  RelationTypeSchema as RelationTypeValidator,
  RelationValidator,
} from "#types/relation"
// Temporal types - entities and relations with versioning
export type {
  TemporalEntity,
  TemporalRelation,
} from "#types/temporal"
export {
  TemporalEntityValidator,
  TemporalRelationValidator,
} from "#types/temporal"
export type {
  EntityName,
  Observation,
} from "#types/validation"
// Shared schemas from validation.ts (Zod-based)
export { EntityNameSchema, ObservationSchema } from "#types/validation"

// Type alias for TemporalEntity (for backward compatibility)
import type { TemporalEntity } from "#types/temporal"
export type TemporalEntityType = TemporalEntity

// Application constants
export * from "#types/constants"
// Storage types (SearchOptions and SemanticSearchOptions)
export type { SearchOptions, SemanticSearchOptions } from "#types/database"
export {
  SearchOptionsSchema as SearchOptionsValidator,
  SemanticSearchOptionsSchema as SemanticSearchOptionsValidator,
} from "#types/database"
// Embedding types with defaults
export type {
  CachedEmbedding,
  CacheOptions,
  CountResult,
  DefaultEmbeddingModel,
  EmbeddingCacheOptions,
  EmbeddingJob,
  EmbeddingJobProcessingOptions,
  EmbeddingJobStatus,
  EmbeddingModel,
  EmbeddingModelInfo,
  EmbeddingProvider,
  EmbeddingProviderInfo,
  JobProcessResults,
  OpenAIEmbeddingConfig,
  OpenAIEmbeddingData,
  OpenAIEmbeddingModel,
  OpenAIEmbeddingResponse,
  OpenAIUsage,
  RateLimiterOptions,
  RateLimiterStatus,
} from "#types/embedding"
export {
  CachedEmbeddingSchema as CachedEmbeddingValidator,
  CacheOptionsSchema as CacheOptionsValidator,
  CountResultSchema as CountResultValidator,
  DEFAULT_EMBEDDING_SETTINGS,
  DefaultEmbeddingModelSchema as DefaultEmbeddingModelValidator,
  EmbeddingCacheOptionsSchema as EmbeddingCacheOptionsValidator,
  EmbeddingConfigValidator,
  EmbeddingJobProcessingOptionsSchema as EmbeddingJobProcessingOptionsValidator,
  EmbeddingJobSchema as EmbeddingJobValidator,
  EmbeddingJobStatusSchema as EmbeddingJobStatusValidator,
  EmbeddingModelInfoSchema as EmbeddingModelInfoValidator,
  EmbeddingModelSchema as EmbeddingModelValidator,
  EmbeddingProviderInfoSchema as EmbeddingProviderInfoValidator,
  EmbeddingProviderSchema as EmbeddingProviderValidator,
  getEmbeddingCacheConfig,
  getJobProcessingConfig,
  JOB_STATUS,
  JobProcessResultsSchema as JobProcessResultsValidator,
  OpenAIEmbeddingDataSchema as OpenAIEmbeddingDataValidator,
  OpenAIEmbeddingModelSchema as OpenAIEmbeddingModelValidator,
  OpenAIEmbeddingResponseSchema as OpenAIEmbeddingResponseValidator,
  OpenAIUsageSchema as OpenAIUsageValidator,
  RateLimiterOptionsSchema as RateLimiterOptionsValidator,
  RateLimiterStatusSchema as RateLimiterStatusValidator,
} from "#types/embedding"
// Vector search and storage types
export type {
  VectorIndex,
  VectorSearchResult,
  VectorStore,
} from "#types/vector"
