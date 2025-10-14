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
  error: (
    _message: string,
    _error?: Error | unknown,
    _meta?: LogMetadata
  ): void => {},
  warn: (_message: string, _meta?: LogMetadata): void => {},
  debug: (_message: string, _meta?: LogMetadata): void => {},
})

// ============================================================================
// ArkType Schemas and Types (Runtime Validation)
// ============================================================================

export type {
  Entity as EntityType,
  EntityEmbedding as EntityEmbeddingType,
} from "#types/entity"
// Entity schemas and types
// biome-ignore lint/performance/noBarrelFile: node
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
  RelationMetadata as RelationMetadataType,RelationType as RelationTypeType 
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
  default as TemporalEntity,
  TemporalRelation,
} from "#types/temporal"
export {
  TemporalEntityValidator,
  TemporalRelationValidator,
} from "#types/temporal"

// Type alias for TemporalEntity (for backward compatibility)
import type { default as TemporalEntity } from "#types/temporal"
export type TemporalEntityType = TemporalEntity



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
  OpenAIEmbeddingModel,
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
  OpenAIEmbeddingModel as OpenAIEmbeddingModelValidator,
  RateLimiterOptions as RateLimiterOptionsValidator,
  RateLimiterStatus as RateLimiterStatusValidator,
} from "#types/embedding"
// Neo4j-specific types
export type {
  ExtendedEntity,
  ExtendedRelation,
  KnowledgeGraphWithDiagnostics,
  Neo4jNode,
  Neo4jRelationship,
  Neo4jSemanticSearchOptions,
} from "#types/neo4j"
export {
  Neo4jNode as Neo4jNodeValidator,
  Neo4jRelationship as Neo4jRelationshipValidator,
  Neo4jValidator,
} from "#types/neo4j"
// Storage types (SearchOptions and SemanticSearchOptions)
export type { SearchOptions, SemanticSearchOptions } from "#types/storage"
export {
  SearchOptions as SearchOptionsValidator,
  SemanticSearchOptions as SemanticSearchOptionsValidator,
} from "#types/storage"
// Vector search and storage types
export type {
  VectorIndex,
  VectorSearchResult,
  VectorStore,
} from "#types/vector"
// Application constants
export * from "#types/constants"
