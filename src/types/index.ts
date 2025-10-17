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
// ArkType Schemas and Types (Runtime Validation)
// ============================================================================

export type {
  Entity as EntityType,
  EntityEmbedding as EntityEmbeddingType,
} from "#types/entity"
// Entity schemas and types
export { Entity, EntityEmbedding, EntityValidator } from "#types/entity"
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
  KnowledgeGraph,
  KnowledgeGraphValidator,
  SearchResponse,
  SearchResult,
} from "#types/knowledge-graph"
export type {
  Relation as RelationType,
  RelationMetadata as RelationMetadataType,
  RelationType as RelationTypeType,
} from "#types/relation"
// Relation schemas and types
export {
  Relation,
  RelationMetadata,
  RelationType as RelationTypeValidator,
  RelationValidator,
} from "#types/relation"
export type {
  EntityName as EntityNameType,
  Observation as ObservationType,
} from "#types/shared"
// Shared schemas (no dependencies)
export { EntityName, Observation } from "#types/shared"

// Temporal types - entities and relations with versioning
export type {
  TemporalEntity,
  TemporalRelation,
} from "#types/temporal"
export {
  TemporalEntityValidator,
  TemporalRelationValidator,
} from "#types/temporal"

// Type alias for TemporalEntity (for backward compatibility)
import type { TemporalEntity } from "#types/temporal"
export type TemporalEntityType = TemporalEntity

// Application constants
export * from "#types/constants"
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
  CachedEmbedding as CachedEmbeddingValidator,
  CacheOptions as CacheOptionsValidator,
  CountResult as CountResultValidator,
  DEFAULT_EMBEDDING_SETTINGS,
  DefaultEmbeddingModel as DefaultEmbeddingModelValidator,
  EmbeddingCacheOptions as EmbeddingCacheOptionsValidator,
  EmbeddingConfigValidator,
  EmbeddingJob as EmbeddingJobValidator,
  EmbeddingJobProcessingOptions as EmbeddingJobProcessingOptionsValidator,
  EmbeddingJobStatus as EmbeddingJobStatusValidator,
  EmbeddingModel as EmbeddingModelValidator,
  EmbeddingModelInfo as EmbeddingModelInfoValidator,
  EmbeddingProvider as EmbeddingProviderValidator,
  EmbeddingProviderInfo as EmbeddingProviderInfoValidator,
  getEmbeddingCacheConfig,
  getJobProcessingConfig,
  JOB_STATUS,
  JobProcessResults as JobProcessResultsValidator,
  OpenAIEmbeddingData as OpenAIEmbeddingDataValidator,
  OpenAIEmbeddingModel as OpenAIEmbeddingModelValidator,
  OpenAIEmbeddingResponse as OpenAIEmbeddingResponseValidator,
  OpenAIUsage as OpenAIUsageValidator,
  RateLimiterOptions as RateLimiterOptionsValidator,
  RateLimiterStatus as RateLimiterStatusValidator,
} from "#types/embedding"

// Storage types (SearchOptions and SemanticSearchOptions)
export type { SearchOptions, SemanticSearchOptions } from "#types/database"
export {
  SearchOptions as SearchOptionsValidator,
  SemanticSearchOptions as SemanticSearchOptionsValidator,
} from "#types/database"
// Vector search and storage types
export type {
  VectorIndex,
  VectorSearchResult,
  VectorStore,
} from "#types/vector"
