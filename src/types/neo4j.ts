/**
 * Neo4j-specific Types with ArkType Runtime Validation
 *
 * This module defines types for Neo4j data structures including:
 * - Node data from Neo4j queries (raw database format)
 * - Extended entities with temporal properties
 * - Extended relations with temporal properties
 * - Neo4j-specific search options
 */

import { type } from "arktype"
import type { Entity } from "#types/entity"
import type { KnowledgeGraph } from "#types/knowledge-graph"
import type { SemanticSearchOptions } from "#types/storage"

// ============================================================================
// Neo4j Node Data (from database queries)
// ============================================================================

/**
 * Raw Neo4j node data as it comes from database queries
 *
 * Note: observations is stored as a JSON string in Neo4j
 * Note: version, createdAt, updatedAt are required in the database
 */
export const Neo4jNode = type({
  name: "string",
  entityType: "'feature' | 'task' | 'decision' | 'component'",
  observations: "string", // JSON string in Neo4j
  "id?": "string",
  version: "number.integer >= 1",
  createdAt: "number.integer >= 0",
  updatedAt: "number.integer >= 0",
  "validFrom?": "number.integer >= 0",
  "validTo?": "number.integer >= 0",
  "changedBy?": "string",
})

export type Neo4jNode = typeof Neo4jNode.infer

/**
 * Raw Neo4j relationship data as it comes from database queries
 */
export const Neo4jRelationship = type({
  "id?": "string",
  relationType: "'implements' | 'depends_on' | 'relates_to' | 'part_of'",
  "version?": "number.integer >= 1",
  "createdAt?": "number.integer >= 0",
  "updatedAt?": "number.integer >= 0",
  "validFrom?": "number.integer >= 0",
  "validTo?": "number.integer >= 0 | null",
  "changedBy?": "string | null",
  "strength?": "0 <= number <= 1 | null",
  "confidence?": "0 <= number <= 1 | null",
  "metadata?": "Record<string, unknown> | null",
})

export type Neo4jRelationship = typeof Neo4jRelationship.infer

// ============================================================================
// Extended Types (Entity and Relation with temporal properties)
// ============================================================================

/**
 * Entity extended with temporal and versioning properties for Neo4j
 *
 * This combines the base Entity with Neo4j-specific metadata like
 * timestamps, versions, and validity periods.
 *
 * Note: This type is compatible with TemporalEntity interface
 */
export type ExtendedEntity = Entity & {
  id?: string
  version: number
  createdAt: number
  updatedAt: number
  validFrom?: number
  validTo?: number
  changedBy?: string
}

/**
 * Relation extended with temporal and versioning properties for Neo4j
 *
 * Note: This doesn't extend Relation to avoid type conflicts with strength/confidence
 * which can be null in the database but not in the Relation type.
 */
export type ExtendedRelation = {
  id?: string
  from: string
  to: string
  relationType: string
  version?: number
  createdAt?: number
  updatedAt?: number
  validFrom?: number
  validTo?: number | null
  changedBy?: string | null
  strength?: number | null | undefined
  confidence?: number | null | undefined
  metadata?: Record<string, unknown> | null
}

// ============================================================================
// Neo4j-specific Search Options
// ============================================================================

/**
 * Extended SemanticSearchOptions with Neo4j-specific additions
 *
 * Adds queryVector for pre-computed embedding vectors
 */
export type Neo4jSemanticSearchOptions = SemanticSearchOptions & {
  queryVector?: number[]
}

/**
 * Knowledge graph with optional diagnostics for debugging and performance tracking
 */
export type KnowledgeGraphWithDiagnostics = KnowledgeGraph & {
  diagnostics?: Record<string, unknown>
}

// ============================================================================
// Validators
// ============================================================================

/**
 * Neo4j type validators using frozen object pattern
 */
export const Neo4jValidator = Object.freeze({
  /**
   * Validates if data conforms to Neo4jNode schema
   */
  validateNode(data: unknown) {
    return Neo4jNode(data)
  },

  /**
   * Type guard: validates if data is a Neo4jNode
   */
  isNode(data: unknown): data is Neo4jNode {
    const result = Neo4jNode(data)
    return !(result instanceof type.errors)
  },

  /**
   * Validates if data conforms to Neo4jRelationship schema
   */
  validateRelationship(data: unknown) {
    return Neo4jRelationship(data)
  },

  /**
   * Type guard: validates if data is a Neo4jRelationship
   */
  isRelationship(data: unknown): data is Neo4jRelationship {
    const result = Neo4jRelationship(data)
    return !(result instanceof type.errors)
  },
})
