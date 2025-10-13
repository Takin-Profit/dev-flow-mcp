/**
 * Types Module - Central Export
 *
 * Barrel export file for all type definitions.
 * Enables clean imports: `import type { Logger, Entity, Relation } from "#types"`
 */

// Logger types
export type { Logger, LogMetadata } from "./logger.ts"
export { createNoOpLogger } from "./logger.ts"

// Arktype validated types
export { EntityType, RelationType, TemporalEntity } from "./arktype.ts"
export type { TemporalEntity as TemporalEntityType } from "./arktype.ts"

// Entity types
export type { Entity } from "./entity.ts"

// Entity embedding types
export type { EntityEmbedding } from "./entity-embedding.ts"

// Relation types
export type { Relation } from "./relation.ts"

// Temporal types (legacy - consider removing if not used)
export type { TemporalEntity as LegacyTemporalEntity } from "./temporal-entity.ts"
export type { TemporalRelation } from "./temporal-relation.ts"

// Vector store types
export type { VectorIndex } from "./vector-index.ts"
export type { VectorStore } from "./vector-store.ts"
