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

// biome-ignore lint/performance/noBarrelFile: node
export { createNoOpLogger } from "#logger"
export type { Logger, LogMetadata } from "#types/logger"

// ============================================================================
// Zod Schemas and Types (Runtime Validation)
// ============================================================================

// Knowledge Graph types - export both direct and aliased for compatibility
export type {
  SearchMatch,
  SearchResponse,
  SearchResult,
  TextMatch,
} from "#types/knowledge-graph"
export {
  KnowledgeGraphValidator,
  SearchResponseSchema,
  SearchResultSchema,
} from "#types/knowledge-graph"
// Temporal types - entities and relations with versioning
export type {
  TemporalEntity,
  TemporalRelation,
} from "#types/temporal"
export {
  TemporalEntityValidator,
  TemporalRelationValidator,
} from "#types/temporal"
// Entity types - export both direct and aliased for compatibility
// Relation types - export both direct and aliased for compatibility
// Input/Output types for MCP tools
export type {
  AddObservationsInput,
  AddObservationsOutput,
  CreateEntitiesInput,
  CreateEntitiesOutput,
  CreateRelationsInput,
  CreateRelationsOutput,
  DeleteEntitiesInput,
  DeleteEntitiesOutput,
  DeleteObservationsInput,
  DeleteObservationsOutput,
  DeleteRelationsInput,
  DeleteRelationsOutput,
  Entity,
  EntityEmbedding,
  EntityName,
  EntityType,
  GetDecayedGraphInput,
  GetDecayedGraphOutput,
  GetEntityEmbeddingInput,
  GetEntityEmbeddingOutput,
  GetEntityHistoryInput,
  GetEntityHistoryOutput,
  GetGraphAtTimeInput,
  GetGraphAtTimeOutput,
  GetRelationHistoryInput,
  GetRelationHistoryOutput,
  GetRelationInput,
  GetRelationOutput,
  KnowledgeGraph,
  MCPToolResponse,
  Observation,
  OpenNodesInput,
  OpenNodesOutput,
  ReadGraphInput,
  ReadGraphOutput,
  Relation,
  RelationMetadata,
  RelationType as RelationTypeEnum,
  SearchNodesInput,
  SearchNodesOutput,
  SemanticSearchInput,
  SemanticSearchOutput,
  UpdateRelationInput,
  UpdateRelationOutput,
} from "#types/validation"

// Shared schemas from validation.ts (Zod-based)
export {
  AddObservationsInputSchema,
  AddObservationsOutputSchema,
  CreateEntitiesInputSchema,
  CreateEntitiesOutputSchema,
  CreateRelationsInputSchema,
  CreateRelationsOutputSchema,
  DeleteEntitiesInputSchema,
  DeleteEntitiesOutputSchema,
  DeleteObservationsInputSchema,
  DeleteObservationsOutputSchema,
  DeleteRelationsInputSchema,
  DeleteRelationsOutputSchema,
  EntityEmbeddingSchema,
  EntityNameSchema,
  EntitySchema,
  GetDecayedGraphInputSchema,
  GetDecayedGraphOutputSchema,
  GetEntityEmbeddingInputSchema,
  GetEntityEmbeddingOutputSchema,
  GetEntityHistoryInputSchema,
  GetEntityHistoryOutputSchema,
  GetGraphAtTimeInputSchema,
  GetGraphAtTimeOutputSchema,
  GetRelationHistoryInputSchema,
  GetRelationHistoryOutputSchema,
  GetRelationInputSchema,
  GetRelationOutputSchema,
  KnowledgeGraphSchema,
  MCPToolResponseSchema,
  ObservationSchema,
  OpenNodesInputSchema,
  OpenNodesOutputSchema,
  ReadGraphInputSchema,
  ReadGraphOutputSchema,
  RelationMetadataSchema,
  RelationSchema,
  RelationTypeSchema as RelationTypeValidator,
  RelationValidator,
  SearchNodesInputSchema,
  SearchNodesOutputSchema,
  SemanticSearchInputSchema,
  SemanticSearchOutputSchema,
  UpdateRelationInputSchema,
  UpdateRelationOutputSchema,
} from "#types/validation"

// Type alias for TemporalEntity (for backward compatibility)
import type { TemporalEntity } from "#types/temporal"
export type TemporalEntityType = TemporalEntity

// Service types
export type { IEmbeddingService as EmbeddingService } from "#embeddings/embedding-service"
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
